import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LayoutGrid, Map as MapIcon, Search, SlidersHorizontal, X } from 'lucide-react';
import { useData } from '../lib/data';
import type { Category } from '../lib/types';
import { BADGE_LABEL, EMPTY, SORT_LABEL, advancedCount, applyFilters, filtersToParams, parseFilters, type Filters, type SortKey } from '../lib/filters';
import { CATEGORY_LABEL, CATEGORY_ORDER, shortDate } from '../lib/trip';
import { priceLabel } from '../lib/place-utils';
import { useOverlay } from '../lib/nav';
import { PlaceCard } from '../components/PlaceCard';
import { Dialog } from '../components/Dialog';
import { FilterPanel } from '../components/FilterPanel';
import { Skeleton } from '../components/bits';
import { CATEGORY_ICON } from '../components/icons';

const MapView = lazy(() => import('../components/MapView'));
const PAGE = 24;

export function ExplorePage() {
  const { places, fuse, status, home } = useData();
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const f = useMemo(() => parseFilters(sp), [sp]);
  const view = sp.get('view') === 'map' ? 'map' : 'grid';
  const filters = useOverlay('filters');
  const [q, setQ] = useState(f.q);
  const [limit, setLimit] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement>(null);

  const results = useMemo(() => applyFilters(places, f, fuse), [places, f, fuse]);

  const update = (patch: Partial<Filters>, replace = true) => {
    setSp(filtersToParams({ ...f, ...patch }, sp), { replace });
  };

  // Debounced search → URL.
  useEffect(() => {
    if (q === f.q) return;
    const t = setTimeout(() => update({ q }), 180);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  useEffect(() => setQ(f.q), [f.q]);
  useEffect(() => setLimit(PAGE), [sp]);

  // Infinite scroll: render in pages so 300+ cards stay fast.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || view !== 'grid') return;
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && setLimit((l) => l + PAGE), { rootMargin: '800px' });
    io.observe(el);
    return () => io.disconnect();
  }, [view, results.length, limit]);

  const setView = (v: 'grid' | 'map') => {
    const next = new URLSearchParams(sp);
    if (v === 'map') next.set('view', 'map');
    else next.delete('view');
    setSp(next, { replace: true });
  };

  const active: { key: string; label: string; clear: () => void }[] = [];
  f.badge.forEach((b) => active.push({ key: `b-${b}`, label: BADGE_LABEL[b], clear: () => update({ badge: f.badge.filter((x) => x !== b) }) }));
  if (f.chuseok) active.push({ key: 'chu', label: 'Open through Chuseok', clear: () => update({ chuseok: false }) });
  if (f.day) active.push({ key: 'day', label: `Open ${shortDate(f.day)}`, clear: () => update({ day: '' }) });
  if (f.time) active.push({ key: 'time', label: `≤ ${f.time} min`, clear: () => update({ time: 0 }) });
  if (f.rating) active.push({ key: 'rating', label: `${f.rating}+ rating`, clear: () => update({ rating: 0 }) });
  f.price.forEach((l) => active.push({ key: `p-${l}`, label: priceLabel(l), clear: () => update({ price: f.price.filter((x) => x !== l) }) }));
  f.cuisine.forEach((c) => active.push({ key: `c-${c}`, label: c, clear: () => update({ cuisine: f.cuisine.filter((x) => x !== c) }) }));
  f.vibe.forEach((c) => active.push({ key: `v-${c}`, label: c, clear: () => update({ vibe: f.vibe.filter((x) => x !== c) }) }));
  f.tag.forEach((c) => active.push({ key: `t-${c}`, label: c.replace(/-/g, ' '), clear: () => update({ tag: f.tag.filter((x) => x !== c) }) }));

  const nAdv = advancedCount(f);
  const catTitle = f.cat.length === 1 ? CATEGORY_LABEL[f.cat[0]] : 'Explore';

  return (
    <div className={`explore explore--${view}`}>
      <div className="explore__bar">
        <div className="wrap explore__barin">
          <div className="explore__row">
            <div className="search">
              <Search size={20} aria-hidden="true" />
              <label htmlFor="explore-q" className="sr-only">
                Search places
              </label>
              <input id="explore-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, 한글, cuisine, area…" enterKeyHint="search" autoComplete="off" />
              {q && (
                <button type="button" className="search__x" onClick={() => setQ('')} aria-label="Clear search">
                  <X size={18} aria-hidden="true" />
                </button>
              )}
            </div>
            <button type="button" className={`btn btn--filter ${nAdv ? 'is-on' : ''}`} onClick={() => filters.show()} aria-label={`Filters${nAdv ? `, ${nAdv} active` : ''}`}>
              <SlidersHorizontal size={20} aria-hidden="true" />
              <span className="hide-sm">Filters</span>
              {nAdv > 0 && <span className="count-dot">{nAdv}</span>}
            </button>
            <div className="seg" role="group" aria-label="View">
              <button type="button" className={view === 'grid' ? 'is-on' : ''} aria-pressed={view === 'grid'} onClick={() => setView('grid')} aria-label="List view">
                <LayoutGrid size={20} aria-hidden="true" />
              </button>
              <button type="button" className={view === 'map' ? 'is-on' : ''} aria-pressed={view === 'map'} onClick={() => setView('map')} aria-label="Map view">
                <MapIcon size={20} aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="catchips" role="group" aria-label="Category">
            <button type="button" className={`catchip ${f.cat.length === 0 ? 'is-on' : ''}`} aria-pressed={f.cat.length === 0} onClick={() => update({ cat: [], cuisine: [] }, false)}>
              All
            </button>
            {CATEGORY_ORDER.map((c) => {
              const Icon = CATEGORY_ICON[c];
              const on = f.cat.includes(c);
              return (
                <button key={c} type="button" className={`catchip ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => update({ cat: on ? f.cat.filter((x) => x !== c) : [c as Category], cuisine: [] }, false)}>
                  <Icon size={16} aria-hidden="true" />
                  {CATEGORY_LABEL[c]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="wrap explore__meta">
        <div>
          <h1 className="explore__title">{catTitle}</h1>
          <p className="explore__count" aria-live="polite">
            {status === 'loading' ? 'Loading…' : `${results.length} place${results.length === 1 ? '' : 's'}`}
            {f.q && ` for “${f.q}”`}
          </p>
        </div>
        <label className="sortsel">
          <span className="sr-only">Sort</span>
          <select value={f.sort} onChange={(e) => update({ sort: e.target.value as SortKey })}>
            {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {SORT_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {active.length > 0 && (
        <div className="wrap activechips">
          {active.map((a) => (
            <button key={a.key} type="button" className="achip" onClick={a.clear} aria-label={`Remove filter ${a.label}`}>
              {a.label}
              <X size={14} aria-hidden="true" />
            </button>
          ))}
          <button type="button" className="achip achip--clear" onClick={() => setSp(filtersToParams({ ...EMPTY, cat: f.cat }, sp), { replace: true })}>
            Clear all
          </button>
        </div>
      )}

      {view === 'grid' ? (
        <div className="wrap">
          {status === 'loading' ? (
            <div className="grid">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="card skeleton--card" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="empty">
              <p className="empty__title">Nothing matches — yet.</p>
              <p>Try removing a filter or searching in Korean.</p>
              <button type="button" className="btn btn--primary" onClick={() => nav('/explore')}>
                Reset everything
              </button>
            </div>
          ) : (
            <>
              <div className="grid">
                {results.slice(0, limit).map((p, i) => (
                  <PlaceCard key={p.id} place={p} eager={i < 2} />
                ))}
              </div>
              {limit < results.length && (
                <div ref={sentinel} className="more">
                  <button type="button" className="btn btn--ghost" onClick={() => setLimit((l) => l + PAGE)}>
                    Show more ({results.length - limit})
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="explore__map">
          <Suspense fallback={<div className="mapview mapview--loading" aria-busy="true" />}>
            <MapView places={results} home={home} />
          </Suspense>
        </div>
      )}

      <Dialog open={filters.open} onClose={filters.close} label="Filters" variant="sheet" className="dlg--filters">
        <FilterPanel
          initial={f}
          places={places}
          fuse={fuse}
          onClose={filters.close}
          onApply={(nf) => nav({ pathname: '/explore', search: filtersToParams(nf, sp).toString() }, { replace: true, state: {} })}
        />
      </Dialog>
    </div>
  );
}
