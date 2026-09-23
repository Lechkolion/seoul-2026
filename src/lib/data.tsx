import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type Fuse from 'fuse.js';
import type { Home, Meta, Place } from './types';
import { buildFuse } from './filters';

interface DataState {
  status: 'loading' | 'ready' | 'error';
  places: Place[];
  byId: Map<string, Place>;
  meta: Meta | null;
  fuse: Fuse<Place> | undefined;
  isMock: boolean;
  home: Home | null;
}

const Ctx = createContext<DataState | null>(null);

/** Defensive normalisation: the pipeline runs in --lenient mode, so optional arrays may be missing. */
function normalise(raw: Partial<Place>[]): Place[] {
  return raw
    .filter((p) => p && p.id && p.name && p.location && typeof p.location.lat === 'number')
    .map((p) => ({
      ...p,
      tags: p.tags ?? [],
      vibes: p.vibes ?? [],
      goodFor: p.goodFor ?? [],
      highlights: p.highlights ?? [],
      tips: p.tips ?? [],
      reviews: p.reviews ?? [],
      images: (p.images ?? []).filter((i) => i && i.url),
      badges: p.badges ?? {},
      ratings: p.ratings ?? {},
      links: p.links ?? {},
      sources: p.sources ?? [],
      tripDays: p.tripDays ?? {},
      chuseok: p.chuseok ?? { status: 'unknown', note: '', verified: false },
      hours: p.hours ?? {},
      price: p.price ?? { level: 2 },
      summary: p.summary ?? '',
      description: p.description ?? '',
      subcategory: p.subcategory ?? '',
    })) as Place[];
}

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(import.meta.env.BASE_URL + path, { cache: 'no-cache' });
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export function DataProvider({ home, children }: { home: Home | null; children: ReactNode }) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [status, setStatus] = useState<DataState['status']>('loading');
  const [isMock, setMock] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [p, m] = await Promise.all([fetchJson<Partial<Place>[]>('data/places.json'), fetchJson<Meta>('data/meta.json')]);
      let list = Array.isArray(p) && p.length ? p : null;
      let mock = false;
      if (!list && import.meta.env.DEV) {
        const mod = await import('../dev/mock-places');
        list = mod.mockPlaces as Partial<Place>[];
        mock = true;
      }
      if (!alive) return;
      if (!list) {
        setStatus('error');
        return;
      }
      setPlaces(normalise(list));
      setMeta(m);
      setMock(mock);
      setStatus('ready');
    })();
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo<DataState>(() => {
    const byId = new Map(places.map((p) => [p.id, p]));
    return { status, places, byId, meta, fuse: places.length ? buildFuse(places) : undefined, isMock, home };
  }, [places, meta, status, isMock, home]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useData outside provider');
  return v;
}
