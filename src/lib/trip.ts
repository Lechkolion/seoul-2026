import tripJson from '../../data/trip.json';
import taxonomyJson from '../../data/taxonomy.json';
import type { Category, Taxonomy, Trip, TripDate, TripDay } from './types';

export const trip = tripJson as unknown as Trip;
export const taxonomy = taxonomyJson as unknown as Taxonomy;

export const TRIP_DAYS: TripDay[] = trip.tripDays;
export const TRIP_DATES = TRIP_DAYS.map((d) => d.date) as TripDate[];
export const CHUSEOK_DAYS = trip.holidays.chuseok.days;
export const CHUSEOK_MAIN = trip.holidays.chuseok.mainDay as TripDate;

export const CATEGORY_ORDER: Category[] = ['food', 'cafe', 'bar', 'sight', 'shopping', 'experience', 'wellness', 'event'];

export const CATEGORY_LABEL: Record<Category, string> = taxonomy.categories;

export const CATEGORY_COLOR: Record<Category, string> = {
  food: '#ff8a5b',
  cafe: '#e9b872',
  bar: '#b794ff',
  sight: '#5ce1e6',
  shopping: '#ff7ab8',
  experience: '#7cf29c',
  wellness: '#7fb2ff',
  event: '#f5c063',
};

export function lineInfo(id: string) {
  return taxonomy.subwayLines[id] ?? { name: id, color: '#8a93a5' };
}

const DOW_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export type DowKey = (typeof DOW_KEYS)[number];
export const DOW_ORDER: DowKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/** Current wall-clock in Seoul. `?now=2026-09-25T13:00` in the hash query overrides it for testing. */
export function seoulNow(): { date: string; dow: DowKey; minutes: number; hour: number } {
  const override = new URLSearchParams(location.hash.split('?')[1] ?? '').get('now');
  if (override && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(override)) {
    const [d, t] = override.split('T');
    const [h, m] = t.split(':').map(Number);
    return { date: d, dow: dowOf(d), minutes: h * 60 + m, hour: h };
  }
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const date = `${get('year')}-${get('month')}-${get('day')}`;
  const hour = Number(get('hour')) % 24;
  const minutes = hour * 60 + Number(get('minute'));
  return { date, dow: dowOf(date), minutes, hour };
}

export function dowOf(date: string): DowKey {
  return DOW_KEYS[new Date(date + 'T12:00:00Z').getUTCDay()];
}

export interface TripPhase {
  kind: 'before' | 'during' | 'after';
  dayIndex: number; // 0-based during trip
  daysUntil: number;
  today: string;
  day?: TripDay;
}

export function tripPhase(): TripPhase {
  const { date } = seoulNow();
  const idx = TRIP_DATES.indexOf(date as TripDate);
  if (idx >= 0) return { kind: 'during', dayIndex: idx, daysUntil: 0, today: date, day: TRIP_DAYS[idx] };
  const diff = Math.round((Date.parse(trip.dates.start) - Date.parse(date)) / 86400000);
  return { kind: diff > 0 ? 'before' : 'after', dayIndex: -1, daysUntil: diff, today: date };
}

export function shortDate(date: string) {
  const d = new Date(date + 'T12:00:00Z');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function dayNum(date: string) {
  return Number(date.slice(8));
}

export function isChuseok(date: string) {
  return CHUSEOK_DAYS.includes(date);
}

export function tripDay(date: string) {
  return TRIP_DAYS.find((d) => d.date === date);
}
