#!/usr/bin/env node
/**
 * Validate research output (data/places/*.json, PlaceInput[]) against src/types/place.ts.
 *
 *   node scripts/validate-places.mjs                 # all data/places/*.json
 *   node scripts/validate-places.mjs data/places/food.json [more.json]
 *   node scripts/validate-places.mjs --quiet ...     # errors only, no warnings
 *   node scripts/validate-places.mjs --json ...      # machine-readable result
 *
 * Duplicate checks (id, nameKo + <150 m) always run across ALL data/places/*.json,
 * even when only one file is named, so a worker sees clashes with other workers.
 * Records whose id starts with "sample-" are ignored. Exit code 1 on any error.
 * Zero dependencies (Node ≥ 18).
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PLACES_DIR = process.env.PLACES_DIR ? resolve(process.env.PLACES_DIR) : join(ROOT, 'data', 'places'); // override for tests
const taxonomy = JSON.parse(readFileSync(join(ROOT, 'data', 'taxonomy.json'), 'utf8'));

export const CATEGORIES = ['food', 'cafe', 'bar', 'sight', 'shopping', 'experience', 'wellness', 'event'];
export const DAY_STATUS = ['open', 'closed', 'short', 'unknown'];
export const CHUSEOK_STATUS = ['open', 'closed', 'partial', 'unknown'];
export const REVIEW_SOURCES = ['TripAdvisor', 'Google', 'Naver', 'Kakao', 'Michelin', 'Blog', 'Press'];
export const MICHELIN = ['star3', 'star2', 'star1', 'bib', 'selected'];
export const TRIP_DAYS = ['2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30'];
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const BADGE_BOOLS = ['valueForMoney', 'hiddenGem', 'localFavorite', 'futuristic', 'familyFriendly', 'asias50best', 'mustSee'];
const LINK_KEYS = ['website', 'instagram', 'naverMap', 'kakaoMap', 'googleMaps', 'tripadvisor', 'reservation'];

/** Common non-canonical line spellings → taxonomy.subwayLines key. Build normalizes these. */
export const LINE_ALIASES = {
  sinbundang: 'SB', 'shinbundang': 'SB', 'suin-bundang': 'SUIN', 'suinbundang': 'SUIN', 'bundang': 'SUIN', 'suin': 'SUIN',
  'gyeongui-jungang': 'GJ', 'gyeonguijungang': 'GJ', 'gyeongui': 'GJ', 'jungang': 'GJ', 'arex': 'AREX', 'airport': 'AREX',
  'airport railroad': 'AREX', 'ui': 'UI', 'ui-sinseol': 'UI', 'ui lrt': 'UI', 'sillim': 'SL', 'gyeongchun': 'GC', 'gtx-a': 'GTXA', 'gtxa': 'GTXA',
};
for (let n = 1; n <= 9; n++) { LINE_ALIASES[`line ${n}`] = String(n); LINE_ALIASES[`line${n}`] = String(n); LINE_ALIASES[`${n}호선`] = String(n); }

export function normalizeLine(l) {
  if (typeof l !== 'string') return null;
  if (taxonomy.subwayLines[l]) return l;
  const k = l.trim().toLowerCase();
  if (LINE_ALIASES[k]) return LINE_ALIASES[k];
  const up = l.trim().toUpperCase();
  if (taxonomy.subwayLines[up]) return up;
  return null;
}

// Greater Seoul (capital area incl. Incheon airport / Suwon / Paju). Outside = error.
const BOUNDS = { latMin: 37.0, latMax: 38.0, lngMin: 126.3, lngMax: 127.7 };
// Seoul proper; outside = warning only.
const SEOUL = { latMin: 37.41, latMax: 37.72, lngMin: 126.76, lngMax: 127.19 };

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isHttps = (v) => typeof v === 'string' && /^https:\/\/[^\s/$.?#][^\s]*$/i.test(v);
const isUrlish = (v) => typeof v === 'string' && /^https?:\/\/[^\s/$.?#][^\s]*$/i.test(v);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function haversineM(a, b) {
  const R = 6371008.8, toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const normKo = (s) => (s || '').replace(/[\s·()\[\]\-_.,'"&]/g, '').replace(/(본점|점)$/, '').toLowerCase();

/** Validate one record. Returns { errors: string[], warnings: string[] }. */
export function validateRecord(p) {
  const E = [], W = [];
  const err = (m) => E.push(m), warn = (m) => W.push(m);
  if (!isObj(p)) return { errors: ['record is not an object'], warnings: [] };

  // --- identity
  if (!isStr(p.id)) err('id: missing');
  else if (!ID_RE.test(p.id)) err(`id: "${p.id}" is not kebab-case (a-z, 0-9, single hyphens)`);
  for (const k of ['name', 'nameKo', 'subcategory', 'summary', 'description', 'lastVerified']) if (!isStr(p[k])) err(`${k}: required non-empty string`);
  if (isStr(p.nameKo) && !/[가-힣]/.test(p.nameKo)) warn(`nameKo: "${p.nameKo}" contains no Hangul`);
  if (!CATEGORIES.includes(p.category)) err(`category: "${p.category}" not in ${CATEGORIES.join('|')}`);
  if (isStr(p.lastVerified) && !DATE_RE.test(p.lastVerified)) err(`lastVerified: "${p.lastVerified}" must be YYYY-MM-DD`);

  // --- text lengths
  if (isStr(p.summary) && p.summary.length > 140) warn(`summary: ${p.summary.length} chars (> 140)`);
  if (isStr(p.description) && p.description.length < 80) warn(`description: only ${p.description.length} chars (aim 3–5 sentences)`);

  // --- arrays of strings
  const strArr = (k, { min = 0, max = Infinity, required = true, vocab = null, vocabName = '' } = {}) => {
    const v = p[k];
    if (v === undefined) { if (required) err(`${k}: required array`); return; }
    if (!Array.isArray(v) || !v.every(isStr)) { err(`${k}: must be array of non-empty strings`); return; }
    if (v.length < min) (min >= 1 && required ? err : warn)(`${k}: ${v.length} items (expected ${min}${max < Infinity ? '–' + max : '+'})`);
    else if (v.length > max) warn(`${k}: ${v.length} items (expected ≤ ${max})`);
    if (vocab) { const bad = v.filter((x) => !vocab.includes(x)); if (bad.length) warn(`${k}: not in taxonomy.${vocabName}: ${bad.map((b) => JSON.stringify(b)).join(', ')}`); }
  };
  strArr('tags', { vocab: taxonomy.tags, vocabName: 'tags' });
  strArr('vibes', { vocab: taxonomy.vibes, vocabName: 'vibes' });
  strArr('highlights', { min: 2, max: 5 });
  strArr('tips', { min: 1, max: 4 });
  strArr('goodFor', { vocab: taxonomy.goodFor, vocabName: 'goodFor' });
  strArr('cuisine', { required: false, vocab: taxonomy.cuisines, vocabName: 'cuisines' });
  if ((p.category === 'food' || p.category === 'cafe') && !Array.isArray(p.cuisine)) warn('cuisine: recommended for food/cafe');

  // --- badges
  if (!isObj(p.badges)) err('badges: required object (may be {})');
  else {
    for (const k of BADGE_BOOLS) if (p.badges[k] !== undefined && typeof p.badges[k] !== 'boolean') err(`badges.${k}: must be boolean`);
    if (p.badges.michelin !== undefined && !MICHELIN.includes(p.badges.michelin)) err(`badges.michelin: "${p.badges.michelin}" not in ${MICHELIN.join('|')}`);
    if (p.badges.blueRibbon !== undefined && !(Number.isInteger(p.badges.blueRibbon) && p.badges.blueRibbon >= 1 && p.badges.blueRibbon <= 3)) err('badges.blueRibbon: integer 1–3');
    const known = new Set([...BADGE_BOOLS, 'michelin', 'blueRibbon']);
    const extra = Object.keys(p.badges).filter((k) => !known.has(k));
    if (extra.length) warn(`badges: unknown keys ${extra.join(', ')}`);
  }

  // --- ratings
  if (!isObj(p.ratings)) err('ratings: required object (may be {})');
  else {
    for (const src of ['tripadvisor', 'google', 'kakao']) {
      const r = p.ratings[src];
      if (r === undefined) continue;
      if (!isObj(r)) { err(`ratings.${src}: must be object`); continue; }
      if (r.score !== undefined && !(isNum(r.score) && r.score >= 0 && r.score <= 5)) err(`ratings.${src}.score: ${r.score} not a number 0–5`);
      if (r.count !== undefined && !(Number.isInteger(r.count) && r.count >= 0)) err(`ratings.${src}.count: must be non-negative integer`);
      if (r.rank !== undefined && !isStr(r.rank)) err(`ratings.${src}.rank: must be string`);
      if (!isUrlish(r.url)) err(`ratings.${src}.url: required http(s) URL`);
    }
    const n = p.ratings.naver;
    if (n !== undefined) {
      if (!isObj(n)) err('ratings.naver: must be object');
      else {
        if (n.score !== undefined && !(isNum(n.score) && n.score >= 0 && n.score <= 5)) err(`ratings.naver.score: ${n.score} not a number 0–5`);
        for (const k of ['visitorReviews', 'blogReviews']) if (n[k] !== undefined && !(Number.isInteger(n[k]) && n[k] >= 0)) err(`ratings.naver.${k}: must be non-negative integer`);
        if (n.keywords !== undefined && !(Array.isArray(n.keywords) && n.keywords.every(isStr))) err('ratings.naver.keywords: array of strings');
        if (!isUrlish(n.url)) err('ratings.naver.url: required http(s) URL');
      }
    }
    const extra = Object.keys(p.ratings).filter((k) => !['tripadvisor', 'google', 'naver', 'kakao'].includes(k));
    if (extra.length) warn(`ratings: unknown keys ${extra.join(', ')}`);
    if (!p.ratings.tripadvisor && !p.ratings.google && !p.ratings.naver) warn('ratings: no TripAdvisor, Google or Naver signal');
  }

  // --- reviews
  if (!Array.isArray(p.reviews)) err('reviews: required array');
  else {
    if (p.reviews.length < 2 || p.reviews.length > 4) err(`reviews: ${p.reviews.length} items (need 2–4)`);
    p.reviews.forEach((r, i) => {
      const at = `reviews[${i}]`;
      if (!isObj(r)) return err(`${at}: must be object`);
      if (!REVIEW_SOURCES.includes(r.source)) err(`${at}.source: "${r.source}" not in ${REVIEW_SOURCES.join('|')}`);
      if (!isStr(r.text)) err(`${at}.text: required`);
      else if (r.text.length > 220) warn(`${at}.text: ${r.text.length} chars (> 220)`);
      if (typeof r.paraphrased !== 'boolean') err(`${at}.paraphrased: must be boolean`);
      if (!['en', 'ko'].includes(r.lang)) err(`${at}.lang: must be "en" or "ko"`);
      if (r.date !== undefined && !/^\d{4}-\d{2}(-\d{2})?$/.test(r.date)) err(`${at}.date: "${r.date}" must be YYYY-MM or YYYY-MM-DD`);
      if (r.url !== undefined && !isUrlish(r.url)) err(`${at}.url: not an http(s) URL`);
    });
  }

  // --- price
  if (!isObj(p.price)) err('price: required object');
  else {
    if (![1, 2, 3, 4].includes(p.price.level)) err(`price.level: ${JSON.stringify(p.price.level)} must be 1|2|3|4`);
    const pp = p.price.perPersonKRW;
    if (pp !== undefined && !(Array.isArray(pp) && pp.length === 2 && pp.every((x) => isNum(x) && x >= 0) && pp[0] <= pp[1])) err('price.perPersonKRW: must be [min, max] numbers, min ≤ max');
    if (p.price.note !== undefined && typeof p.price.note !== 'string') err('price.note: must be string');
  }

  // --- hours
  if (!isObj(p.hours)) err('hours: required object (may be {})');
  else if (p.hours.weekly !== undefined) {
    if (!isObj(p.hours.weekly)) err('hours.weekly: must be object');
    else for (const [k, v] of Object.entries(p.hours.weekly)) {
      if (!WEEKDAYS.includes(k)) err(`hours.weekly: bad key "${k}" (mon..sun)`);
      else if (!isStr(v)) err(`hours.weekly.${k}: must be non-empty string`);
    }
  }

  // --- trip days
  if (!isObj(p.tripDays)) err('tripDays: required object with all 8 days');
  else {
    const missing = TRIP_DAYS.filter((d) => !(d in p.tripDays));
    if (missing.length) err(`tripDays: missing ${missing.join(', ')}`);
    for (const [d, s] of Object.entries(p.tripDays)) {
      if (!TRIP_DAYS.includes(d)) err(`tripDays: unexpected key "${d}"`);
      else if (!DAY_STATUS.includes(s)) err(`tripDays.${d}: "${s}" not in ${DAY_STATUS.join('|')}`);
    }
  }

  // --- chuseok
  if (!isObj(p.chuseok)) err('chuseok: required object');
  else {
    if (!CHUSEOK_STATUS.includes(p.chuseok.status)) err(`chuseok.status: "${p.chuseok.status}" not in ${CHUSEOK_STATUS.join('|')}`);
    if (!isStr(p.chuseok.note)) err('chuseok.note: required string');
    if (typeof p.chuseok.verified !== 'boolean') err('chuseok.verified: must be boolean');
    if (p.chuseok.verified === true && !isStr(p.chuseok.source)) warn('chuseok.verified is true but chuseok.source is missing');
    if (p.chuseok.source !== undefined && !isUrlish(p.chuseok.source)) warn('chuseok.source: not an http(s) URL');
    if (isObj(p.tripDays) && CHUSEOK_STATUS.includes(p.chuseok.status)) {
      const cs = ['2026-09-24', '2026-09-25', '2026-09-26'].map((d) => p.tripDays[d]);
      if (p.chuseok.status === 'open' && cs.includes('closed')) warn(`chuseok.status "open" but tripDays has a closed day in 24–26 (${cs.join('/')})`);
      if (p.chuseok.status === 'closed' && cs.includes('open')) warn(`chuseok.status "closed" but tripDays has an open day in 24–26 (${cs.join('/')})`);
    }
  }

  // --- location
  const L = p.location;
  if (!isObj(L)) err('location: required object');
  else {
    for (const k of ['address', 'addressKo', 'district', 'neighborhood']) if (!isStr(L[k])) err(`location.${k}: required string`);
    if (!isNum(L.lat) || !isNum(L.lng)) err('location.lat/lng: required numbers');
    else {
      if (L.lat < BOUNDS.latMin || L.lat > BOUNDS.latMax || L.lng < BOUNDS.lngMin || L.lng > BOUNDS.lngMax) err(`location: ${L.lat},${L.lng} outside greater Seoul (lat/lng swapped?)`);
      else if (L.lat < SEOUL.latMin || L.lat > SEOUL.latMax || L.lng < SEOUL.lngMin || L.lng > SEOUL.lngMax) warn(`location: ${L.lat},${L.lng} is outside Seoul proper — OK only if genuinely outside`);
    }
    const s = L.nearestStation;
    if (s === undefined) warn('location.nearestStation: missing (router will use nearest station by coordinates)');
    else if (!isObj(s)) err('location.nearestStation: must be object');
    else {
      if (!isStr(s.name)) err('location.nearestStation.name: required');
      if (!isStr(s.nameKo)) err('location.nearestStation.nameKo: required');
      if (!isNum(s.walkMin) || s.walkMin < 0) err('location.nearestStation.walkMin: required number ≥ 0');
      else if (s.walkMin > 30) warn(`location.nearestStation.walkMin: ${s.walkMin} min is unusually long`);
      if (!Array.isArray(s.lines) || s.lines.length === 0) err('location.nearestStation.lines: required non-empty array');
      else for (const l of s.lines) {
        if (taxonomy.subwayLines[l]) continue;
        const n = normalizeLine(l);
        if (n) warn(`location.nearestStation.lines: "${l}" → use taxonomy id "${n}"`);
        else err(`location.nearestStation.lines: "${l}" not a taxonomy.subwayLines id (${Object.keys(taxonomy.subwayLines).join(', ')})`);
      }
      if (s.exit !== undefined && typeof s.exit !== 'string') err('location.nearestStation.exit: must be string');
    }
  }

  // --- links
  if (!isObj(p.links)) err('links: required object');
  else {
    for (const k of LINK_KEYS) if (p.links[k] !== undefined && !isUrlish(p.links[k])) err(`links.${k}: "${p.links[k]}" not an http(s) URL`);
    for (const k of LINK_KEYS) if (isUrlish(p.links[k]) && !isHttps(p.links[k])) warn(`links.${k}: prefer https`);
    if (p.links.phone !== undefined && !/^\+?[\d\s\-()]{7,}$/.test(p.links.phone)) warn(`links.phone: "${p.links.phone}" looks odd (use +82-2-...)`);
    if (!p.links.naverMap) warn('links.naverMap: missing');
  }

  // --- images
  if (!Array.isArray(p.images)) err('images: required array');
  else {
    if (p.images.length < 3) err(`images: ${p.images.length} (minimum 3)`);
    else if (p.images.length < 5) warn(`images: ${p.images.length} (aim 5–8)`);
    const seen = new Set();
    p.images.forEach((im, i) => {
      const at = `images[${i}]`;
      if (!isObj(im)) return err(`${at}: must be object`);
      if (!isUrlish(im.url)) err(`${at}.url: must be an https URL`);
      else if (!isHttps(im.url)) warn(`${at}.url: http only — usable after "npm run images" localizes it, otherwise dropped at build (mixed content)`);
      else if (seen.has(im.url)) warn(`${at}.url: duplicate image URL`);
      else seen.add(im.url);
      if (isStr(im.url) && /^data:/i.test(im.url)) err(`${at}.url: base64/data URLs not allowed`);
      if (!isStr(im.source)) err(`${at}.source: required`);
      else if (!isUrlish(im.source)) warn(`${at}.source: not an http(s) URL`);
      if (!isStr(im.credit)) err(`${at}.credit: required`);
      if (!isStr(im.alt)) err(`${at}.alt: required`);
    });
  }

  // --- misc
  if (!Array.isArray(p.sources) || p.sources.length === 0) err('sources: required non-empty array');
  else p.sources.forEach((u, i) => { if (!isUrlish(u)) err(`sources[${i}]: "${u}" not an http(s) URL`); });
  if (p.reservation !== undefined && !(isObj(p.reservation) && typeof p.reservation.recommended === 'boolean')) err('reservation: { recommended: boolean, how?: string }');
  if (p.category === 'event') {
    const ed = p.eventDates;
    if (!isObj(ed) || !DATE_RE.test(ed.start || '') || !DATE_RE.test(ed.end || '')) err('eventDates: required {start,end} YYYY-MM-DD for events');
    else if (ed.start > ed.end) err('eventDates: start after end');
    else if (ed.end < TRIP_DAYS[0] || ed.start > TRIP_DAYS[7]) warn('eventDates: does not overlap 23–30 Sep 2026');
  } else if (p.eventDates !== undefined) warn('eventDates: only meaningful for category "event"');

  return { errors: E, warnings: W };
}

/** Load a places file. Returns { records, error }. */
export function loadFile(file) {
  try {
    const raw = readFileSync(file, 'utf8').replace(/^﻿/, '');
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return { records: [], error: 'top level must be a JSON array (PlaceInput[])' };
    return { records: data, error: null };
  } catch (e) {
    return { records: [], error: `cannot parse JSON: ${e.message}` };
  }
}

export function listPlaceFiles() {
  if (!existsSync(PLACES_DIR)) return [];
  return readdirSync(PLACES_DIR).filter((f) => f.endsWith('.json')).sort().map((f) => join(PLACES_DIR, f));
}

/**
 * Validate a set of files. Duplicate checks run against `universeFiles` (default: all place files + targets).
 * Returns { results: [{file, id, index, errors, warnings}], fileErrors: [{file, error}], stats }.
 */
export function validateFiles(targetFiles, universeFiles = listPlaceFiles()) {
  const rel = (f) => relative(ROOT, f).replace(/\\/g, '/');
  const targets = new Set(targetFiles.map((f) => resolve(f)));
  const all = [...new Set([...universeFiles.map((f) => resolve(f)), ...targets])];
  const fileErrors = [];
  const entries = []; // { file, index, rec, target }
  for (const f of all) {
    const { records, error } = loadFile(f);
    if (error) { if (targets.has(f)) fileErrors.push({ file: rel(f), error }); continue; }
    records.forEach((rec, index) => {
      if (isObj(rec) && typeof rec.id === 'string' && rec.id.startsWith('sample-')) return;
      entries.push({ file: rel(f), index, rec, target: targets.has(f) });
    });
  }
  const results = entries.map((e) => ({ file: e.file, index: e.index, id: isObj(e.rec) ? e.rec.id : undefined, target: e.target, ...validateRecord(e.rec) }));

  // cross-file duplicates
  const byId = new Map();
  results.forEach((r, i) => { if (isStr(r.id)) (byId.get(r.id) || byId.set(r.id, []).get(r.id)).push(i); });
  for (const [id, idxs] of byId) if (idxs.length > 1) {
    for (const i of idxs) {
      const others = idxs.filter((j) => j !== i).map((j) => `${results[j].file}#${results[j].index}`);
      results[i].errors.push(`duplicate id "${id}" also in ${others.join(', ')}`);
    }
  }
  for (let i = 0; i < entries.length; i++) {
    const a = entries[i].rec;
    if (!isObj(a) || !isObj(a.location) || !isNum(a.location.lat)) continue;
    for (let j = i + 1; j < entries.length; j++) {
      const b = entries[j].rec;
      if (!isObj(b) || !isObj(b.location) || !isNum(b.location.lat) || a.id === b.id) continue;
      const sameKo = normKo(a.nameKo) && normKo(a.nameKo) === normKo(b.nameKo);
      const sameEn = isStr(a.name) && isStr(b.name) && a.name.trim().toLowerCase() === b.name.trim().toLowerCase();
      if (!sameKo && !sameEn) continue;
      const d = haversineM(a.location, b.location);
      if (d < 150) {
        const msg = (o, oe) => `probable duplicate of "${o.id}" (${oe.file}#${oe.index}): same name "${sameKo ? o.nameKo : o.name}", ${Math.round(d)} m apart`;
        results[i].errors.push(msg(b, entries[j]));
        results[j].errors.push(msg(a, entries[i]));
      }
    }
  }
  const shown = results.filter((r) => r.target);
  const stats = {
    files: targets.size,
    records: shown.length,
    withErrors: shown.filter((r) => r.errors.length).length,
    withWarnings: shown.filter((r) => r.warnings.length).length,
    errors: shown.reduce((n, r) => n + r.errors.length, 0) + fileErrors.length,
    warnings: shown.reduce((n, r) => n + r.warnings.length, 0),
  };
  return { results: shown, fileErrors, stats };
}

// ---------------- CLI ----------------
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const quiet = args.includes('--quiet');
  const asJson = args.includes('--json');
  const files = args.filter((a) => !a.startsWith('--')).map((f) => resolve(f));
  const targets = files.length ? files : listPlaceFiles();
  if (!targets.length) { console.log('No data/places/*.json files found.'); process.exit(0); }
  for (const f of targets) if (!existsSync(f)) { console.error(`File not found: ${f}`); process.exit(1); }

  const { results, fileErrors, stats } = validateFiles(targets);
  if (asJson) {
    console.log(JSON.stringify({ stats, fileErrors, results: results.filter((r) => r.errors.length || r.warnings.length) }, null, 2));
    process.exit(stats.errors ? 1 : 0);
  }
  const color = process.stdout.isTTY && !process.env.NO_COLOR;
  const c = (code, s) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
  for (const fe of fileErrors) console.log(`${c(31, 'ERROR')} ${fe.file}: ${fe.error}`);
  let lastFile = null;
  for (const r of results) {
    if (!r.errors.length && (quiet || !r.warnings.length)) continue;
    if (r.file !== lastFile) { console.log(`\n${c(1, r.file)}`); lastFile = r.file; }
    console.log(`  ${c(36, r.id ?? `#${r.index}`)} ${c(90, `(#${r.index})`)}`);
    for (const m of r.errors) console.log(`    ${c(31, 'error')}  ${m}`);
    if (!quiet) for (const m of r.warnings) console.log(`    ${c(33, 'warn')}   ${m}`);
  }
  console.log(`\n${stats.files} file(s), ${stats.records} record(s): ${c(stats.errors ? 31 : 32, `${stats.errors} error(s) in ${stats.withErrors} record(s)`)}, ${stats.warnings} warning(s) in ${stats.withWarnings} record(s).`);
  process.exit(stats.errors ? 1 : 0);
}
