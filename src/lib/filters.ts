import Fuse from 'fuse.js';
import type { Category, Place, TripDate } from './types';
import { CHUSEOK_DAYS } from './trip';
import { dayStatus, isOpenOn, ratingKey, reviewCount } from './place-utils';

export type SortKey = 'rating' | 'reviews' | 'time' | 'price' | 'name';
export type BadgeKey = 'value' | 'gem' | 'futuristic' | 'michelin' | 'family' | 'local' | 'must';

export const BADGE_LABEL: Record<BadgeKey, string> = {
  value: '가성비 value',
  gem: 'Hidden gem',
  futuristic: 'Futuristic',
  michelin: 'Michelin',
  family: 'Family-friendly',
  local: 'Local favourite',
  must: 'Must-see',
};

export const SORT_LABEL: Record<SortKey, string> = {
  rating: 'Top rated',
  reviews: 'Most reviewed',
  time: 'Closest to home',
  price: 'Price: low to high',
  name: 'Name A–Z',
};

/** Palaces, temples, hanok and other traditional heritage sights. */
export const isHeritage = (p: Place) => p.tags.includes('palace') || (p.vibes.includes('traditional') && (p.category === 'sight' || p.category === 'event'));

export interface Filters {
  q: string;
  cat: Category[];
  cuisine: string[];
  vibe: string[];
  tag: string[];
  price: number[];
  rating: number; // min score (0 = any)
  time: number; // max minutes (0 = any)
  day: TripDate | '';
  chuseok: boolean;
  modern: boolean; // hide palaces / temples / hanok heritage
  badge: BadgeKey[];
  sort: SortKey;
}

export const EMPTY: Filters = {
  q: '', cat: [], cuisine: [], vibe: [], tag: [], price: [], rating: 0, time: 0, day: '', chuseok: false, modern: false, badge: [], sort: 'rating',
};

const list = (v: string | null) => (v ? v.split(',').filter(Boolean) : []);

export function parseFilters(sp: URLSearchParams): Filters {
  return {
    q: sp.get('q') ?? '',
    cat: list(sp.get('cat')) as Category[],
    cuisine: list(sp.get('cuisine')),
    vibe: list(sp.get('vibe')),
    tag: list(sp.get('tag')),
    price: list(sp.get('price')).map(Number).filter((n) => n >= 1 && n <= 4),
    rating: Number(sp.get('rating')) || 0,
    time: Number(sp.get('time')) || 0,
    day: (sp.get('day') as TripDate) || '',
    chuseok: sp.get('chuseok') === '1',
    modern: sp.get('modern') === '1',
    badge: list(sp.get('badge')) as BadgeKey[],
    sort: (sp.get('sort') as SortKey) || 'rating',
  };
}

export function filtersToParams(f: Filters, keep?: URLSearchParams): URLSearchParams {
  const sp = new URLSearchParams();
  if (keep?.get('view')) sp.set('view', keep.get('view')!);
  if (f.q) sp.set('q', f.q);
  if (f.cat.length) sp.set('cat', f.cat.join(','));
  if (f.cuisine.length) sp.set('cuisine', f.cuisine.join(','));
  if (f.vibe.length) sp.set('vibe', f.vibe.join(','));
  if (f.tag.length) sp.set('tag', f.tag.join(','));
  if (f.price.length) sp.set('price', f.price.join(','));
  if (f.rating) sp.set('rating', String(f.rating));
  if (f.time) sp.set('time', String(f.time));
  if (f.day) sp.set('day', f.day);
  if (f.chuseok) sp.set('chuseok', '1');
  if (f.modern) sp.set('modern', '1');
  if (f.badge.length) sp.set('badge', f.badge.join(','));
  if (f.sort !== 'rating') sp.set('sort', f.sort);
  return sp;
}

/** Number of active refinements excluding search, category and sort (shown on the Filters button). */
export function advancedCount(f: Filters) {
  return f.cuisine.length + f.vibe.length + f.tag.length + f.price.length + (f.rating ? 1 : 0) + (f.time ? 1 : 0) + (f.day ? 1 : 0) + (f.chuseok ? 1 : 0) + (f.modern ? 1 : 0) + f.badge.length;
}

export function hasBadge(p: Place, b: BadgeKey) {
  const x = p.badges ?? {};
  switch (b) {
    case 'value': return !!x.valueForMoney || p.tags.includes('value');
    case 'gem': return !!x.hiddenGem || p.tags.includes('hidden-gem');
    case 'futuristic': return !!x.futuristic || p.tags.includes('high-tech') || p.vibes.includes('futuristic');
    case 'michelin': return !!x.michelin || p.tags.includes('michelin');
    case 'family': return !!x.familyFriendly || p.goodFor.includes('Family of 5');
    case 'local': return !!x.localFavorite || p.tags.includes('local-favorite');
    case 'must': return !!x.mustSee;
  }
}

export function openThroughChuseok(p: Place) {
  if (p.chuseok?.status === 'open') return true;
  return CHUSEOK_DAYS.every((d) => {
    const s = dayStatus(p, d as TripDate);
    return s === 'open' || s === 'short';
  });
}

export function buildFuse(places: Place[]) {
  return new Fuse(places, {
    keys: [
      { name: 'name', weight: 3 },
      { name: 'nameKo', weight: 3 },
      { name: 'subcategory', weight: 1.5 },
      { name: 'cuisine', weight: 1.5 },
      { name: 'location.neighborhood', weight: 1.2 },
      { name: 'location.district', weight: 0.6 },
      { name: 'tags', weight: 0.8 },
      { name: 'vibes', weight: 0.6 },
      { name: 'summary', weight: 0.5 },
      { name: 'highlights', weight: 0.4 },
    ],
    threshold: 0.34,
    ignoreLocation: true,
    minMatchCharLength: 2,
  });
}

export function applyFilters(places: Place[], f: Filters, fuse?: Fuse<Place>): Place[] {
  let base: Place[] = places;
  const q = f.q.trim();
  let relevance: Map<string, number> | null = null;
  if (q && fuse) {
    const res = fuse.search(q);
    relevance = new Map(res.map((r, i) => [r.item.id, i]));
    base = res.map((r) => r.item);
  }
  const out = base.filter((p) => {
    if (f.cat.length && !f.cat.includes(p.category)) return false;
    if (f.cuisine.length && !f.cuisine.some((c) => p.cuisine?.includes(c) || p.subcategory === c)) return false;
    if (f.vibe.length && !f.vibe.some((v) => p.vibes.includes(v))) return false;
    if (f.tag.length && !f.tag.every((t) => p.tags.includes(t))) return false;
    if (f.price.length && !f.price.includes(p.price?.level)) return false;
    if (f.rating) {
      const s = p.ratings.tripadvisor?.score ?? p.ratings.google?.score ?? 0;
      if (s < f.rating) return false;
    }
    if (f.time && (p.route?.totalMin ?? 999) > f.time) return false;
    if (f.day && !isOpenOn(p, f.day)) return false;
    if (f.chuseok && !openThroughChuseok(p)) return false;
    if (f.modern && isHeritage(p)) return false;
    if (f.badge.length && !f.badge.every((b) => hasBadge(p, b))) return false;
    return true;
  });
  // Search results keep relevance order unless the user picked a non-default sort.
  if (relevance && f.sort === 'rating') return out;
  return sortPlaces(out, f.sort);
}

export function sortPlaces(list: Place[], sort: SortKey): Place[] {
  const arr = [...list];
  switch (sort) {
    case 'rating': return arr.sort((a, b) => ratingKey(b) - ratingKey(a));
    case 'reviews': return arr.sort((a, b) => reviewCount(b) - reviewCount(a));
    case 'time': return arr.sort((a, b) => (a.route?.totalMin ?? 999) - (b.route?.totalMin ?? 999));
    case 'price': return arr.sort((a, b) => a.price.level - b.price.level || ratingKey(b) - ratingKey(a));
    case 'name': return arr.sort((a, b) => a.name.localeCompare(b.name));
  }
}
