#!/usr/bin/env node
/**
 * Calibrate router.mjs against Naver Map public-transit quotes (weekday 11:00 departure).
 *
 *   node scripts/transit/calibrate.mjs            # uses cached Naver answers if present
 *   node scripts/transit/calibrate.mjs --refresh  # re-query Naver (1 request / 1.5 s)
 *
 * Origin = Nambu Bus Terminal STATION coordinates (never the private home address).
 * Goal = destination STATION coordinates, subway-only fastest path. Naver's duration starts when the first train
 * departs (no initial platform wait) and includes its own short walks, so we compare like-for-like:
 *   comparable model minutes = ride + transfer minutes (initial wait excluded) + Naver's own walking minutes.
 * Production routes still add the initial wait (WAIT_MIN) — a real cost for the family.
 * Naver's web endpoint is unofficial; answers are cached in calibration.json with the query time.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRouter, WAIT_MIN } from './router.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const OUT = join(HERE, 'calibration.json');
const DEPART = '2026-09-28T11:00:00'; // Monday, normal weekday

const trip = JSON.parse(readFileSync(join(ROOT, 'data', 'trip.json'), 'utf8'));
const nambu = trip.home.stations.find((s) => s.nameKo === '남부터미널역');

const REFS = [
  ['Myeongdong', 37.5636, 126.985, '명동역', 4],
  ['Gyeongbokgung Palace gate', 37.5796, 126.977, '경복궁역', 5],
  ['Hongdae street', 37.5563, 126.9236, '홍대입구역', 3],
  ['Lotte World Tower', 37.5126, 127.1025, '잠실역', 5],
  ['Seongsu café street', 37.5445, 127.056, '성수역', 3],
  ['Itaewon street', 37.5345, 126.9946, '이태원역', 2],
  ['Gangnam Station', 37.498, 127.0276, '강남역', 2],
  ['COEX', 37.5115, 127.0595, '삼성역', 5],
  ['The Hyundai Seoul (Yeouido)', 37.5259, 126.9284, '여의도역', 7],
  ['Apgujeong Rodeo', 37.5273, 127.0405, '압구정로데오역', 3],
  ['Seoul Station', 37.5547, 126.9707, '서울역', 2],
  ['DDP Dongdaemun', 37.5665, 127.0092, '동대문역사문화공원역', 3],
];

async function naver(goal) {
  const u = `https://map.naver.com/p/api/directions/pubtrans?start=${nambu.lng},${nambu.lat}&goal=${goal.lng},${goal.lat}&crs=EPSG:4326&mode=TIME&lang=ko&departureTime=${DEPART}&includeDetailOperation=true`;
  const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36', Referer: 'https://map.naver.com/', Accept: 'application/json' } });
  if (!r.ok) throw new Error(`Naver HTTP ${r.status}`);
  const j = await r.json();
  const subway = (j.paths || []).filter((p) => p.type === 'SUBWAY').sort((a, b) => a.duration - b.duration);
  const p = subway[0];
  if (!p) return null;
  const lines = [];
  for (const leg of p.legs || []) for (const st of leg.steps || []) if (st.type === 'SUBWAY') for (const rt of st.routes || []) lines.push(rt.name);
  return { minutes: p.duration, walking: p.walkingDuration, waiting: p.waitingDuration, lines: [...new Set(lines)], fare: p.fare };
}

const cached = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { trips: {} };
const refresh = process.argv.includes('--refresh');
const calibTrip = { ...trip, home: { ...trip.home, stations: [{ ...nambu, walkMin: 0 }] } };
const router = createRouter({ home: { lat: nambu.lat, lng: nambu.lng }, trip: calibTrip });

const rows = [];
for (const [name, , , ko] of REFS) {
  const st = router.stations.filter((x) => x.nameKo === ko).sort((a, b) => b.lines.length - a.lines.length)[0];
  const { lat, lng } = st;
  let ref = cached.trips[name];
  if (!ref || refresh) {
    ref = await naver({ lat, lng });
    ref = ref && { ...ref, queriedAt: new Date().toISOString(), departure: DEPART };
    cached.trips[name] = ref;
    await new Promise((r) => setTimeout(r, 1500));
  }
  const r = router.route({ name, location: { lat, lng, nearestStation: { nameKo: ko, name: '', lines: [], walkMin: 0 } } });
  const firstWait = WAIT_MIN[r.lines[0]] ?? WAIT_MIN.default;
  const rideXfer = r.legs.filter((l) => l.type !== 'walk').reduce((a, l) => a + l.minutes, 0) - firstWait;
  const model = ref ? Math.round(rideXfer + ref.walking) : null;
  rows.push({ name: `Nambu → ${ko}`, naver: ref?.minutes, naverLines: ref?.lines?.join('→'), model, modelLines: r.lines.join('→'), err: ref ? model - ref.minutes : null, doorModel: r.totalMin });
}
cached.source = 'Naver Map web transit directions (map.naver.com/p/api/directions/pubtrans), subway-only fastest path, weekday 11:00';
writeFileSync(OUT, JSON.stringify(cached, null, 1) + '\n');

console.log('trip'.padEnd(30), 'naver', 'model', ' err', ' naver lines / model lines');
for (const x of rows) console.log(x.name.padEnd(30), String(x.naver ?? '-').padStart(5), String(x.model).padStart(5), String(x.err ?? '-').padStart(4), ` ${x.naverLines} / ${x.modelLines}`);
const errs = rows.filter((x) => x.err != null).map((x) => x.err);
const mae = errs.reduce((s, e) => s + Math.abs(e), 0) / errs.length;
const bias = errs.reduce((s, e) => s + e, 0) / errs.length;
console.log(`\n${errs.length} trips: mean abs error ${mae.toFixed(1)} min, bias ${bias >= 0 ? '+' : ''}${bias.toFixed(1)} min (positive = model slower)`);
