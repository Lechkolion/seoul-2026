/**
 * Single source of truth for place data.
 * Research workers write `data/places/<file>.json` as `PlaceInput[]`.
 * `scripts/build-data.mjs` validates, dedupes, computes `route` from home,
 * and emits `public/data/places.json` as `Place[]` for the app.
 */

export type Category =
  | 'food' // restaurants of every cuisine
  | 'cafe' // cafés, desserts, bakeries, tea
  | 'bar' // bars, pubs, clubs, nightlife
  | 'sight' // landmarks, palaces, museums, parks, viewpoints, neighborhoods
  | 'shopping' // malls, department stores, flagships, markets
  | 'experience' // activities, entertainment, high-tech attractions, classes
  | 'wellness' // spas, jjimjilbang, saunas, massage
  | 'event'; // time-limited things happening 23–30 Sep 2026

/** Chuseok / trip-window day status. */
export type DayStatus = 'open' | 'closed' | 'short' | 'unknown';

export interface Rating {
  score?: number; // as displayed by the source (TripAdvisor/Google: 0–5)
  count?: number; // number of reviews on that platform
  rank?: string; // e.g. "#12 of 14,000 restaurants in Seoul" (TripAdvisor)
  url: string; // page the number came from
}

export interface NaverSignal {
  score?: number; // only if Naver actually shows a star score
  visitorReviews?: number; // 방문자 리뷰 count
  blogReviews?: number; // 블로그 리뷰 count
  keywords?: string[]; // top "이런 점이 좋았어요" phrases, Korean ok
  url: string;
}

export interface Review {
  source: 'TripAdvisor' | 'Google' | 'Naver' | 'Kakao' | 'Michelin' | 'Blog' | 'Press';
  text: string; // ≤ 220 chars. Short quote or faithful paraphrase.
  paraphrased: boolean; // true if not verbatim
  lang: 'en' | 'ko';
  author?: string;
  date?: string; // YYYY-MM or YYYY-MM-DD
  url?: string;
}

export interface PlaceImage {
  url: string; // direct image URL (https). After media pass: local path under /images/
  source: string; // page where the image appears (for credit)
  credit: string; // e.g. "Wikimedia Commons / User:Foo (CC BY-SA 4.0)" or "Official website"
  alt: string; // describe what is shown
  width?: number;
  height?: number;
  thumb?: string; // 640w local thumbnail (media pass)
  remoteUrl?: string; // original remote URL (media pass)
}

export interface Station {
  name: string; // English, e.g. "Sinsa"
  nameKo: string; // 신사역
  lines: string[]; // e.g. ["3", "Sinbundang"] — use ids from data/taxonomy.json subwayLines
  exit?: string; // "Exit 8"
  walkMin: number; // walking minutes station → place
}

export interface PlaceInput {
  id: string; // kebab-case, unique, e.g. "mingles", "lotte-world-tower-seoul-sky"
  name: string; // English / romanized
  nameKo: string; // Korean name as on Naver Map
  category: Category;
  subcategory: string; // e.g. "Korean BBQ", "Italian", "Cocktail bar", "Palace", "Department store"
  cuisine?: string[]; // food/cafe: from taxonomy.cuisines
  tags: string[]; // from taxonomy.tags (free extra tags allowed, keep few)
  vibes: string[]; // from taxonomy.vibes
  summary: string; // one line hook ≤ 140 chars — what it is + why go
  description: string; // 3–5 sentences, concrete, no fluff
  highlights: string[]; // 2–5 must-order / must-see
  tips: string[]; // 꿀팁: 1–4 insider tips (queue hacks, best seat, what locals order, timing)
  badges: {
    valueForMoney?: boolean; // 가성비
    hiddenGem?: boolean; // locals love it, few foreigners
    localFavorite?: boolean;
    futuristic?: boolean; // high-tech / futuristic / design-forward
    familyFriendly?: boolean; // works for a group of 5 incl. parents
    michelin?: 'star3' | 'star2' | 'star1' | 'bib' | 'selected';
    blueRibbon?: number; // Blue Ribbon Survey ribbons 1–3
    asias50best?: boolean; // Asia's 50 Best (restaurants or bars) listed 2024–2026
    mustSee?: boolean;
  };
  ratings: {
    tripadvisor?: Rating;
    google?: Rating;
    naver?: NaverSignal;
    kakao?: Rating;
  };
  reviews: Review[]; // 2–4
  price: {
    level: 1 | 2 | 3 | 4; // ₩ <15k, ₩₩ 15–40k, ₩₩₩ 40–100k, ₩₩₩₩ 100k+ per person (food/bar); for sights: admission
    perPersonKRW?: [number, number];
    note?: string; // e.g. "Free", "Adults ₩34,000", "Lunch course ₩180,000"
  };
  hours: {
    weekly?: Partial<Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', string>>; // "11:30-22:00", "closed", "24h", "11:30-15:00,17:00-22:00"
    lastOrder?: string;
    note?: string;
  };
  /** Status for every trip day. Chuseok = 09-24..09-26 (25th is Chuseok day). */
  tripDays: Partial<Record<'2026-09-23' | '2026-09-24' | '2026-09-25' | '2026-09-26' | '2026-09-27' | '2026-09-28' | '2026-09-29' | '2026-09-30', DayStatus>>;
  chuseok: {
    status: 'open' | 'closed' | 'partial' | 'unknown'; // summary across 24–26 Sep
    note: string; // plain-English explanation, e.g. "Closed 25 Sep only (Chuseok day); open 24 & 26."
    verified: boolean; // true only if an official 2026 notice / venue post confirms it
    source?: string;
  };
  location: {
    address: string; // English road address
    addressKo: string; // Korean road address (for taxi drivers)
    district: string; // e.g. "Gangnam-gu"
    neighborhood: string; // e.g. "Apgujeong Rodeo", "Seongsu", "Hannam"
    lat: number;
    lng: number;
    nearestStation?: Station;
  };
  links: {
    website?: string;
    instagram?: string;
    naverMap?: string;
    kakaoMap?: string;
    googleMaps?: string;
    tripadvisor?: string;
    reservation?: string; // CatchTable / Tabling / official booking
    phone?: string; // "+82-2-..."
  };
  images: PlaceImage[]; // aim 4–8, minimum 2
  duration?: string; // suggested time, e.g. "1.5–2 h"
  bestTime?: string; // e.g. "Sunset", "Weekday lunch before 11:30"
  goodFor: string[]; // from taxonomy.goodFor
  reservation?: { recommended: boolean; how?: string };
  eventDates?: { start: string; end: string }; // category === 'event' only
  sources: string[]; // URLs used for facts
  lastVerified: string; // YYYY-MM-DD
}

export interface RouteLeg {
  type: 'walk' | 'subway' | 'transfer';
  line?: string; // subway line id
  from?: string;
  to?: string;
  stops?: number;
  minutes: number;
  express?: boolean; // e.g. Line 9 express
}

export interface Route {
  totalMin: number; // door to door by subway (or walk if faster)
  transfers: number;
  lines: string[]; // ordered distinct subway line ids used
  homeStation: string; // e.g. "Nambu Bus Terminal"
  legs: RouteLeg[];
  walkOnly?: boolean;
  outOfTown?: boolean; // beyond the metro: car/taxi time, see tips for bus/train
  taxi: { minutes: number; distanceKm: number; fareKRW: number; taxisNeeded: number; note: string };
  straightKm: number;
}

export interface Place extends PlaceInput {
  route: Route;
}
