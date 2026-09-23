# Research protocol (all place-research workers)

Project root: `seoul-family-2026/`. Read first: `src/types/place.ts` (the schema — your output MUST match `PlaceInput`), `data/taxonomy.json`, `data/trip.json`, `docs/BRIEF.md`, and the example `data/fixtures/sample-places.json`.

## Who this is for
A family of 5 (adult children + parents) visiting Seoul **23–30 Sep 2026**, staying at **Seocho 3-dong, Seocho-gu** (≈6 min walk to Nambu Bus Terminal Stn, Line 3; ≈9 min to Seocho Stn, Line 2). They love **comfort, high-tech, clean, futuristic, design-forward places with great atmosphere**. They are foreigners but the guide should also surface places foreigners rarely find (hidden gems) and 가성비 (value) picks.

## Selection rules
1. **TripAdvisor is the primary quality signal.** Prefer places rated ≥ 4.0 on TripAdvisor with meaningful review counts. Cross-check with **Naver** (visitor/blog review counts, 이런 점이 좋았어요 keywords) and Google. Michelin Guide Seoul, Blue Ribbon, Asia's 50 Best, Visit Seoul, Korea Tourism Org are strong supporting signals.
2. Hidden gems may have few TripAdvisor reviews but must be strongly loved on Naver/Kakao (high visitor review counts). Mark `badges.hiddenGem: true` and say why in `tips`.
3. Must be **currently operating in Sep 2026** (check for closures/relocations — search 2025–2026 news/Naver posts). Drop anything closed.
4. Favor places that can seat/handle a group of 5. Mention in tips if a place is tiny / counter-only.
5. Spread across Seoul, but give extra weight to places easy from Seocho/Gangnam/Banpo/Sinsa/Apgujeong/Jamsil/Seongsu/Yongsan (Line 3 & Line 2 reach them fast). Include some near home (Seocho, Gyodae, Seoul Arts Center, Banpo, Express Bus Terminal/Shinsegae Gangnam).
6. No duplicates of places another worker owns (see "Scope" in your task). If a place straddles scopes, the owning category wins (e.g., a rooftop bar in a hotel → bars worker; a department store food hall → shopping worker).

## Honesty rules (non-negotiable)
- **Never invent** ratings, review counts, ranks, quotes, prices, hours, images, or Chuseok status. Every number must come from a page you actually saw (search snippet or fetched page). Put the page in `ratings.*.url` and `sources`.
- If a number cannot be found, **omit the field**. Missing is fine; fake is not.
- Reviews: 2–4 per place. Short verbatim excerpts (≤ 25 words) with `paraphrased:false`, or faithful paraphrases of real review themes with `paraphrased:true`. Include at least one Naver/Korean-sourced review theme when available (translate to English, keep `lang:'en'`, note source Naver).
- TripAdvisor pages often block fetchers. Use WebSearch (e.g. `"<name>" Seoul tripadvisor`) — the result snippets usually show "4.5 of 5 · 1,234 reviews · #12 of 14,500 Restaurants in Seoul". Use those numbers with the TripAdvisor URL.
- Naver no longer shows stars for most places; record `visitorReviews` / `blogReviews` counts and keywords instead.

## Chuseok & trip days (critical)
- Chuseok 2026 = **Thu 24 – Sat 26 Sep; 25 Sep is Chuseok day**. Sun 27 normal. Mon 28 is NOT a holiday.
- For each place fill `tripDays` for all 8 days 2026-09-23..30 and `chuseok` summary.
- Search for 2026 notices: `"<name>" 2026 추석 휴무`, `추석 영업`, Instagram/Naver notice posts, official site notices. If a 2026 notice exists → `verified:true` + `source`.
- If no 2026 notice: infer from regular hours and past behavior (2024/2025 Chuseok notices), set `verified:false`, and write the note honestly: e.g. "Usually closes on Chuseok day; no 2026 notice found — call ahead." Use `unknown` for days you can't judge.
- Known patterns: department stores typically close ONE day around Chuseok (check each chain's 2026 notice); palaces usually OPEN through Chuseok (Gyeongbokgung closed Tuesdays, Changdeokgung/Deoksugung closed Mondays); National Museum of Korea closes on Chuseok day; many small restaurants close 24–26; hotel restaurants & big chains usually open. Regular weekly closures (e.g. closed Mondays) must show in `tripDays`.

## Location & transit
- `location.lat/lng`: exact to ~20 m. Get from Wikipedia/Wikidata/OSM (Nominatim: `https://nominatim.openstreetmap.org/search?q=<korean address>&format=json` with a User-Agent, max 1 req/s), Google Maps links, or Naver/Kakao map data in pages. Must be inside Seoul (lat 37.4–37.7, lng 126.8–127.2) unless genuinely outside.
- `nearestStation`: name, Korean name, line ids (taxonomy.subwayLines keys), exit number if known, walking minutes. Travel time from home is computed by the build script — you don't compute it.
- `links.naverMap`: `https://map.naver.com/p/search/<URL-encoded Korean name>` is acceptable if you lack a direct place link. Same for `googleMaps`: `https://www.google.com/maps/search/?api=1&query=<encoded name + Seoul>`.

## Images (the more the better — aim 5–8, min 3)
- Direct, hotlinkable https image URLs that actually show THIS place (exterior, interior, signature dishes, views). Verify each loads: `curl -sI -A "Mozilla/5.0" <url>` → 200 + `content-type: image/*`.
- Good sources: **Wikimedia Commons** (API: `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=<name>&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1600&format=json` — use `thumburl` width 1600), official websites (og:image and gallery), Michelin Guide pages, Visit Seoul (english.visitseoul.net), VisitKorea, hotel sites, press/blog posts, TripAdvisor photo CDN (`dynamic-media-cdn.tripadvisor.com`) if reachable.
- Fill `credit` (e.g. "Wikimedia Commons · Jane Doe · CC BY-SA 4.0", "Official website", "Michelin Guide") and `source` page URL. `alt` describes the photo.
- Do NOT use AI images, stock images of a different place, logos only, or maps.
- A later media pass will download + optimize images locally — just give good URLs.

## Writing style
- English. Concrete, sensory, specific. `summary` ≤ 140 chars, starts with what it is ("Dry-aged hanwoo grilled by staff in a sleek Cheongdam room").
- `tips` = genuine 꿀팁: what locals order, how to skip queue (Tabling/CatchTable remote queue), best seat, time to go, cheaper lunch set, which exit, English menu, tax refund, parking, etc.
- Korean terms welcome with translation.

## Output
- Write a JSON array to your assigned file `data/places/<file>.json` — valid JSON, UTF-8, 2-space indent. Save progress incrementally (every ~10 places) so work is never lost.
- IDs: kebab-case, unique, no category prefix.
- `lastVerified: "2026-09-23"`.
- Validate before finishing: `node scripts/validate-places.mjs data/places/<file>.json` (if present) or at least `node -e "JSON.parse(require('fs').readFileSync('<file>','utf8'))"`.
- Your final report: count, how many with TripAdvisor ratings, how many with verified 2026 Chuseok notices, image count, notable gaps.
