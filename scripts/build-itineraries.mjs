#!/usr/bin/env node
/**
 * Curated day plans: data/itineraries.json → public/data/itineraries.json
 * Adds a transit leg before every stop (home → first stop, stop → stop) and a final leg back home,
 * using the same subway router as the per-place routes. Run after build-data.mjs.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRouter, loadNetwork } from './transit/router.mjs';
import { loadHome } from './transit/home.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8').replace(/^﻿/, ''));

const trip = read('data/trip.json');
const days = read('data/itineraries.json');
const places = read('public/data/places.json');
const byId = new Map(places.map((p) => [p.id, p]));
const network = loadNetwork();
const { home } = loadHome(ROOT, trip);
const base = createRouter({ home, trip, network });

/** Route from place A to place B: treat A's nearest station as the "home" station. */
function between(a, b) {
  const end = base.resolveEnd(a)[0];
  const st = end.station;
  const pseudoTrip = { home: { stations: [{ name: st.name, nameKo: st.nameKo, lat: st.lat, lng: st.lng, walkMin: end.walkMin }] } };
  const r = createRouter({ home: a.location, trip: pseudoTrip, network }).route(b);
  for (const l of r.legs) {
    if (l.from === 'Home') l.from = a.name;
  }
  return r;
}

/** Last stop → home: the home → place route reversed. */
function backHome(p) {
  const r = structuredClone(p.route);
  r.legs = r.legs.reverse().map((l) => ({ ...l, from: l.to, to: l.from }));
  r.lines = [...r.lines].reverse();
  return r;
}

const slim = (r) => ({
  totalMin: r.totalMin,
  lines: r.lines,
  transfers: r.transfers,
  walkOnly: !!r.walkOnly,
  outOfTown: !!r.outOfTown,
  legs: r.legs,
  taxiMin: r.taxi?.minutes,
  taxiFare: r.taxi?.fareKRW,
  km: r.straightKm,
});

let problems = 0;
const out = days.map((d) => {
  const stops = [];
  let prev = null;
  for (const s of d.stops) {
    const p = byId.get(s.id);
    if (!p) { console.error(`ERR ${d.date}: unknown place id ${s.id}`); problems++; continue; }
    const status = p.tripDays?.[d.date] ?? 'unknown';
    if (status === 'closed') { console.error(`ERR ${d.date}: ${s.id} is closed that day`); problems++; }
    const leg = slim(prev ? between(prev, p) : p.route);
    stops.push({ ...s, leg, status });
    prev = p;
  }
  const home = prev ? slim(backHome(prev)) : null;
  const travelMin = stops.reduce((t, s) => t + s.leg.totalMin, 0) + (home?.totalMin ?? 0);
  return { ...d, stops, home, travelMin };
});

writeFileSync(join(ROOT, 'public/data/itineraries.json'), JSON.stringify(out));
for (const d of out) console.log(`${d.date} ${d.title}: ${d.stops.length} stops, ${d.travelMin} min travel`);
if (problems) process.exit(1);
