/**
 * Home location loader. Exact home coordinates live only in data/home.private.json (gitignored);
 * they are used for routing/taxi maths and never written to public/ or other committed files.
 * If the private file is missing (e.g. CI), fall back to the closest home station (trip.json) with a warning.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export function loadHome(root, trip) {
  const file = join(root, 'data', 'home.private.json');
  if (existsSync(file)) {
    const h = JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, ''));
    if (typeof h.lat === 'number' && typeof h.lng === 'number') return { home: h, private: true };
    console.warn('WARN data/home.private.json has no numeric lat/lng — falling back to nearest home station.');
  } else {
    console.warn('WARN data/home.private.json not found — routes/taxi use the nearest home station as the origin (approximate).');
  }
  const s = [...trip.home.stations].sort((a, b) => a.walkMin - b.walkMin)[0];
  return { home: { lat: s.lat, lng: s.lng }, private: false };
}
