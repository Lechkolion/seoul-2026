#!/usr/bin/env node
/**
 * Build the Seoul Metropolitan Subway dataset used by the router.
 *
 *   node scripts/transit/build-network.mjs            # uses cached OSM extract if present
 *   node scripts/transit/build-network.mjs --refresh  # re-download from Overpass
 *
 * Source: OpenStreetMap public-transport route relations (route=subway|train|light_rail),
 * their ordered stop members, and railway=station nodes for names/coordinates.
 * © OpenStreetMap contributors, ODbL 1.0 — https://www.openstreetmap.org/copyright
 *
 * Output (committed, consumed by router.mjs):
 *   scripts/transit/stations.json  { source, stations: [{ id, name, nameKo, lat, lng, lines }] }
 *   scripts/transit/lines.json     { source, lines: { <taxonomyId>: { name, color, patterns: [[stationId…]], express?: [[…]] } } }
 * Zero dependencies (Node ≥ 18, global fetch).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const CACHE = join(HERE, '.osm-cache.json');
const taxonomy = JSON.parse(readFileSync(join(ROOT, 'data', 'taxonomy.json'), 'utf8'));

const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const BBOX = '37.40,126.60,37.75,127.25'; // relations touching Seoul; member stops outside are kept (clipped below)
const CLIP = { latMin: 37.0, latMax: 38.0, lngMin: 126.3, lngMax: 127.8 };

/** OSM ref (+route) → taxonomy.subwayLines id. `express` = keep as express-only patterns. */
const LINE_DEFS = [
  ...['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => ({ id: n, route: 'subway', ref: n })),
  { id: 'SB', route: 'subway', ref: '신분당' },
  { id: 'SUIN', route: 'train', ref: '수인·분당' },
  { id: 'GJ', route: 'train', ref: '경의·중앙' },
  { id: 'AREX', route: 'train', ref: '공항철도' }, // all-stop service (express uses ref "AREX", not a commuter line)
  { id: 'GC', route: 'train', ref: '경춘' },
  { id: 'GTXA', route: 'train', ref: 'GTX-A' },
  { id: 'UI', route: 'light_rail', ref: 'W' },
  { id: 'SL', route: 'light_rail', ref: 'Silim' },
];
const EXPRESS_RE = /rapid|express train|limited express|급행|특급/i; // not "Great Train eXpress" (GTX)

/**
 * Same interchange complex under different stop names (normalized keys).
 * Checked against the "close but different name" report printed by this script.
 */
const SAME_STATION = [['이수', '총신대입구']];
/** Same name but physically separate stations — never merge across these lines. */
const SEPARATE = [{ key: '신촌', lines: ['GJ'] }, { key: '양평', lines: ['GJ'] }];

const toR = Math.PI / 180;
export function haversineM(a, b) {
  const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.sqrt(s));
}
const normKey = (s) => (s || '').replace(/\s+/g, '').replace(/\(.*?\)/g, '').replace(/·.*$/, '').replace(/역$/, '');

async function fetchOsm() {
  const refs = [...new Set(LINE_DEFS.map((d) => d.ref))].map((r) => r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const q = `[out:json][timeout:300];
(relation["route"~"^(subway|train|light_rail)$"]["ref"~"^(${refs})$"](${BBOX});)->.r;
.r out body;
node(r.r);
out body;
node["railway"="station"](${BBOX});
out body;`;
  for (const url of MIRRORS) {
    try {
      process.stdout.write(`Overpass: ${url} … `);
      const res = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: q }), headers: { 'User-Agent': 'seoul-family-guide/1.0 (build script)' }, signal: AbortSignal.timeout(320000) });
      const text = await res.text();
      if (!res.ok || !text.trimStart().startsWith('{')) { console.log(`failed (${res.status})`); continue; }
      const data = JSON.parse(text);
      console.log(`ok, ${data.elements.length} elements, OSM base ${data.osm3s?.timestamp_osm_base}`);
      writeFileSync(CACHE, JSON.stringify(data));
      return data;
    } catch (e) { console.log(`error ${e.message}`); }
  }
  throw new Error('All Overpass mirrors failed');
}

// ---- minimal Revised Romanization fallback for stations without name:en ----
const CHO = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'];
const JUNG = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'];
const JONG = ['', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'k', 'm', 'l', 'l', 'l', 'p', 'l', 'm', 'p', 'p', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 't'];
function romanize(ko) {
  let out = '';
  for (const ch of ko) {
    const c = ch.codePointAt(0) - 0xac00;
    if (c < 0 || c > 11171) { out += ch; continue; }
    out += CHO[Math.floor(c / 588)] + JUNG[Math.floor((c % 588) / 28)] + JONG[c % 28];
  }
  return out.charAt(0).toUpperCase() + out.slice(1);
}
const slug = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\(.*?\)/g, '').replace(/['’.]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function main() {
  const refresh = process.argv.includes('--refresh');
  const osm = !refresh && existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : await fetchOsm();
  const nodes = new Map(osm.elements.filter((e) => e.type === 'node').map((n) => [n.id, n]));
  const stationNodes = osm.elements.filter((e) => e.type === 'node' && e.tags?.railway === 'station' && e.tags?.name);
  const rels = osm.elements.filter((e) => e.type === 'relation');
  // a few stop_position nodes carry no name: borrow it from the nearest railway=station node (< 400 m)
  const nameFromStation = (n) => {
    if (n.tags?.name) return n;
    const best = stationNodes.map((s) => [s, haversineM({ lat: n.lat, lng: n.lon }, { lat: s.lat, lng: s.lon })]).sort((a, b) => a[1] - b[1])[0];
    return best && best[1] < 400 ? { ...n, tags: { ...n.tags, name: best[0].tags.name, 'name:en': best[0].tags['name:en'] } } : null;
  };
  const inClip = (n) => n.lat >= CLIP.latMin && n.lat <= CLIP.latMax && n.lon >= CLIP.lngMin && n.lon <= CLIP.lngMax;

  // 1. per line, ordered stop-node lists
  const lineRuns = {}; // id → { normal: [[node]], express: [[node]] }
  for (const def of LINE_DEFS) {
    lineRuns[def.id] = { normal: [], express: [] };
    for (const r of rels) {
      if (r.tags.route !== def.route || r.tags.ref !== def.ref) continue;
      const label = `${r.tags.name || ''} ${r.tags['name:en'] || ''} ${r.tags.service || ''}`;
      const isExpress = def.id !== 'GTXA' && EXPRESS_RE.test(label); // "광역급행철도" is GTX's line name, not a service
      if (isExpress && def.id !== '9') continue; // only Line 9 express modelled
      let stops = r.members.filter((m) => m.type === 'node' && /^stop/.test(m.role)).map((m) => nodes.get(m.ref)).filter(Boolean);
      if (stops.length < 2) stops = r.members.filter((m) => m.type === 'node' && /^platform/.test(m.role)).map((m) => nodes.get(m.ref)).filter(Boolean);
      stops = stops.map(nameFromStation).filter((n) => n && inClip(n));
      if (stops.length < 2) continue;
      lineRuns[def.id][isExpress ? 'express' : 'normal'].push(stops);
    }
  }

  // 2. merge stop nodes into stations: same normalized Korean name within 700 m (or alias pair)
  const alias = new Map();
  for (const [a, b] of SAME_STATION) { alias.set(a, a); alias.set(b, a); }
  const canon = (k) => alias.get(k) || k;
  const stations = []; // { key, stops: [node], lines:Set }
  const nodeToStation = new Map();
  const separateFor = (key, line) => SEPARATE.some((s) => s.key === key && s.lines.includes(line));
  for (const [lineId, runs] of Object.entries(lineRuns)) {
    for (const run of [...runs.normal, ...runs.express]) for (const n of run) {
      if (nodeToStation.has(`${lineId}:${n.id}`)) continue;
      const key = canon(normKey(n.tags.name));
      const sepKey = separateFor(key, lineId) ? `${key}#${lineId}` : key;
      let st = stations.find((s) => s.key === sepKey && haversineM(s.stops[0], { lat: n.lat, lng: n.lon }) < 700);
      if (!st) { st = { key: sepKey, stops: [], lines: new Set() }; stations.push(st); }
      if (!st.stops.some((x) => x.id === n.id)) st.stops.push({ id: n.id, lat: n.lat, lng: n.lon, tags: n.tags });
      st.lines.add(lineId);
      nodeToStation.set(`${lineId}:${n.id}`, st);
    }
  }

  // 3. names + coordinates (prefer the railway=station node with the same name nearby)
  for (const st of stations) {
    const c = { lat: st.stops.reduce((a, s) => a + s.lat, 0) / st.stops.length, lng: st.stops.reduce((a, s) => a + s.lng, 0) / st.stops.length };
    const baseKey = st.key.split('#')[0];
    const sn = stationNodes
      .filter((s) => canon(normKey(s.tags.name)) === baseKey && haversineM(c, { lat: s.lat, lng: s.lon }) < 700)
      .sort((a, b) => haversineM(c, { lat: a.lat, lng: a.lon }) - haversineM(c, { lat: b.lat, lng: b.lon }))[0];
    st.lat = +(sn ? sn.lat : c.lat).toFixed(6);
    st.lng = +(sn ? sn.lon : c.lng).toFixed(6);
    const tagsList = [sn?.tags, ...st.stops.map((s) => s.tags)].filter(Boolean);
    const ko = (sn?.tags.name || st.stops[0].tags.name).replace(/\s*\(.*?\)\s*/g, '').replace(/역$/, '');
    st.nameKo = `${ko}역`;
    const en = tagsList.map((t) => t['name:en']).find(Boolean);
    st.name = (en || romanize(ko)).replace(/\s+Station$/i, '').trim();
    if (st.key.includes('#')) st.name += ` (${taxonomy.subwayLines[st.key.split('#')[1]]?.name || st.key.split('#')[1]})`;
    st.nameSource = en ? 'osm' : 'romanized';
    st.nameKoFull = sn?.tags.name || st.stops[0].tags.name;
  }
  // stable ids
  stations.sort((a, b) => a.name.localeCompare(b.name) || a.lat - b.lat);
  const used = new Map();
  for (const st of stations) {
    let id = slug(st.name) || slug(romanize(st.nameKo));
    if (used.has(id)) id = `${id}-${used.get(id) + 1}`;
    used.set(id.replace(/-\d+$/, ''), (used.get(id.replace(/-\d+$/, '')) || 0) + 1);
    st.id = id;
  }

  // 4. line patterns as station-id sequences (dedupe reversed / contained runs)
  const lines = {};
  const containsSeq = (hay, nee) => {
    const h = hay.join('|'), f = nee.join('|'), r = [...nee].reverse().join('|');
    return `|${h}|`.includes(`|${f}|`) || `|${h}|`.includes(`|${r}|`);
  };
  const toSeq = (lineId, run) => run.map((n) => nodeToStation.get(`${lineId}:${n.id}`).id).filter((id, i, a) => i === 0 || a[i - 1] !== id);
  for (const [lineId, runs] of Object.entries(lineRuns)) {
    const dedupe = (list) => {
      const seqs = list.map((r) => toSeq(lineId, r)).sort((a, b) => b.length - a.length);
      const kept = [];
      for (const s of seqs) if (!kept.some((k) => containsSeq(k, s))) kept.push(s);
      return kept;
    };
    const t = taxonomy.subwayLines[lineId];
    lines[lineId] = { name: t?.name || lineId, color: t?.color || '#888888', patterns: dedupe(runs.normal) };
    if (runs.express.length) lines[lineId].express = dedupe(runs.express);
  }

  // 5. QA report: long hops, same-name stations not merged, different-name stations very close
  const byId = new Map(stations.map((s) => [s.id, s]));
  console.log('\nQA — hops > 5 km:');
  for (const [lid, L] of Object.entries(lines)) for (const p of [...L.patterns, ...(L.express || [])]) for (let i = 1; i < p.length; i++) {
    const d = haversineM(byId.get(p[i - 1]), byId.get(p[i]));
    if (d > 5000 && !(L.express || []).includes(p)) console.log(`  ${lid}: ${byId.get(p[i - 1]).nameKo} → ${byId.get(p[i]).nameKo} ${(d / 1000).toFixed(1)} km`);
  }
  console.log('QA — distinct stations < 350 m apart (possible missed transfer merge):');
  for (let i = 0; i < stations.length; i++) for (let j = i + 1; j < stations.length; j++) {
    const d = haversineM(stations[i], stations[j]);
    if (d < 350) console.log(`  ${stations[i].nameKo}[${[...stations[i].lines]}] ↔ ${stations[j].nameKo}[${[...stations[j].lines]}] ${Math.round(d)} m`);
  }
  const roman = stations.filter((s) => s.nameSource === 'romanized');
  console.log(`Names romanized (no OSM name:en): ${roman.length}${roman.length ? ' — ' + roman.slice(0, 30).map((s) => s.name).join(', ') : ''}`);

  const lineOrder = Object.keys(taxonomy.subwayLines);
  const source = {
    name: 'OpenStreetMap public-transport route relations (route=subway|train|light_rail) + railway=station nodes, via Overpass API',
    license: '© OpenStreetMap contributors, ODbL 1.0 — https://www.openstreetmap.org/copyright',
    osmTimestamp: osm.osm3s?.timestamp_osm_base,
    notes: 'Stop positions merged into stations by Korean name within 700 m. Express/rapid services excluded except Line 9 express (lines.json "express"). Names: OSM name:en, else Revised Romanization fallback. Built by scripts/transit/build-network.mjs.',
  };
  const outStations = stations
    .map((s) => ({ id: s.id, name: s.name, nameKo: s.nameKo, lat: s.lat, lng: s.lng, lines: [...s.lines].sort((a, b) => lineOrder.indexOf(a) - lineOrder.indexOf(b)) }))
    .sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(join(HERE, 'stations.json'), JSON.stringify({ source, count: outStations.length, stations: outStations }, null, 1) + '\n');
  writeFileSync(join(HERE, 'lines.json'), JSON.stringify({ source, lines }, null, 1) + '\n');
  console.log(`\nWrote ${outStations.length} stations, ${Object.keys(lines).length} lines:`);
  for (const [id, L] of Object.entries(lines)) console.log(`  ${id.padEnd(5)} ${L.patterns.length} pattern(s): ${L.patterns.map((p) => `${byId.get(p[0]).name}→${byId.get(p.at(-1)).name} (${p.length})`).join('; ')}${L.express ? ` | express ${L.express.map((p) => p.length).join(',')}` : ''}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
