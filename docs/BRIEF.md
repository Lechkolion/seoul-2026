# Seoul 2026 · Family Guide — product brief

## Goal
A slick, fast, mobile-first website the family (5 people) opens on their phones during **23–30 Sep 2026** to decide where to eat, drink, see and do in Seoul — hosted online (GitHub Pages). 200+ curated places ranked primarily by **TripAdvisor**, cross-checked with **Naver**, each with photos, ratings, short reviews, 꿀팁, Chuseok closure info and how to get there from home.

## Audience
Family who loves **comfort, high-tech, clean, futuristic, design-forward places with great atmosphere**. Mixed ages (parents included) → large legible type, big touch targets, zero clutter. Foreigners, but want some places foreigners rarely find.

Home: **Seocho 3-dong** (exact address private: data/home.private.json, encrypted at build). Nearest: Nambu Bus Terminal Stn (Line 3, ~6 min walk), Seocho Stn (Line 2, ~9 min), Gyodae Stn (Lines 2/3, ~11 min). See `data/trip.json`.

Chuseok: **Thu 24 – Sat 26 Sep 2026 (25th = Chuseok day)** — closures must be impossible to miss.

## Architecture
- Vite + React + TypeScript, static SPA, **HashRouter** (GitHub Pages safe), base path configurable via `VITE_BASE` (repo name).
- Data: `data/places/*.json` (research output, `PlaceInput[]`) → `node scripts/build-data.mjs` → `public/data/places.json` (`Place[]` with computed `route`). App fetches `data/places.json` at runtime (relative URL respecting base).
- Types: `src/types/place.ts` is the contract. Do not change field names without updating every consumer.
- Transit: `scripts/transit/` builds a Seoul subway graph and routes home → each place's nearest station (walk + ride + transfers + walk), plus taxi estimate (5 people ⇒ 2 regular taxis or 1 large taxi — Kakao T Venti / 대형택시).
- Images: research gives remote URLs; `scripts/fetch-images.mjs` downloads + converts to WebP (1600w + 640w thumbs) into `public/images/<id>/`. App must work with either remote or local URLs, and show a tasteful fallback on error.
- PWA: installable, offline cache of app shell + data + viewed images (vite-plugin-pwa).
- Hosting: GitHub Pages via GitHub Actions workflow (`.github/workflows/deploy.yml`). `noindex` meta + robots.txt disallow (private family guide).

## Must-have features
1. **Home**: hero with trip countdown/day indicator ("Day 3 · Chuseok day — many places closed"), live Seoul weather (Open-Meteo, no key), Chuseok alert banner, big search, category tiles (Eat, Cafés, Bars & Night, See, Shop, Do, Relax, Happening), curated shelves: Top rated (TripAdvisor), Futuristic & high-tech, 가성비 value, Hidden gems, Near home (≤ 20 min), Open on Chuseok day, Michelin, Rainy-day.
2. **Explore** (list/grid + map toggle): instant fuzzy search (English + Korean names, cuisine, neighborhood, tags); filter chips (category, cuisine/subcategory, vibes, tags, price ₩–₩₩₩₩, min rating, max travel time from home, open on a chosen trip day, Chuseok open only, badges: value / hidden gem / futuristic / Michelin / family-friendly); sort (TripAdvisor rating, review count, travel time, price, name). Filters in URL query so lists can be shared. Result count. Mobile: bottom-sheet filter drawer.
3. **Map**: Leaflet + clean tiles (CARTO Positron/Dark Matter, no key), marker clustering, category-colored pins, home pin, tap → preview card → detail.
4. **Place detail** (full-screen sheet on mobile): swipeable photo gallery + lightbox with credits; name EN/KO; badges; ratings panel (TripAdvisor score/count/rank with link, Google, Naver review counts & keywords); summary + description; highlights; 꿀팁 box; reviews; price; hours + today status; **8-day trip strip** (23–30) coloured open/closed/short/unknown with Chuseok days marked + note + verified flag; **Getting there**: door-to-door minutes, subway line badges (official colours), step-by-step legs, exit, taxi time/fare/"2 taxis or large taxi for 5"; buttons: Naver Map, Kakao Map, Google Maps, website, reservation, call; **"Show to taxi driver"** full-screen Korean address card; save ❤ and add-to-day.
5. **Saved & Plan**: favorites (localStorage); day planner for 23–30 (assign saved places to days, reorder, per-day warnings when a place is closed that day); share via URL.
6. **Chuseok & Calendar** page: day-by-day of what's closed/open, tips for the holiday (traffic, palaces free/open, department store closure days, reserve ahead).
7. **Practical** page: home taxi card (Korean address big), apps to install (Naver Map, Kakao T, Kakao Map, Papago, CatchTable, Tabling), T-money / Climate Card, taxis for 5 people, tax refund, emergency numbers (112, 119, 1330 tourist hotline), tipping (none), Wi-Fi/eSIM, useful Korean phrases.
8. Dark/light theme (dark default fits futuristic brief; both polished), reduced-motion respect.

## Design direction
Futuristic-luxury, clean, calm: think Apple/Hyundai/Gentle Monster meets premium travel magazine. Photography dominates. Glassy translucent surfaces, fine 1px hairlines, subtle depth, one electric accent (e.g. cyan-to-violet gradient used sparingly) on a deep ink/near-black dark theme; bright clean light theme. Crisp geometric sans (e.g. "Inter Tight"/"Manrope"/"Space Grotesk" for display + "Pretendard" for Korean). Smooth micro-interactions (framer-motion), skeleton loading, no emoji UI decoration (use one icon set, e.g. lucide-react). Body ≥ 16px, controls ≥ 14px, touch targets ≥ 44px, WCAG AA contrast.

## Best practices (travel-guide sites)
- Mobile-first, thumb-reachable bottom nav; sticky search/filter bar; cards scannable in 2 s (photo, type line, name, rating, travel time, price, Chuseok badge).
- Deep-link to Naver/Kakao maps (Google Maps walking/transit directions are weak in Korea).
- Trust signals: source + "verified 2026" flags, rating source labels, last-verified date.
- Performance: lazy images with `loading="lazy"`, `srcset`, blur/skeleton placeholders, code-split map, < 200 KB JS initial if possible, Lighthouse ≥ 90 mobile.
- Offline-capable (PWA) — roaming/data can be spotty.
- Shareable URLs for places, filters and plans; back button closes sheets.
- Accessibility: semantic landmarks, focus management in dialogs, Esc closes, alt text, keyboard nav.

## Privacy / passcode gate
The repo is public (GitHub Pages). The site opens behind a family passcode screen. The exact home address/coordinates are never committed in plain text: `data/home.private.json` (gitignored) is encrypted by `scripts/build-data.mjs` into `public/data/home.enc.json` using AES-256-GCM with a PBKDF2-SHA256 (200k iterations, random salt) key derived from `FAMILY_PASSCODE` (read from `.env.local` or env). The app's gate derives the key via WebCrypto; successful decryption = unlocked (remember the derived key/passcode in localStorage). The decrypted home object powers the map home pin, "Take me home" taxi card and Practical page. Routes in places.json are precomputed and reveal only station-level info.
