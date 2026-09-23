import type { Category, DayStatus, Place, PlaceImage } from '../types/place';

export type { Category, DayStatus, Place, PlaceImage };

/** Image as emitted by the media pass (optional small rendition). */
export type PlaceImageExt = PlaceImage & { thumb?: string };

export type TripDate =
  | '2026-09-23' | '2026-09-24' | '2026-09-25' | '2026-09-26'
  | '2026-09-27' | '2026-09-28' | '2026-09-29' | '2026-09-30';

export interface TripDay {
  date: TripDate;
  dow: string;
  label: string;
  holiday?: boolean;
  main?: boolean;
}

export interface HomeStation {
  name: string;
  nameKo: string;
  lines: string[];
  lat: number;
  lng: number;
  walkMin: number;
}

export interface Trip {
  title: string;
  travellers: number;
  dates: { start: string; end: string };
  home: { label: string; neighborhood?: string; stations: HomeStation[] };
  holidays: { chuseok: { days: string[]; mainDay: string; note: string; sources: string[] } };
  tripDays: TripDay[];
}

export interface Taxonomy {
  categories: Record<Category, string>;
  cuisines: string[];
  vibes: string[];
  tags: string[];
  goodFor: string[];
  subwayLines: Record<string, { name: string; color: string }>;
}

/** Decrypted from public/data/home.enc.json after the passcode gate. */
export interface Home {
  label?: string;
  address: string;
  addressKo: string;
  lat: number;
  lng: number;
}

export interface EncBlob {
  v: number;
  alg: string;
  kdf: string;
  iter: number;
  salt: string;
  iv: string;
  ct: string;
}

export interface Meta {
  generatedAt?: string;
  count?: number;
  [k: string]: unknown;
}
