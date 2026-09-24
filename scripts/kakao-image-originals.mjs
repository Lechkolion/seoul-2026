#!/usr/bin/env node
/** Rewrite Kakao Map thumbnail URLs (img1.kakaocdn.net/cthumb/...?fname=...) to the full-size https original. */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(import.meta.dirname, '..', 'data', 'places');
let n = 0;
for (const f of readdirSync(DIR).filter((x) => x.endsWith('.json'))) {
  const path = join(DIR, f);
  const raw = readFileSync(path, 'utf8');
  const places = JSON.parse(raw);
  let changed = false;
  for (const p of places) {
    for (const im of p.images ?? []) {
      const m = /^https:\/\/img\d\.kakaocdn\.net\/cthumb\/local\/[^/]+\/\?fname=(.+)$/.exec(im.url);
      if (!m) continue;
      im.url = decodeURIComponent(m[1]).replace(/^http:/, 'https:');
      changed = true;
      n++;
    }
  }
  if (changed) {
    let out = JSON.stringify(places, null, 2) + '\n';
    if (raw.includes('\r\n')) out = out.replace(/\n/g, '\r\n');
    writeFileSync(path, out);
  }
}
console.log(`kakao images upgraded to originals: ${n}`);
