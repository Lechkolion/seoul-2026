import { useMemo, useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import type { Place, TripDate } from '../lib/types';
import { BADGE_LABEL, EMPTY, SORT_LABEL, applyFilters, type BadgeKey, type Filters, type SortKey } from '../lib/filters';
import { TRIP_DAYS, isChuseok, taxonomy } from '../lib/trip';
import { PRICE_HINT, priceLabel } from '../lib/place-utils';
import type Fuse from 'fuse.js';
import { MoonMark } from './icons';

interface Props {
  initial: Filters;
  places: Place[];
  fuse?: Fuse<Place>;
  onApply: (f: Filters) => void;
  onClose: () => void;
}

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

function Chip({ on, onClick, children, tone }: { on: boolean; onClick: () => void; children: React.ReactNode; tone?: string }) {
  return (
    <button type="button" className={`chip ${on ? 'is-on' : ''} ${tone ? `chip--${tone}` : ''}`} aria-pressed={on} onClick={onClick}>
      {on && <Check size={14} aria-hidden="true" />}
      {children}
    </button>
  );
}

export function FilterPanel({ initial, places, fuse, onApply, onClose }: Props) {
  const [f, setF] = useState<Filters>(initial);
  const set = (patch: Partial<Filters>) => setF((x) => ({ ...x, ...patch }));
  const count = useMemo(() => applyFilters(places, f, fuse).length, [places, f, fuse]);

  // Only offer options that exist in the (category-scoped) data, most common first.
  const scope = useMemo(() => (f.cat.length ? places.filter((p) => f.cat.includes(p.category)) : places), [places, f.cat]);
  const freq = (get: (p: Place) => string[] | undefined, order?: string[]) => {
    const m = new Map<string, number>();
    scope.forEach((p) => get(p)?.forEach((v) => m.set(v, (m.get(v) ?? 0) + 1)));
    const entries = [...m.entries()];
    return order ? entries.sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0])) : entries.sort((a, b) => b[1] - a[1]);
  };
  const cuisines = freq((p) => p.cuisine, taxonomy.cuisines).filter(([k]) => taxonomy.cuisines.includes(k));
  const vibes = freq((p) => p.vibes, taxonomy.vibes).filter(([k]) => taxonomy.vibes.includes(k));
  const tags = freq((p) => p.tags).filter(([, n]) => n >= 2).slice(0, 28);

  return (
    <div className="fpanel">
      <header className="fpanel__head">
        <h2>Filters</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close filters" data-autofocus>
          <X size={22} aria-hidden="true" />
        </button>
      </header>
      <div className="fpanel__body">
        <fieldset className="fgroup">
          <legend>Sort by</legend>
          <div className="chips">
            {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
              <Chip key={k} on={f.sort === k} onClick={() => set({ sort: k })}>
                {SORT_LABEL[k]}
              </Chip>
            ))}
          </div>
        </fieldset>

        <fieldset className="fgroup">
          <legend>Chuseok &amp; trip day</legend>
          <label className="switch">
            <input type="checkbox" checked={f.modern} onChange={(e) => set({ modern: e.target.checked })} />
            <span className="switch__track" aria-hidden="true" />
            <span>Modern only — hide palaces, temples &amp; hanok</span>
          </label>
          <label className="switch">
            <input type="checkbox" checked={f.chuseok} onChange={(e) => set({ chuseok: e.target.checked })} />
            <span className="switch__track" aria-hidden="true" />
            <span>
              <MoonMark size={12} /> Open through Chuseok (24–26) only
            </span>
          </label>
          <p className="fgroup__hint">Open on a specific day:</p>
          <div className="daypick">
            {TRIP_DAYS.map((d) => (
              <button
                key={d.date}
                type="button"
                className={`daypick__d ${f.day === d.date ? 'is-on' : ''} ${isChuseok(d.date) ? 'is-chuseok' : ''}`}
                aria-pressed={f.day === d.date}
                onClick={() => set({ day: f.day === d.date ? '' : (d.date as TripDate) })}
              >
                <span>{d.dow}</span>
                <b>{Number(d.date.slice(8))}</b>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="fgroup">
          <legend>Highlights</legend>
          <div className="chips">
            {(Object.keys(BADGE_LABEL) as BadgeKey[]).map((b) => (
              <Chip key={b} on={f.badge.includes(b)} onClick={() => set({ badge: toggle(f.badge, b) })}>
                {BADGE_LABEL[b]}
              </Chip>
            ))}
          </div>
        </fieldset>

        <fieldset className="fgroup">
          <legend>Price per person</legend>
          <div className="chips">
            {[1, 2, 3, 4].map((l) => (
              <Chip key={l} on={f.price.includes(l)} onClick={() => set({ price: toggle(f.price, l) })}>
                <b className="mono">{priceLabel(l)}</b>
                <span className="chip__sub">{PRICE_HINT[l]}</span>
              </Chip>
            ))}
          </div>
        </fieldset>

        <fieldset className="fgroup">
          <legend>Minimum rating</legend>
          <div className="chips">
            {[0, 4, 4.3, 4.5].map((r) => (
              <Chip key={r} on={f.rating === r} onClick={() => set({ rating: r })}>
                {r ? `${r.toFixed(1)}+` : 'Any'}
              </Chip>
            ))}
          </div>
        </fieldset>

        <fieldset className="fgroup">
          <legend>Travel time from home</legend>
          <div className="chips">
            {[0, 20, 30, 45, 60].map((t) => (
              <Chip key={t} on={f.time === t} onClick={() => set({ time: t })}>
                {t ? `≤ ${t} min` : 'Any'}
              </Chip>
            ))}
          </div>
        </fieldset>

        {cuisines.length > 0 && (
          <fieldset className="fgroup">
            <legend>Cuisine</legend>
            <div className="chips">
              {cuisines.map(([c, n]) => (
                <Chip key={c} on={f.cuisine.includes(c)} onClick={() => set({ cuisine: toggle(f.cuisine, c) })}>
                  {c} <span className="chip__n">{n}</span>
                </Chip>
              ))}
            </div>
          </fieldset>
        )}

        {vibes.length > 0 && (
          <fieldset className="fgroup">
            <legend>Vibe</legend>
            <div className="chips">
              {vibes.map(([v, n]) => (
                <Chip key={v} on={f.vibe.includes(v)} onClick={() => set({ vibe: toggle(f.vibe, v) })}>
                  {v} <span className="chip__n">{n}</span>
                </Chip>
              ))}
            </div>
          </fieldset>
        )}

        {tags.length > 0 && (
          <fieldset className="fgroup">
            <legend>Tags (match all)</legend>
            <div className="chips">
              {tags.map(([t, n]) => (
                <Chip key={t} on={f.tag.includes(t)} onClick={() => set({ tag: toggle(f.tag, t) })}>
                  {t.replace(/-/g, ' ')} <span className="chip__n">{n}</span>
                </Chip>
              ))}
            </div>
          </fieldset>
        )}
      </div>
      <footer className="fpanel__foot">
        <button type="button" className="btn btn--ghost" onClick={() => setF({ ...EMPTY, q: f.q, cat: f.cat })}>
          <RotateCcw size={18} aria-hidden="true" /> Reset
        </button>
        <button type="button" className="btn btn--primary" onClick={() => onApply(f)}>
          Show {count} place{count === 1 ? '' : 's'}
        </button>
      </footer>
    </div>
  );
}
