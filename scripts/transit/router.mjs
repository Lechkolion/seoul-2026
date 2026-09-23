/**
 * Home → place router over the Seoul Metropolitan Subway graph (stations.json + lines.json).
 *
 *   import { createRouter } from './transit/router.mjs';
 *   const router = createRouter({ home, trip });   // home = { lat, lng } (data/home.private.json)
 *   const route = router.route(place);             // → Route (src/types/place.ts)
 *
 * Model (calibrated against Naver Map transit quotes: 12 trips from Nambu Bus Terminal, MAE 2.8 min, model
 * slightly conservative because Naver assumes timed transfers — see calibrate.mjs / calibration.json):
 *   - Walk: straight-line metres × 1.3 detour ÷ 75 m/min (older family members → unhurried pace).
 *   - Start: home → each home station (trip.json walkMin), then wait for the first train (line headway / 2).
 *   - Ride per hop: DWELL + km × MIN_PER_KM[line]   (≈ 2 min per stop on central Seoul lines).
 *   - Transfer: in-station walk (default 2 min, per-station overrides) + wait for the next line.
 *   - End: place.location.nearestStation (matched by Korean name, else nearest by coordinates) + its walkMin.
 *   - Walk-only if door-to-door walking ≤ 20 min or faster than the subway.
 *   - Taxi: road km = straight km × 1.35; minutes = road km ÷ 22 km/h × 60 + 4; Seoul 중형 daytime meter.
 * Leg minutes sum to totalMin: the first subway leg includes the platform wait; transfer legs include walk + wait.
 * Zero dependencies.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

export const WALK_M_PER_MIN = 75;
export const WALK_DETOUR = 1.3;
export const WALK_ONLY_MAX_MIN = 20;
export const OUT_OF_TOWN_KM = 20;

/** Per-hop dwell (door-open + accel/decel) in minutes, and running minutes per straight-line km. */
export const DWELL_MIN = 0.55;
export const MIN_PER_KM = { default: 1.2, SB: 0.8, AREX: 0.95, GTXA: 0.45, GJ: 1.15, GC: 1.0, SUIN: 1.2, '9X': 0.95 };
/** Average wait for a train (≈ half the daytime headway), minutes. */
export const WAIT_MIN = { default: 3, 1: 4, 2: 2.5, 9: 3.5, '9X': 4.5, SB: 3.5, SUIN: 4, GJ: 6, GC: 8, AREX: 5, GTXA: 7, UI: 3.5, SL: 3.5, 8: 3.5 };
/** In-station transfer walking minutes; default for everything not listed. */
export const TRANSFER_WALK_MIN = 2;
/** Station-specific transfer walks, keyed by station id; value = minutes or { 'L1-L2': minutes }. */
export const TRANSFER_OVERRIDES = {
  'seoul-natl-univ-of-education': 1, // Gyodae 2↔3: short stairs
  'express-bus-terminal': { '3-7': 4, '3-9': 5, '7-9': 3, '3-9X': 5, '7-9X': 3 },
  seoul: { '1-4': 3, '1-AREX': 8, '4-AREX': 8, 'GJ-AREX': 7, '1-GJ': 5, '4-GJ': 6, '1-GTXA': 7, '4-GTXA': 7, 'AREX-GTXA': 6 },
  'gimpo-intl-airport': 6,
  jamsil: 4,
  wangsimni: 4,
  'konkuk-univ': 4,
  'dongdaemun-history-culture-park-station': 4,
  'jongno-3-ga': 4,
  'chongshin-univ': 5,
  'hongik-univ': 5,
  gongdeok: 5,
  'digital-media-city': 5,
  cheongnyangni: 5,
  suseo: 5,
  gangnam: 4,
  sinnonhyeon: 4,
  sindorim: 3,
  yeouido: 3,
  'sports-complex': 4,
  seokchon: 4,
  yongsan: 5,
};
/** Common alternative Korean station names used on signs / by researchers → station id. */
export const NAME_ALIASES = { 이수: 'chongshin-univ', 이수역: 'chongshin-univ', 교대: 'seoul-natl-univ-of-education', 서울역: 'seoul', 동대문역사문화공원: 'dongdaemun-history-culture-park-station' };

export const TAXI = {
  roadFactor: 1.35,
  speedKmh: 22,
  overheadMin: 4, // hail / pick-up / drop-off
  // Seoul 중형 (regular) taxi, effective 2023-02-01, confirmed on Seoul City page updated 2026-04-03.
  baseFare: 4800, baseKm: 1.6, perDistanceWon: 100, perMeters: 131, perTimeWon: 100, perSeconds: 30,
  slowShare: 0.3, // share of trip time crawling < 15 km/h (time fare applies instead of distance fare)
  source: 'https://news.seoul.go.kr/traffic/archives/1659',
  taxisNeeded: 2,
};

const toR = Math.PI / 180;
export function haversineM(a, b) {
  const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.sqrt(s));
}
export const walkMinutes = (m) => (m * WALK_DETOUR) / WALK_M_PER_MIN;
const normKo = (s) => (s || '').replace(/\s+/g, '').replace(/\(.*?\)/g, '').replace(/역$/, '');
const r1 = (x) => Math.round(x * 10) / 10;

export function taxiEstimate(straightKm) {
  const roadKm = straightKm * TAXI.roadFactor;
  // City traffic for the first 10 km, expressway speed beyond (outlets, day trips).
  const cityKm = Math.min(roadKm, 10);
  const minutes = Math.round((cityKm / TAXI.speedKmh + Math.max(0, roadKm - 10) / 60) * 60 + TAXI.overheadMin);
  const rideMin = minutes - TAXI.overheadMin;
  // distance fare while moving, time fare for the crawling share (the meter charges one or the other)
  const movingKm = roadKm * (1 - TAXI.slowShare);
  const distFare = Math.max(0, movingKm - TAXI.baseKm) * 1000 / TAXI.perMeters * TAXI.perDistanceWon;
  const timeFare = rideMin * TAXI.slowShare * 60 / TAXI.perSeconds * TAXI.perTimeWon;
  const fare = Math.round((TAXI.baseFare + distFare + timeFare) / 100) * 100;
  return {
    minutes: Math.max(minutes, 5),
    distanceKm: r1(roadKm),
    fareKRW: fare,
    taxisNeeded: TAXI.taxisNeeded,
    note: `Daytime estimate per regular taxi (Seoul meter: ₩4,800 base; +20–40% 22:00–04:00). 5 people: take 2 regular taxis (≈₩${(fare * 2).toLocaleString('en-US')} total), or book a large taxi (Kakao T Venti / 대형택시) for all 5.`,
  };
}

export function loadNetwork() {
  const stations = JSON.parse(readFileSync(join(HERE, 'stations.json'), 'utf8')).stations;
  const lines = JSON.parse(readFileSync(join(HERE, 'lines.json'), 'utf8')).lines;
  return { stations, lines };
}

class Heap {
  constructor() { this.a = []; }
  push(x) { const a = this.a; a.push(x); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } }
    return top;
  }
  get size() { return this.a.length; }
}

/**
 * @param {{ home: {lat:number,lng:number}, trip: object, network?: {stations, lines} }} opts
 */
export function createRouter({ home, trip, network = loadNetwork() }) {
  const { stations, lines } = network;
  const byId = new Map(stations.map((s) => [s.id, s]));
  const byKo = new Map();
  for (const s of stations) { const k = normKo(s.nameKo); (byKo.get(k) || byKo.set(k, []).get(k)).push(s); }
  const lineName = (l) => (l === '9X' ? '9' : l);

  // ---- graph: node = "station|line"; '9X' = Line 9 express
  const adj = new Map(); // node → [{ to, w, kind }]
  const addEdge = (a, b, w, kind) => { (adj.get(a) || adj.set(a, []).get(a)).push({ to: b, w, kind }); };
  const stationLines = new Map(); // stationId → Set(line keys)
  const addRide = (lineKey, seq) => {
    for (let i = 1; i < seq.length; i++) {
      const A = byId.get(seq[i - 1]), B = byId.get(seq[i]);
      if (!A || !B) continue;
      const w = DWELL_MIN + (haversineM(A, B) / 1000) * (MIN_PER_KM[lineKey] ?? MIN_PER_KM.default);
      addEdge(`${A.id}|${lineKey}`, `${B.id}|${lineKey}`, w, 'ride');
      addEdge(`${B.id}|${lineKey}`, `${A.id}|${lineKey}`, w, 'ride');
      for (const s of [A, B]) (stationLines.get(s.id) || stationLines.set(s.id, new Set()).get(s.id)).add(lineKey);
    }
  };
  for (const [id, L] of Object.entries(lines)) {
    for (const p of L.patterns) addRide(id, p);
    for (const p of L.express || []) addRide(`${id}X`, p);
  }
  const transferWalk = (sid, a, b) => {
    if ((a === '9' && b === '9X') || (a === '9X' && b === '9')) return 1; // same platform
    const o = TRANSFER_OVERRIDES[sid];
    if (typeof o === 'number') return o;
    if (o) return o[`${a}-${b}`] ?? o[`${b}-${a}`] ?? TRANSFER_WALK_MIN;
    return TRANSFER_WALK_MIN;
  };
  const wait = (l) => WAIT_MIN[l] ?? WAIT_MIN.default;
  for (const [sid, set] of stationLines) {
    for (const a of set) for (const b of set) if (a !== b) addEdge(`${sid}|${a}`, `${sid}|${b}`, transferWalk(sid, a, b) + wait(b), 'transfer');
  }

  // ---- home stations
  const homeStations = trip.home.stations.map((hs) => {
    const cands = byKo.get(normKo(hs.nameKo)) || [];
    const st = cands.sort((a, b) => haversineM(a, hs) - haversineM(b, hs))[0];
    if (!st) throw new Error(`Home station ${hs.nameKo} not in network`);
    return { ...hs, station: st, offsetM: Math.round(haversineM(st, hs)) };
  });

  // ---- one multi-source Dijkstra from home over the whole network
  const dist = new Map(), prev = new Map(), origin = new Map();
  const heap = new Heap();
  for (const hs of homeStations) {
    for (const l of stationLines.get(hs.station.id) || []) {
      const n = `${hs.station.id}|${l}`, d = hs.walkMin + wait(l);
      if (d < (dist.get(n) ?? Infinity)) { dist.set(n, d); origin.set(n, hs); prev.delete(n); heap.push([d, n]); }
    }
  }
  while (heap.size) {
    const [d, n] = heap.pop();
    if (d > dist.get(n)) continue;
    for (const e of adj.get(n) || []) {
      const nd = d + e.w;
      if (nd < (dist.get(e.to) ?? Infinity)) { dist.set(e.to, nd); prev.set(e.to, { from: n, kind: e.kind, w: e.w }); origin.set(e.to, origin.get(n)); heap.push([nd, e.to]); }
    }
  }
  /** best arrival at a station over any line */
  const arrival = (sid) => {
    let best = null;
    for (const l of stationLines.get(sid) || []) { const d = dist.get(`${sid}|${l}`); if (d !== undefined && (!best || d < best.d)) best = { d, node: `${sid}|${l}` }; }
    return best;
  };

  const legsTo = (node) => {
    const path = [];
    for (let n = node; n; n = prev.get(n)?.from) path.unshift(n);
    const hs = origin.get(node);
    const legs = [{ type: 'walk', from: 'Home', to: hs.name, minutes: hs.walkMin }];
    let cur = null;
    for (let i = 0; i < path.length; i++) {
      const [sid, l] = path[i].split('|');
      const p = prev.get(path[i]);
      if (!p) { cur = { type: 'subway', line: lineName(l), from: byId.get(sid).name, to: byId.get(sid).name, stops: 0, minutes: wait(l), ...(l === '9X' ? { express: true } : {}) }; legs.push(cur); continue; }
      if (p.kind === 'ride') { cur.stops++; cur.minutes += p.w; cur.to = byId.get(sid).name; }
      else {
        // 9 ↔ 9X at one platform: keep as one Line 9 leg (wait folded in) rather than a transfer
        const [, pl] = p.from.split('|');
        if (lineName(pl) === lineName(l)) { cur.minutes += p.w; if (l === '9X') cur.express = true; continue; }
        legs.push({ type: 'transfer', from: byId.get(sid).name, to: byId.get(sid).name, line: lineName(l), minutes: p.w });
        cur = { type: 'subway', line: lineName(l), from: byId.get(sid).name, to: byId.get(sid).name, stops: 0, minutes: 0, ...(l === '9X' ? { express: true } : {}) };
        legs.push(cur);
      }
    }
    return legs;
  };

  /** Resolve the station the family should ride to for this place. */
  const resolveEnd = (place) => {
    const loc = place.location;
    const ns = loc.nearestStation;
    if (ns) {
      const aliasId = NAME_ALIASES[ns.nameKo?.trim()] || NAME_ALIASES[normKo(ns.nameKo)];
      let cands = aliasId ? [byId.get(aliasId)] : byKo.get(normKo(ns.nameKo)) || [];
      if (!cands.length && ns.name) cands = stations.filter((s) => s.name.toLowerCase() === ns.name.toLowerCase().replace(/\s+station$/, ''));
      cands = cands.filter(Boolean).map((s) => ({ s, d: haversineM(s, loc) })).sort((a, b) => a.d - b.d);
      if (cands.length && cands[0].d < 3000) {
        const walk = typeof ns.walkMin === 'number' ? ns.walkMin : Math.ceil(walkMinutes(cands[0].d));
        return [{ station: cands[0].s, walkMin: walk, matched: 'name' }];
      }
    }
    // nearest few stations by coordinates; router picks the fastest overall
    return stations
      .map((s) => ({ s, d: haversineM(s, loc) }))
      .sort((a, b) => a.d - b.d)
      .filter((x, i) => i === 0 || x.d < 1200)
      .slice(0, 4)
      .map((x) => ({ station: x.s, walkMin: Math.max(1, Math.ceil(walkMinutes(x.d))), matched: 'coords' }));
  };

  function route(place) {
    const loc = place.location;
    const straightM = haversineM(home, loc);
    const straightKm = r1(straightM / 1000);
    const taxi = taxiEstimate(straightM / 1000);
    const doorWalk = Math.max(1, Math.round(walkMinutes(straightM)));

    let best = null;
    for (const end of resolveEnd(place)) {
      const a = arrival(end.station.id);
      if (!a) continue;
      const total = a.d + end.walkMin;
      if (!best || total < best.total) best = { total, end, node: a.node };
    }
    // walking the whole way is simpler (and often faster) for short hops
    // Outside the metro network (or subway far slower than driving): drive / take a taxi.
    if (straightKm > OUT_OF_TOWN_KM && (!best || best.total > taxi.minutes * 2)) {
      return { totalMin: taxi.minutes, transfers: 0, lines: [], homeStation: '', legs: [], outOfTown: true, taxi, straightKm };
    }
    if (!best || doorWalk <= WALK_ONLY_MAX_MIN || doorWalk <= best.total) {
      return { totalMin: doorWalk, transfers: 0, lines: [], homeStation: '', legs: [{ type: 'walk', from: 'Home', to: place.name, minutes: doorWalk }], walkOnly: true, taxi, straightKm };
    }
    const legs = legsTo(best.node);
    const endStation = best.end.station;
    // at the home station itself (0 rides) the subway leg is meaningless
    const clean = legs.filter((l) => !(l.type === 'subway' && l.stops === 0));
    clean.push({ type: 'walk', from: endStation.name, to: place.name, minutes: best.end.walkMin });
    for (const l of clean) l.minutes = Math.max(1, Math.round(l.minutes));
    const totalMin = clean.reduce((s, l) => s + l.minutes, 0);
    const lineSeq = [];
    for (const l of clean) if (l.type === 'subway' && lineSeq.at(-1) !== l.line) lineSeq.push(l.line);
    return {
      totalMin,
      transfers: clean.filter((l) => l.type === 'transfer').length,
      lines: lineSeq,
      homeStation: origin.get(best.node).name,
      legs: clean,
      taxi,
      straightKm,
    };
  }

  return { route, homeStations, stations, byId, arrival, resolveEnd };
}

// ---------- CLI: node scripts/transit/router.mjs <lat> <lng> [stationNameKo] ----------
const isMain = process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === (await import('node:path')).resolve(process.argv[1]).toLowerCase();
if (isMain) {
  const ROOT = join(HERE, '..', '..');
  const trip = JSON.parse(readFileSync(join(ROOT, 'data', 'trip.json'), 'utf8'));
  const { loadHome } = await import('./home.mjs');
  const { home } = loadHome(ROOT, trip);
  const [lat, lng, ko] = process.argv.slice(2);
  if (!lat) { console.log('usage: node scripts/transit/router.mjs <lat> <lng> [nearestStationKo]'); process.exit(1); }
  const r = createRouter({ home, trip });
  const place = { name: 'Destination', location: { lat: +lat, lng: +lng, ...(ko ? { nearestStation: { nameKo: ko, name: '', lines: [], walkMin: undefined } } : {}) } };
  console.log(JSON.stringify(r.route(place), null, 2));
}
