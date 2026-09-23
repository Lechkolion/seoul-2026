#!/usr/bin/env node
/**
 * Media pass: download every remote place image, convert to WebP (≤1600 px wide, q78) + 640 px thumb.
 *
 *   node scripts/fetch-images.mjs                       # all data/places/*.json
 *   node scripts/fetch-images.mjs --ids a,b --limit 20  # subset (by place id / first N images)
 *   node scripts/fetch-images.mjs --files data/places/food.json
 *   node scripts/fetch-images.mjs --retry-dead --force --dry-run --concurrency 6
 *
 * Output: public/images/<placeId>/<n>.webp and <n>-sm.webp, plus data/media-cache.json keyed by
 * remote URL: { status: 'ok'|'dead'|'failed', file, thumb, width, height, bytes, placeId, fetchedAt, error? }.
 * Research files are never rewritten; build-data.mjs merges the cache (local path in `url`,
 * original in `remoteUrl`, plus `thumb`, `width`, `height`) and drops images marked dead.
 *   ok     → cached, skipped on later runs (unless --force or files are missing)
 *   dead   → permanent failure (HTTP 4xx, not an image, undecodable); skipped unless --retry-dead
 *   failed → transient (timeout, 5xx, network); retried on the next run, not dropped
 * Requires ffmpeg on PATH. Zero npm dependencies.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, statSync, renameSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { listPlaceFiles, loadFile } from './validate-places.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');
const CACHE_FILE = join(ROOT, 'data', 'media-cache.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const TIMEOUT_MS = 20000;
const MAX_W = 1600, THUMB_W = 640, QUALITY = 78;
const MAX_BYTES = 40 * 1024 * 1024;

// ---------------------------------------------------------------- args
const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def; };
const flag = (name) => argv.includes(`--${name}`);
const CONCURRENCY = Math.max(1, +opt('concurrency', 6));
const LIMIT = opt('limit') ? +opt('limit') : Infinity;
const IDS = opt('ids') ? new Set(opt('ids').split(',').map((s) => s.trim())) : null;
const FILES = opt('files') ? opt('files').split(',').map((f) => resolve(f)) : listPlaceFiles();
const FORCE = flag('force'), RETRY_DEAD = flag('retry-dead'), DRY = flag('dry-run');

// ---------------------------------------------------------------- cache
const cache = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : {};
let dirty = 0;
function saveCache() {
  if (DRY) return;
  const sorted = Object.fromEntries(Object.keys(cache).sort().map((k) => [k, cache[k]]));
  const tmp = `${CACHE_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(sorted, null, 1) + '\n');
  renameSync(tmp, CACHE_FILE);
  dirty = 0;
}

// ---------------------------------------------------------------- collect jobs
const jobs = [];
const seen = new Set();
for (const f of FILES) {
  const { records, error } = loadFile(f);
  if (error) { console.warn(`skip ${f}: ${error}`); continue; }
  for (const p of records) {
    if (!p || typeof p.id !== 'string' || p.id.startsWith('sample-') || !Array.isArray(p.images)) continue;
    if (IDS && !IDS.has(p.id)) continue;
    for (const im of p.images) {
      const url = im?.url;
      if (typeof url !== 'string' || !/^https?:\/\//i.test(url) || seen.has(url)) continue;
      seen.add(url);
      const c = cache[url];
      const filesOk = c?.status === 'ok' && existsSync(join(PUBLIC, c.file)) && existsSync(join(PUBLIC, c.thumb));
      if (!FORCE && filesOk) continue;
      if (!FORCE && !RETRY_DEAD && c?.status === 'dead') continue;
      jobs.push({ url, placeId: p.id, referer: im.source });
    }
  }
}
const todo = jobs.slice(0, LIMIT);
console.log(`[images] ${seen.size} remote image URL(s) referenced; ${jobs.length} need work; processing ${todo.length}${DRY ? ' (dry run)' : ''}.`);
if (DRY) { for (const j of todo) console.log(`  ${j.placeId}  ${j.url}`); process.exit(0); }

// stable per-place numbering: reuse the cached n for a URL, otherwise the next free number for that place
function slotFor(placeId, url) {
  const prev = cache[url];
  if (prev?.file && prev.placeId === placeId) { const m = prev.file.match(/\/(\d+)\.webp$/); if (m) return +m[1]; }
  const used = new Set(Object.values(cache).filter((c) => c.placeId === placeId && c.file).map((c) => +(c.file.match(/\/(\d+)\.webp$/)?.[1] ?? 0)));
  for (const c of pending.values()) if (c.placeId === placeId) used.add(c.n);
  let n = 1;
  while (used.has(n)) n++;
  return n;
}
const pending = new Map(); // url → { placeId, n } reserved slots of in-flight jobs

// ---------------------------------------------------------------- helpers
function sniff(buf) {
  const b = buf.subarray(0, 16);
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b.toString('ascii', 0, 3) === 'GIF') return 'gif';
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (b.toString('ascii', 4, 8) === 'ftyp' && /avif|avis|heic|heix|mif1/.test(b.toString('ascii', 8, 12))) return 'avif';
  if (b[0] === 0x42 && b[1] === 0x4d) return 'bmp';
  return null;
}
class HttpError extends Error { constructor(msg, permanent) { super(msg); this.permanent = permanent; } }

async function download(url, referer) {
  const headers = { 'User-Agent': UA, Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.9,ko;q=0.8' };
  if (referer && /^https?:\/\//.test(referer)) headers.Referer = referer;
  let res;
  try {
    res = await fetch(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    throw new HttpError(e.name === 'TimeoutError' ? 'timeout' : `network: ${e.cause?.code || e.message}`, false);
  }
  if (!res.ok) throw new HttpError(`HTTP ${res.status}`, res.status >= 400 && res.status < 500 && res.status !== 429 && res.status !== 408);
  const len = +res.headers.get('content-length') || 0;
  if (len > MAX_BYTES) throw new HttpError(`too large (${len} bytes)`, true);
  const buf = Buffer.from(await res.arrayBuffer());
  const type = res.headers.get('content-type') || '';
  const kind = sniff(buf);
  if (!kind) throw new HttpError(`not an image (content-type "${type.split(';')[0]}", ${buf.length} bytes)`, true);
  return { buf, kind };
}

function run(cmd, args) {
  return new Promise((ok, fail) => {
    const p = spawn(cmd, args, { windowsHide: true });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', fail);
    p.on('close', (code) => (code === 0 ? ok() : fail(new Error(err.trim().split('\n').slice(-2).join(' ') || `${cmd} exit ${code}`))));
  });
}
async function toWebp(input, output, width) {
  // first frame only (GIF/animated), never upscale, keep aspect, even height
  await run('ffmpeg', ['-y', '-v', 'error', '-i', input, '-frames:v', '1', '-vf', `scale='min(${width},iw)':-2:flags=lanczos`, '-c:v', 'libwebp', '-quality', String(QUALITY), '-compression_level', '5', output]);
}
/** Read width/height from a WebP file header (VP8 / VP8L / VP8X). */
function webpSize(file) {
  const b = readFileSync(file);
  const chunk = b.toString('ascii', 12, 16);
  if (chunk === 'VP8X') return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
  if (chunk === 'VP8L') { const bits = b.readUInt32LE(21); return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }; }
  if (chunk === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  return { width: undefined, height: undefined };
}

async function processJob(job) {
  const n = slotFor(job.placeId, job.url);
  pending.set(job.url, { placeId: job.placeId, n });
  const rel = `images/${job.placeId}/${n}.webp`, relSm = `images/${job.placeId}/${n}-sm.webp`;
  const tmp = join(tmpdir(), `sfimg-${randomBytes(6).toString('hex')}`);
  let lastErr;
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { buf, kind } = await download(job.url, attempt === 0 ? undefined : job.referer);
        writeFileSync(tmp, buf);
        mkdirSync(join(PUBLIC, 'images', job.placeId), { recursive: true });
        try {
          await toWebp(tmp, join(PUBLIC, rel), MAX_W);
          await toWebp(tmp, join(PUBLIC, relSm), THUMB_W);
        } catch (e) { throw new HttpError(`ffmpeg: ${e.message.slice(0, 160)}`, true); }
        const { width, height } = webpSize(join(PUBLIC, rel));
        const bytes = statSync(join(PUBLIC, rel)).size;
        cache[job.url] = { status: 'ok', placeId: job.placeId, file: rel, thumb: relSm, width, height, bytes, sourceFormat: kind, fetchedAt: new Date().toISOString().slice(0, 10) };
        return { ok: true, small: width && width < 600 };
      } catch (e) {
        lastErr = e;
        // retry once: a 403/hotlink block often passes with the page as Referer; transient errors may clear
      }
    }
    const permanent = !!lastErr?.permanent;
    cache[job.url] = { status: permanent ? 'dead' : 'failed', placeId: job.placeId, error: lastErr?.message || String(lastErr), fetchedAt: new Date().toISOString().slice(0, 10) };
    for (const f of [rel, relSm]) if (existsSync(join(PUBLIC, f)) && !Object.values(cache).some((c) => c.status === 'ok' && (c.file === f || c.thumb === f))) rmSync(join(PUBLIC, f));
    return { ok: false, permanent, error: lastErr?.message };
  } finally {
    pending.delete(job.url);
    if (existsSync(tmp)) rmSync(tmp);
    if (++dirty >= 10) saveCache();
  }
}

// ---------------------------------------------------------------- run pool
const failures = [];
let done = 0, okCount = 0, smallCount = 0;
const t0 = Date.now();
let next = 0;
async function worker() {
  while (next < todo.length) {
    const job = todo[next++];
    const r = await processJob(job);
    done++;
    if (r.ok) { okCount++; if (r.small) smallCount++; } else failures.push({ ...job, ...r });
    if (done % 10 === 0 || done === todo.length) process.stdout.write(`[images] ${done}/${todo.length} (${okCount} ok, ${failures.length} failed)\n`);
  }
}
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, worker));
saveCache();

// ---------------------------------------------------------------- report
console.log(`\n[images] done in ${((Date.now() - t0) / 1000).toFixed(1)} s: ${okCount} converted, ${failures.length} failed${smallCount ? `, ${smallCount} narrower than 600 px (low-res)` : ''}.`);
if (failures.length) {
  console.log('\nFailure report (dead = dropped at build; failed = retried next run):');
  for (const f of failures) console.log(`  ${f.permanent ? 'dead  ' : 'failed'} ${f.placeId.padEnd(28)} ${f.error}\n         ${f.url}`);
}
const byPlace = {};
for (const c of Object.values(cache)) if (c.status === 'ok') byPlace[c.placeId] = (byPlace[c.placeId] || 0) + 1;
const thin = Object.entries(byPlace).filter(([, n]) => n < 3);
if (thin.length) console.log(`\nPlaces with < 3 local images: ${thin.map(([id, n]) => `${id} (${n})`).join(', ')}`);
