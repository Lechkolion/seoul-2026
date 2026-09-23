import { lazy, Suspense, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../lib/data';
import type { Category } from '../lib/types';
import { CATEGORY_COLOR, CATEGORY_LABEL, CATEGORY_ORDER } from '../lib/trip';

const MapView = lazy(() => import('../components/MapView'));

export default function MapPage() {
  const { places, home } = useData();
  const [sp, setSp] = useSearchParams();
  const cats = (sp.get('cat') ?? '').split(',').filter(Boolean) as Category[];
  const shown = useMemo(() => (cats.length ? places.filter((p) => cats.includes(p.category)) : places), [places, cats.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (c: Category) => {
    const next = cats.includes(c) ? cats.filter((x) => x !== c) : [...cats, c];
    const p = new URLSearchParams(sp);
    if (next.length) p.set('cat', next.join(','));
    else p.delete('cat');
    setSp(p, { replace: true });
  };

  return (
    <div className="mappage">
      <h1 className="sr-only">Map of all places</h1>
      <div className="mappage__chips" role="group" aria-label="Show categories">
        {CATEGORY_ORDER.map((c) => {
          const on = cats.includes(c);
          const n = places.filter((p) => p.category === c).length;
          if (!n) return null;
          return (
            <button key={c} type="button" className={`legend ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => toggle(c)} style={{ ['--c' as string]: CATEGORY_COLOR[c] }}>
              <span className="legend__dot" aria-hidden="true" />
              {CATEGORY_LABEL[c]}
              <span className="legend__n">{n}</span>
            </button>
          );
        })}
      </div>
      <Suspense fallback={<div className="mapview mapview--loading" aria-busy="true" />}>
        <MapView places={shown} home={home} className="mapview--page" />
      </Suspense>
    </div>
  );
}
