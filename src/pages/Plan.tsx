import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, CircleAlert, Heart, Link2, Trash2, X } from 'lucide-react';
import { useData } from '../lib/data';
import type { Place, TripDate } from '../lib/types';
import { TRIP_DAYS, isChuseok } from '../lib/trip';
import { dayStatus } from '../lib/place-utils';
import { actions, decodeShare, encodeShare, useStore } from '../lib/store';
import { PlaceCard } from '../components/PlaceCard';
import { Img } from '../components/Img';
import { MoonMark } from '../components/icons';
import { TimeChip } from '../components/bits';
import { usePlaceOpener } from '../lib/nav';

function DayCard({ date, places }: { date: TripDate; places: Place[] }) {
  const d = TRIP_DAYS.find((x) => x.date === date)!;
  const openPlace = usePlaceOpener();
  const closed = places.filter((p) => dayStatus(p, date) === 'closed');
  const unsure = places.filter((p) => dayStatus(p, date) === 'unknown' && isChuseok(date));
  return (
    <section className={`dayc ${isChuseok(date) ? 'is-chuseok' : ''} ${d.main ? 'is-main' : ''}`} aria-labelledby={`day-${date}`}>
      <header className="dayc__head">
        <span className="dayc__num">{Number(date.slice(8))}</span>
        <div>
          <h3 id={`day-${date}`} className="dayc__dow">
            {d.dow} {isChuseok(date) && <MoonMark size={14} className="moon-inline" />}
          </h3>
          <p className="dayc__label">{d.label}</p>
        </div>
        <span className="dayc__n">{places.length || ''}</span>
      </header>
      {closed.length > 0 && (
        <p className="dayc__warn" role="note">
          <CircleAlert size={16} aria-hidden="true" /> {closed.map((p) => p.name).join(', ')} {closed.length > 1 ? 'are' : 'is'} closed this day.
        </p>
      )}
      {unsure.length > 0 && (
        <p className="dayc__warn dayc__warn--soft" role="note">
          <MoonMark size={12} /> Chuseok hours unconfirmed for {unsure.map((p) => p.name).join(', ')} — call ahead.
        </p>
      )}
      {places.length === 0 ? (
        <p className="dayc__empty">Nothing planned yet.</p>
      ) : (
        <ol className="dayc__list">
          {places.map((p, i) => {
            const s = dayStatus(p, date);
            return (
              <li key={p.id} className={`pitem is-${s}`}>
                <button type="button" className="pitem__main" onClick={() => openPlace(p.id)}>
                  <Img img={p.images[0]} category={p.category} name={p.name} sizes="64px" className="pitem__img" />
                  <span className="pitem__txt">
                    <span className="pitem__name">{p.name}</span>
                    <span className="pitem__meta">
                      <TimeChip place={p} />
                      {s === 'closed' && <span className="warn">Closed</span>}
                      {s === 'short' && <span className="warn warn--soft">Short hours</span>}
                    </span>
                  </span>
                </button>
                <span className="pitem__ctl">
                  <button type="button" className="icon-btn icon-btn--sm" onClick={() => actions.move(date, p.id, -1)} disabled={i === 0} aria-label={`Move ${p.name} earlier`}>
                    <ArrowUp size={18} aria-hidden="true" />
                  </button>
                  <button type="button" className="icon-btn icon-btn--sm" onClick={() => actions.move(date, p.id, 1)} disabled={i === places.length - 1} aria-label={`Move ${p.name} later`}>
                    <ArrowDown size={18} aria-hidden="true" />
                  </button>
                  <button type="button" className="icon-btn icon-btn--sm" onClick={() => actions.removeFromDay(date, p.id)} aria-label={`Remove ${p.name} from ${d.dow} ${Number(date.slice(8))}`}>
                    <X size={18} aria-hidden="true" />
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export function PlanPage() {
  const { byId, status } = useData();
  const saved = useStore((s) => s.saved);
  const plan = useStore((s) => s.plan);
  const [sp, setSp] = useSearchParams();
  const [copied, setCopied] = useState(false);

  const incoming = useMemo(() => {
    const code = sp.get('import');
    return code ? decodeShare(code) : null;
  }, [sp]);

  const savedPlaces = saved.map((id) => byId.get(id)).filter(Boolean) as Place[];
  const plannedIds = new Set(Object.values(plan).flat());
  const unplanned = savedPlaces.filter((p) => !plannedIds.has(p.id));

  const share = async () => {
    const url = `${location.href.split('#')[0]}#/plan?import=${encodeShare(saved, plan)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Our Seoul plan', url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* cancelled */
    }
  };

  const dismissImport = () => {
    const next = new URLSearchParams(sp);
    next.delete('import');
    setSp(next, { replace: true });
  };

  return (
    <div className="wrap page plan">
      <header className="page__head">
        <p className="kicker">Saved &amp; plan</p>
        <h1 className="page__title">Your days in Seoul</h1>
        <p className="page__lede">Save places with the heart, then drop them onto a day. Closed-day clashes are flagged automatically.</p>
        <div className="page__actions">
          <button type="button" className="btn btn--primary" onClick={share} disabled={!saved.length}>
            <Link2 size={18} aria-hidden="true" /> Share plan link
          </button>
          {copied && (
            <span className="toast" role="status">
              Link copied — paste it in the family chat
            </span>
          )}
        </div>
      </header>

      {incoming && (
        <div className="importbar" role="region" aria-label="Shared plan">
          <p>
            <b>A shared plan</b> with {incoming.saved.length} places and {Object.values(incoming.plan).flat().length} scheduled stops.
          </p>
          <div className="importbar__btns">
            <button type="button" className="btn btn--primary" onClick={() => { actions.merge(incoming.saved, incoming.plan); dismissImport(); }}>
              Merge into mine
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => { actions.replaceAll(incoming.saved, incoming.plan); dismissImport(); }}>
              Replace mine
            </button>
            <button type="button" className="icon-btn" onClick={dismissImport} aria-label="Dismiss shared plan">
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {status === 'ready' && saved.length === 0 && !incoming && (
        <div className="empty empty--big">
          <Heart size={32} strokeWidth={1.4} aria-hidden="true" />
          <p className="empty__title">No saved places yet</p>
          <p>Tap the heart on any place to save it here.</p>
          <Link to="/explore" className="btn btn--primary">
            Explore places
          </Link>
        </div>
      )}

      <div className="days">
        {TRIP_DAYS.map((d) => (
          <DayCard key={d.date} date={d.date as TripDate} places={(plan[d.date as TripDate] ?? []).map((id) => byId.get(id)).filter(Boolean) as Place[]} />
        ))}
      </div>

      {unplanned.length > 0 && (
        <section className="unplanned">
          <h2 className="section-title">Saved, not scheduled</h2>
          <div className="rowlist">
            {unplanned.map((p) => (
              <div key={p.id} className="unplanned__item">
                <PlaceCard place={p} variant="row" />
                <div className="unplanned__ctl">
                  <label className="daysel">
                    <span className="sr-only">Add {p.name} to a day</span>
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) actions.addToDay(e.target.value as TripDate, p.id);
                      }}
                    >
                      <option value="">Add to day…</option>
                      {TRIP_DAYS.map((d) => {
                        const s = dayStatus(p, d.date as TripDate);
                        return (
                          <option key={d.date} value={d.date}>
                            {d.dow} {Number(d.date.slice(8))}
                            {isChuseok(d.date) ? ' (Chuseok)' : ''}
                            {s === 'closed' ? ' — closed' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                  <button type="button" className="icon-btn" onClick={() => actions.toggleSaved(p.id)} aria-label={`Remove ${p.name} from saved`}>
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
