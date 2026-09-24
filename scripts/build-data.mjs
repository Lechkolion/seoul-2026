#!/usr/bin/env node
/**
 * Data pipeline: data/places/*.json (PlaceInput[]) → public/data/places.json (Place[]) + meta.json + home.enc.json
 *
 *   node scripts/build-data.mjs             # strict: any validation error fails the build
 *   node scripts/build-data.mjs --lenient   # drop invalid records (warn), keep the rest
 *   node scripts/build-data.mjs --pretty    # indented places.json (debugging)
 *
 * Steps: validate → normalize (line aliases, trimmed strings) → dedupe (id, nameKo/name within 150 m;
 * richer record wins) → merge data/media-cache.json (local WebP images from fetch-images.mjs) →
 * route from home (scripts/transit/router.mjs) → deterministic sort → write.
 *
 * Privacy: exact home address/coords come only from data/home.private.json (gitignored). They are
 * encrypted (AES-256-GCM, PBKDF2-SHA256 200k, key from FAMILY_PASSCODE in env or .env.local) into
 * public/data/home.enc.json and never written in plain text. The script fails if they leak into public/data.
 * Zero dependencies.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pbkdf2Sync, randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto';
import { validateFiles, listPlaceFiles, loadFile, validateRecord, normalizeLine, haversineM, CATEGORIES } from './validate-places.mjs';
import { createRouter } from './transit/router.mjs';
import { loadHome } from './transit/home.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.OUT_DIR ? resolve(process.env.OUT_DIR) : join(ROOT, 'public', 'data'); // override for tests
const args = process.argv.slice(2);
const LENIENT = args.includes('--lenient');
const PRETTY = args.includes('--pretty');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));
const log = (...a) => console.log('[build-data]', ...a);
const warn = (...a) => console.warn('[build-data] WARN', ...a);

const trip = readJson(join(ROOT, 'data', 'trip.json'));
const taxonomy = readJson(join(ROOT, 'data', 'taxonomy.json'));

// ---------------------------------------------------------------- 1. load + validate
const files = listPlaceFiles();
log(`${files.length} place file(s): ${files.map((f) => f.split(/[\\/]/).pop()).join(', ') || '(none)'}`);
const { results, fileErrors, stats } = validateFiles(files);
for (const fe of fileErrors) warn(`${fe.file}: ${fe.error} — file skipped`);
const DUP_RE = /^(duplicate id|probable duplicate of)/;
if (!LENIENT && stats.errors) {
  for (const r of results.filter((x) => x.errors.length)) for (const e of r.errors) console.error(`  ${r.file} ${r.id ?? '#' + r.index}: ${e}`);
  console.error(`[build-data] ${stats.errors} validation error(s) in ${stats.withErrors} record(s). Fix them or run with --lenient.`);
  process.exit(1);
}

const records = [];
let dropped = 0;
for (const f of files) {
  const { records: recs, error } = loadFile(f);
  if (error) continue;
  const rel = relative(ROOT, f).replace(/\\/g, '/');
  recs.forEach((rec, index) => {
    if (!rec || typeof rec !== 'object' || String(rec.id || '').startsWith('sample-')) return;
    const res = results.find((r) => r.file === rel && r.index === index);
    const errs = (res ? res.errors : validateRecord(rec).errors).filter((e) => !DUP_RE.test(e));
    if (errs.length) { dropped++; warn(`drop ${rel} ${rec.id ?? '#' + index}: ${errs.slice(0, 3).join('; ')}${errs.length > 3 ? ` (+${errs.length - 3} more)` : ''}`); return; }
    records.push({ rec, file: rel });
  });
}

// ---------------------------------------------------------------- 2. normalize
const TRIP_DAYS = trip.tripDays.map((d) => d.date);
function normalize(p) {
  const q = structuredClone(p);
  for (const k of ['name', 'nameKo', 'summary', 'description', 'subcategory']) if (typeof q[k] === 'string') q[k] = q[k].trim();
  const ns = q.location?.nearestStation;
  if (ns?.lines) ns.lines = [...new Set(ns.lines.map((l) => normalizeLine(l) || l))];
  q.tripDays = Object.fromEntries(TRIP_DAYS.map((d) => [d, q.tripDays?.[d] || 'unknown']));
  q.tags = [...new Set(q.tags || [])];
  q.vibes = [...new Set(q.vibes || [])];
  return q;
}

// ---------------------------------------------------------------- 3. dedupe
const richness = (p) => (p.images?.length || 0) * 2 + (p.reviews?.length || 0) + Object.keys(p.ratings || {}).length * 2 + (p.sources?.length || 0) * 0.5 + (p.description?.length || 0) / 500;
const normKo = (s) => (s || '').replace(/[\s·()\[\]\-_.,'"&]/g, '').replace(/(본점|점)$/, '').toLowerCase();
const kept = [];
let dupes = 0;
for (const cand of records.map((r) => ({ ...r, rec: normalize(r.rec) }))) {
  const i = kept.findIndex((k) => {
    if (k.rec.id === cand.rec.id) return true;
    const same = (normKo(k.rec.nameKo) && normKo(k.rec.nameKo) === normKo(cand.rec.nameKo)) || k.rec.name.toLowerCase() === cand.rec.name.toLowerCase();
    return same && haversineM(k.rec.location, cand.rec.location) < 150;
  });
  if (i < 0) { kept.push(cand); continue; }
  dupes++;
  const winner = richness(cand.rec) > richness(kept[i].rec) ? cand : kept[i];
  const loser = winner === cand ? kept[i] : cand;
  warn(`duplicate: keep ${winner.rec.id} (${winner.file}), drop ${loser.rec.id} (${loser.file})`);
  kept[i] = winner;
}

// ---------------------------------------------------------------- 4. media cache (local images)
const cachePath = join(ROOT, 'data', 'media-cache.json');
const media = existsSync(cachePath) ? readJson(cachePath) : {};
let localImgs = 0, deadImgs = 0, insecureImgs = 0;
/** Cache-bust local images: phones cache them CacheFirst, and a file can be replaced under the same name. */
function versioned(file) {
  const abs = join(ROOT, 'public', file);
  if (!existsSync(abs)) return file;
  const st = statSync(abs);
  return `${file}?v=${createHash('md5').update(`${st.size}:${st.mtimeMs}`).digest('hex').slice(0, 8)}`;
}

function withMedia(p) {
  const images = [];
  for (const im of p.images || []) {
    const m = media[im.url];
    if (m?.status === 'dead') { deadImgs++; continue; }
    if (m?.status === 'ok' && m.file && existsSync(join(ROOT, 'public', m.file))) {
      localImgs++;
      images.push({ ...im, url: versioned(m.file), thumb: m.thumb && versioned(m.thumb), remoteUrl: im.url, width: m.width, height: m.height });
    } else if (/^https:\/\//i.test(im.url)) images.push(im);
    else insecureImgs++; // http-only remote image would be blocked as mixed content on the https site
  }
  // never publish a place with zero images because of a dead-link pass: keep originals then
  return { ...p, images: images.length ? images : p.images };
}

// ---------------------------------------------------------------- 5. routes
const { home, private: homeIsPrivate } = loadHome(ROOT, trip);
const router = createRouter({ home, trip });
for (const hs of router.homeStations) if (hs.offsetM > 50) warn(`home station ${hs.nameKo} in trip.json is ${hs.offsetM} m from the network dataset`);

const catOrder = (c) => { const i = CATEGORIES.indexOf(c); return i < 0 ? 99 : i; };
const places = kept
  .map(({ rec }) => withMedia(rec))
  .map((p) => ({ ...p, route: router.route(p) }))
  .sort((a, b) => catOrder(a.category) - catOrder(b.category) || a.id.localeCompare(b.id));

// ---------------------------------------------------------------- 6. write
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'places.json'), PRETTY ? JSON.stringify(places, null, 2) : JSON.stringify(places));

const counts = Object.fromEntries(CATEGORIES.map((c) => [c, places.filter((p) => p.category === c).length]));
// public trip: whitelist home fields (no address / coordinates of the home itself)
const publicTrip = structuredClone(trip);
publicTrip.home = {
  label: trip.home.label,
  neighborhood: trip.home.neighborhood,
  stations: trip.home.stations.map(({ name, nameKo, lines, lat, lng, walkMin }) => ({ name, nameKo, lines, lat, lng, walkMin })),
};
const meta = {
  generatedAt: new Date().toISOString(),
  total: places.length,
  counts,
  stats: {
    withTripAdvisor: places.filter((p) => p.ratings?.tripadvisor?.score != null).length,
    chuseokVerified: places.filter((p) => p.chuseok?.verified).length,
    images: places.reduce((n, p) => n + p.images.length, 0),
    localImages: localImgs,
    walkOnly: places.filter((p) => p.route.walkOnly).length,
    routesFromExactHome: homeIsPrivate,
  },
  transit: { source: 'OpenStreetMap contributors (ODbL) — scripts/transit', taxiFareSource: 'https://news.seoul.go.kr/traffic/archives/1659' },
  trip: publicTrip,
  taxonomy,
};
writeFileSync(join(OUT, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');

// ---------------------------------------------------------------- 7. encrypted home
function readPasscode() {
  if (process.env.FAMILY_PASSCODE) return process.env.FAMILY_PASSCODE;
  const envFile = join(ROOT, '.env.local');
  if (!existsSync(envFile)) return null;
  const line = readFileSync(envFile, 'utf8').split(/\r?\n/).find((l) => /^\s*FAMILY_PASSCODE\s*=/.test(l));
  return line ? line.replace(/^\s*FAMILY_PASSCODE\s*=\s*/, '').replace(/^['"]|['"]$/g, '').trim() || null : null;
}
const ENC = { v: 1, alg: 'AES-256-GCM', kdf: 'PBKDF2-SHA256', iter: 200000 };
const deriveKey = (pass, salt, iter) => pbkdf2Sync(Buffer.from(pass.normalize('NFC'), 'utf8'), salt, iter, 32, 'sha256');
function decrypt(enc, pass) {
  const ct = Buffer.from(enc.ct, 'base64');
  const d = createDecipheriv('aes-256-gcm', deriveKey(pass, Buffer.from(enc.salt, 'base64'), enc.iter), Buffer.from(enc.iv, 'base64'));
  d.setAuthTag(ct.subarray(ct.length - 16));
  return Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]).toString('utf8');
}
function encrypt(plain, pass) {
  const salt = randomBytes(16), iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', deriveKey(pass, salt, ENC.iter), iv);
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final(), c.getAuthTag()]); // WebCrypto layout: ciphertext ‖ 16-byte tag
  return { ...ENC, salt: salt.toString('base64'), iv: iv.toString('base64'), ct: ct.toString('base64') };
}
const privFile = join(ROOT, 'data', 'home.private.json');
const encFile = join(OUT, 'home.enc.json');
const passcode = readPasscode();
let homePrivate = null;
if (!existsSync(privFile)) warn('data/home.private.json missing — home.enc.json not (re)generated.');
else if (!passcode) warn('FAMILY_PASSCODE not set (env or .env.local) — home.enc.json not (re)generated.');
else {
  homePrivate = readJson(privFile);
  const plain = JSON.stringify({ label: trip.home.label, neighborhood: trip.home.neighborhood, ...homePrivate });
  let reuse = false;
  if (existsSync(encFile)) {
    try { const old = readJson(encFile); reuse = old.iter === ENC.iter && decrypt(old, passcode) === plain; } catch { reuse = false; }
  }
  if (reuse) log('home.enc.json unchanged (same passcode + content) — kept to avoid churn.');
  else {
    const enc = encrypt(plain, passcode);
    if (decrypt(enc, passcode) !== plain) throw new Error('home encryption round-trip failed');
    writeFileSync(encFile, JSON.stringify(enc) + '\n');
    log(`wrote ${relative(ROOT, encFile).replace(/\\/g, '/')} (AES-256-GCM, PBKDF2-SHA256 200k).`);
  }
}

// ---------------------------------------------------------------- 8. privacy guard
if (homePrivate) {
  const needles = [homePrivate.address, homePrivate.addressKo, homePrivate.lat != null && String(homePrivate.lat), homePrivate.lng != null && String(homePrivate.lng)]
    .filter((s) => typeof s === 'string' && s.length >= 6);
  const leaks = [];
  for (const f of readdirSync(OUT).filter((x) => x.endsWith('.json') && x !== 'home.enc.json')) {
    const txt = readFileSync(join(OUT, f), 'utf8');
    for (const n of needles) {
      const re = new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?!\\d)'); // e.g. 127.01 must not match 127.015
      if (re.test(txt)) leaks.push(`${f} contains "${n.slice(0, 4)}…"`);
    }
  }
  if (leaks.length) { console.error(`[build-data] PRIVACY: home data leaked into public/data: ${leaks.join('; ')}`); process.exit(2); }
}

// ---------------------------------------------------------------- summary
const rt = places.filter((p) => !p.route.walkOnly).map((p) => p.route.totalMin).sort((a, b) => a - b);
log(`places.json: ${places.length} places (${Object.entries(counts).filter(([, n]) => n).map(([c, n]) => `${c} ${n}`).join(', ') || 'none'})`);
log(`dropped ${dropped} invalid, ${dupes} duplicate(s); images: ${localImgs} local, ${deadImgs} dead removed, ${insecureImgs} http-only (not yet localized) removed`);
if (rt.length) log(`routes: median ${rt[rt.length >> 1]} min, max ${rt.at(-1)} min; walk-only ${meta.stats.walkOnly}${homeIsPrivate ? '' : ' (APPROXIMATE: home.private.json missing)'}`);
