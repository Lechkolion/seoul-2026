import { useSyncExternalStore } from 'react';
import type { TripDate } from './types';

export type Plan = Partial<Record<TripDate, string[]>>;

interface State {
  saved: string[];
  plan: Plan;
  theme: 'dark' | 'light';
}

const KEY = 'sf26.state.v1';

function load(): State {
  const fallback: State = { saved: [], plan: {}, theme: 'dark' };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fallback;
    const s = JSON.parse(raw) as Partial<State>;
    return {
      saved: Array.isArray(s.saved) ? s.saved : [],
      plan: s.plan && typeof s.plan === 'object' ? s.plan : {},
      theme: s.theme === 'light' ? 'light' : 'dark',
    };
  } catch {
    return fallback;
  }
}

let state = load();
const listeners = new Set<() => void>();

function set(next: Partial<State>) {
  state = { ...state, ...next };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore quota / privacy mode */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state), () => sel(state));
}

export const actions = {
  toggleSaved(id: string) {
    const saved = state.saved.includes(id) ? state.saved.filter((x) => x !== id) : [id, ...state.saved];
    set({ saved });
  },
  save(id: string) {
    if (!state.saved.includes(id)) set({ saved: [id, ...state.saved] });
  },
  addToDay(date: TripDate, id: string) {
    const list = state.plan[date] ?? [];
    if (!list.includes(id)) set({ plan: { ...state.plan, [date]: [...list, id] } });
    actions.save(id);
  },
  removeFromDay(date: TripDate, id: string) {
    set({ plan: { ...state.plan, [date]: (state.plan[date] ?? []).filter((x) => x !== id) } });
  },
  move(date: TripDate, id: string, dir: -1 | 1) {
    const list = [...(state.plan[date] ?? [])];
    const i = list.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    set({ plan: { ...state.plan, [date]: list } });
  },
  replaceAll(saved: string[], plan: Plan) {
    set({ saved, plan });
  },
  merge(saved: string[], plan: Plan) {
    const s = [...state.saved];
    saved.forEach((id) => {
      if (!s.includes(id)) s.push(id);
    });
    const p: Plan = { ...state.plan };
    (Object.keys(plan) as TripDate[]).forEach((d) => {
      const cur = [...(p[d] ?? [])];
      (plan[d] ?? []).forEach((id) => {
        if (!cur.includes(id)) cur.push(id);
      });
      p[d] = cur;
    });
    set({ saved: s, plan: p });
  },
  setTheme(theme: 'dark' | 'light') {
    set({ theme });
    applyTheme();
  },
};

export function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', state.theme === 'dark' ? '#07080c' : '#f5f6f8');
}

/* ---------- share codec (compact, URL-safe) ---------- */
export function encodeShare(saved: string[], plan: Plan): string {
  const d: Record<string, string[]> = {};
  (Object.keys(plan) as TripDate[]).forEach((k) => {
    const list = plan[k];
    if (list && list.length) d[k.slice(8)] = list;
  });
  const bytes = new TextEncoder().encode(JSON.stringify({ s: saved, d }));
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeShare(code: string): { saved: string[]; plan: Plan } | null {
  try {
    const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
    const json = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    const o = JSON.parse(json) as { s?: unknown[]; d?: Record<string, unknown[]> };
    const plan: Plan = {};
    Object.entries(o.d ?? {}).forEach(([day, ids]) => {
      const date = `2026-09-${day.padStart(2, '0')}` as TripDate;
      if (Array.isArray(ids)) plan[date] = ids.filter((x): x is string => typeof x === 'string');
    });
    return { saved: (o.s ?? []).filter((x): x is string => typeof x === 'string'), plan };
  } catch {
    return null;
  }
}
