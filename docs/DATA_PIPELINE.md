# Data pipeline (T1)

All scripts are zero-dependency Node ESM (Node ≥ 18; `fetch-images` needs `ffmpeg` on PATH).

| npm script | command | what it does |
|---|---|---|
| `validate` | `node scripts/validate-places.mjs [file…] [--quiet] [--json]` | Checks `PlaceInput` records. Exit 1 on errors. Duplicate checks (same id, or same `nameKo`/`name` < 150 m apart) always run across **all** `data/places/*.json`. Ignores `sample-*`. |
| `build:data` | `node scripts/build-data.mjs --lenient` | validate → normalize → dedupe → merge media cache → route → `public/data/places.json`, `meta.json`, `home.enc.json`. Without `--lenient`, any error fails the build. Output is deterministic (`meta.generatedAt` is the only timestamp). |
| `images` | `node scripts/fetch-images.mjs [--ids a,b] [--limit N] [--files …] [--retry-dead] [--force] [--dry-run]` | Downloads remote images (6 at a time, 20 s timeout, 1 retry with page Referer). Converts to WebP (≤1600 px, q78) plus a 640 px thumb in `public/images/<id>/<n>.webp` and `<n>-sm.webp`. Records the results in `data/media-cache.json`. Never rewrites research files. |

Transit: `node scripts/transit/build-network.mjs [--refresh]` rebuilds `stations.json`/`lines.json` from OpenStreetMap (ODbL). `node scripts/transit/calibrate.mjs [--refresh]` compares the router with Naver Map.

## Privacy
- `data/home.private.json` (gitignored) is the only source of the home address and coordinates. It is used for routing and taxi maths. Its encrypted form is `public/data/home.enc.json`: `{v:1, alg:'AES-256-GCM', kdf:'PBKDF2-SHA256', iter:200000, salt, iv, ct}`, where `ct` = ciphertext ‖ 16-byte tag, which is the WebCrypto layout. The plaintext is `{label, neighborhood, address, addressKo, lat, lng}`. Tested: decryption with WebCrypto works, and a wrong passcode is rejected.
- The passcode comes from the `FAMILY_PASSCODE` env var or `.env.local`. If the file or the passcode is missing, the build prints a warning and keeps the existing `home.enc.json`. The file is rewritten only when the passcode or the content changes, so repeated builds do not churn it.
- `meta.json.trip.home` is whitelisted to label, neighborhood and stations. The build exits with code 2 if the home address or coordinates appear anywhere in `public/data`.
- If `home.private.json` is missing (for example in CI), routes start from the nearest home station and `meta.stats.routesFromExactHome` is `false`. CI does not run the pipeline.

## Route model (`scripts/transit/router.mjs`)
- Graph: 528 stations and 17 lines, taken from OSM route relations. This covers Line 1 (Gyeongbu, Gyeongin and Gyeongwon branches), Line 2 (loop plus the Seongsu and Sinjeong branches), Lines 3–8, Line 5 with the Macheon and Hanam branches, Line 9 local and express, Sinbundang, Suin-Bundang, Gyeongui-Jungang, AREX all-stop, Gyeongchun, GTX-A, Ui LRT and Sillim.
- Timing:
  - Walking: 75 m/min × 1.3 detour.
  - Initial wait: half the line's headway.
  - Each hop: 0.55 min + km × 1.2 min/km. Faster lines use their own rate: Sinbundang 0.8, AREX 0.95, GTX-A 0.45, Line 9 express 0.95.
  - Transfers: 2 min walk plus the next line's wait, with per-station overrides (for example Express Bus Terminal 3↔9 = 5 min, Seoul Station ↔ AREX = 8 min).
- End station: `nearestStation`, matched by Korean name (aliases such as 이수 → 총신대입구). Otherwise the fastest of the nearest 4 stations by coordinates.
- Walk-only when walking door to door takes ≤ 20 min or is faster than the subway. In that case `homeStation` is `""`.
- Taxi fare uses the Seoul regular-taxi meter: ₩4,800 for the first 1.6 km, then ₩100 per 131 m, or ₩100 per 30 s below 15 km/h; +20% 22–23 h and 02–04 h, +40% 23–02 h (source: news.seoul.go.kr/traffic/archives/1659, updated 2026-04-03). Road km = straight km × 1.35. Minutes = road km ÷ 22 km/h × 60 + 4. The fare shown is a daytime estimate for one taxi. Shown fares are for one large taxi for all 5 (`ventiKRW` = Kakao T Venti: ₩4,000/1.5 km, ₩100 per 123 m + ₩100 per 40 s; `tadaKRW` = TADA Next: ₩5,000, ₩100 per 143 m + ₩100 per 30 s within 8 km), at 1.0× surge; `regularKRW` keeps the regular-meter estimate.
- Leg minutes add up to `totalMin`. The first subway leg includes the platform wait. Line 9 express legs carry an extra `express: true`.

## Calibration (Naver Map transit, weekday 11:00, subway-only, Nambu Bus Terminal Stn → station)
Naver's clock starts when the first train leaves. The comparison therefore leaves out the model's initial wait and uses Naver's own walk time.

| to | Naver | model | err |
|---|---|---|---|
| Myeongdong | 26 | 26 | 0 |
| Gyeongbokgung | 26 | 26 | 0 |
| Hongik Univ. | 43 | 44 | +1 |
| Jamsil | 17 | 22 | +5 |
| Seongsu | 27 | 33 | +6 |
| Itaewon | 28 | 29 | +1 |
| Gangnam | 5 | 10 | +5 |
| Samseong (COEX) | 11 | 16 | +5 |
| Yeouido | 24 | 27 | +3 |
| Apgujeong Rodeo | 18 | 22 | +4 |
| Seoul Station | 32 | 34 | +2 |
| DDP | 27 | 29 | +2 |

Mean absolute error is 2.8 min. The model runs about 3 min slower on average, which is deliberately conservative. The gap is almost entirely on transfers, because Naver assumes perfectly timed connections at Gyodae. Raw answers are in `scripts/transit/calibration.json`.

## Home stations check
Compared with the OSM stations in `trip.json`: Nambu Bus Terminal is 11 m off, Seocho 2 m and Gyodae about 40 m. All are under 50 m, so `trip.json` was not changed.

## Frontend notes
- A localized `PlaceImage` gains `thumb`, `remoteUrl`, `width` and `height`. `url` becomes the relative path `images/<id>/<n>.webp`. Add optional `thumb?` and `remoteUrl?` to the type.
- `RouteLeg` may carry `express?: true` (Line 9 express).
- Image URLs that are http-only are dropped from `places.json` unless `npm run images` has converted them to local files. Served as-is, they would be blocked as mixed content.
