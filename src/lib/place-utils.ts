import type { DayStatus, Place, PlaceImageExt, TripDate } from './types';
import { CHUSEOK_MAIN, TRIP_DATES, dowOf, seoulNow, type DowKey } from './trip';

/* ---------- assets ---------- */
export function assetUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (/^(https?:|data:|blob:)/.test(url)) return url;
  return import.meta.env.BASE_URL + url.replace(/^\.?\//, '');
}

const WIKI_THUMB = /^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\/.+\/)(\d+)px-([^/]+)$/;

/** src + srcSet for an image; `full` is the last-resort URL used if a smaller rendition fails. */
export function imgSources(img: PlaceImageExt | undefined, prefer: 'thumb' | 'full' = 'thumb') {
  if (!img) return { src: undefined, srcSet: undefined, full: undefined };
  const full = assetUrl(img.url);
  let thumb = assetUrl(img.thumb);
  let fullW = img.width ?? 1600;
  let thumbW = Math.min(640, fullW - 1);
  if (!thumb && full) {
    const m = full.match(WIKI_THUMB);
    if (m && Number(m[2]) > 500) {
      thumb = `${m[1]}500px-${m[3]}`;
      thumbW = 500;
      fullW = Number(m[2]);
    }
  }
  if (!thumb) return { src: full, srcSet: undefined, full };
  return { src: prefer === 'thumb' ? thumb : full, srcSet: `${thumb} ${thumbW}w, ${full} ${fullW}w`, full };
}

/* ---------- ratings ---------- */
export function primaryRating(p: Place): { source: 'TripAdvisor' | 'Google' | 'Kakao' | 'Naver'; score: number; count?: number } | null {
  const { tripadvisor, google, kakao, naver } = p.ratings;
  if (tripadvisor?.score) return { source: 'TripAdvisor', score: tripadvisor.score, count: tripadvisor.count };
  if (google?.score) return { source: 'Google', score: google.score, count: google.count };
  if (naver?.score) return { source: 'Naver', score: naver.score, count: naver.visitorReviews };
  if (kakao?.score) return { source: 'Kakao', score: kakao.score, count: kakao.count };
  return null;
}

/** Sort key: TripAdvisor first; Google as fallback slightly discounted. */
export function ratingKey(p: Place): number {
  const ta = p.ratings.tripadvisor;
  if (ta?.score) return ta.score + Math.min(Math.log10((ta.count ?? 1) + 1), 4) * 0.02;
  const g = p.ratings.google;
  if (g?.score) return g.score - 0.25 + Math.min(Math.log10((g.count ?? 1) + 1), 4) * 0.02;
  return 0;
}

export function reviewCount(p: Place): number {
  return (p.ratings.tripadvisor?.count ?? 0) + (p.ratings.google?.count ?? 0) + (p.ratings.naver?.visitorReviews ?? 0);
}

export function compact(n: number | undefined): string {
  if (n == null) return '';
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

export function priceLabel(level: number) {
  return '₩'.repeat(Math.max(1, Math.min(4, level)));
}

export const PRICE_HINT: Record<number, string> = {
  1: 'under ₩15k',
  2: '₩15–40k',
  3: '₩40–100k',
  4: '₩100k+',
};

/* ---------- trip days ---------- */
export function dayStatus(p: Place, date: TripDate): DayStatus {
  const s = p.tripDays?.[date];
  if (s) return s;
  if (p.category === 'event' && p.eventDates) {
    if (date < p.eventDates.start || date > p.eventDates.end) return 'closed';
  }
  const h = p.hours?.weekly?.[dowOf(date)];
  if (h && /^closed$/i.test(h.trim())) return 'closed';
  return 'unknown';
}

export function isOpenOn(p: Place, date: TripDate) {
  const s = dayStatus(p, date);
  return s === 'open' || s === 'short';
}

export function chuseokDayClosed(p: Place) {
  return dayStatus(p, CHUSEOK_MAIN) === 'closed';
}

export function closedTripDays(p: Place): TripDate[] {
  return TRIP_DATES.filter((d) => dayStatus(p, d) === 'closed');
}

/* ---------- opening hours ---------- */
type Range = [number, number];

function parseRanges(s: string | undefined): Range[] | 'closed' | '24h' | null {
  if (!s) return null;
  const t = s.trim().toLowerCase();
  if (t === 'closed' || t === '휴무') return 'closed';
  if (t.includes('24h') || t.includes('24 h') || t === '00:00-24:00') return '24h';
  const out: Range[] = [];
  const re = /(\d{1,2}):(\d{2})\s*[-–~]\s*(\d{1,2}):(\d{2})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const a = +m[1] * 60 + +m[2];
    let b = +m[3] * 60 + +m[4];
    if (b <= a) b += 24 * 60; // past midnight
    out.push([a, b]);
  }
  return out.length ? out : null;
}

const fmt = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

const PREV: Record<DowKey, DowKey> = { sun: 'sat', mon: 'sun', tue: 'mon', wed: 'tue', thu: 'wed', fri: 'thu', sat: 'fri' };

export interface OpenState {
  tone: 'open' | 'closed' | 'soon' | 'unknown';
  label: string;
}

export function openNow(p: Place): OpenState {
  const now = seoulNow();
  const trip = p.tripDays?.[now.date as TripDate];
  if (trip === 'closed') return { tone: 'closed', label: 'Closed today' };
  const weekly = p.hours?.weekly;
  if (!weekly) return { tone: 'unknown', label: p.hours?.note ? 'See hours' : 'Hours unknown' };

  // Overnight spill from yesterday.
  const prev = parseRanges(weekly[PREV[now.dow]]);
  if (Array.isArray(prev)) {
    for (const [a, b] of prev) {
      if (b > 1440 && now.minutes < b - 1440 && a < 1440) return { tone: 'open', label: `Open · until ${fmt(b)}` };
    }
  }
  const today = parseRanges(weekly[now.dow]);
  if (today === 'closed') return { tone: 'closed', label: 'Closed today' };
  if (today === '24h') return { tone: 'open', label: 'Open 24 hours' };
  if (!today) return { tone: 'unknown', label: 'Hours unknown' };
  for (const [a, b] of today) {
    if (now.minutes >= a && now.minutes < b) {
      return b - now.minutes <= 60 ? { tone: 'soon', label: `Closes soon · ${fmt(b)}` } : { tone: 'open', label: `Open · until ${fmt(b)}` };
    }
  }
  const next = today.find(([a]) => a > now.minutes);
  if (next) return { tone: 'closed', label: `Opens ${fmt(next[0])}` };
  return { tone: 'closed', label: 'Closed now' };
}

/* ---------- links ---------- */
export function mapLinks(p: Place) {
  const { lat, lng } = p.location;
  const q = encodeURIComponent(p.nameKo || p.name);
  return {
    naver: p.links.naverMap || `https://map.naver.com/p/search/${q}`,
    kakao: `https://map.kakao.com/link/to/${encodeURIComponent(p.nameKo || p.name)},${lat},${lng}`,
    kakaoPlace: p.links.kakaoMap,
    google: p.links.googleMaps || `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=transit`,
  };
}

export function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
