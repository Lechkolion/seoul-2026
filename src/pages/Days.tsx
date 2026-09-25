import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Car, CircleAlert, Clock, Footprints, Home as HomeIcon, Lightbulb, ListPlus, Repeat, TrainFront, Umbrella } from 'lucide-react';
import { useData } from '../lib/data';
import type { Place, TripDate } from '../lib/types';
import type { RouteLeg } from '../types/place';
import { isChuseok, lineInfo, seoulNow } from '../lib/trip';
import { useWeather } from '../lib/weather';
import { Link } from 'react-router-dom';
import { actions } from '../lib/store';
import { usePlaceOpener } from '../lib/nav';
import { Img } from '../components/Img';
import { LineBadge, RatingChip } from '../components/bits';
import { MoonMark } from '../components/icons';

interface Leg {
  totalMin: number;
  lines: string[];
  transfers: number;
  walkOnly: boolean;
  outOfTown: boolean;
  legs: RouteLeg[];
  taxiMin?: number;
  taxiFare?: number;
  tadaFare?: number;
  km?: number;
}
interface Stop {
  id: string;
  time: string;
  stay: number;
  note: string;
  status: string;
  leg: Leg;
}
interface Day {
  date: TripDate;
  title: string;
  theme: string;
  summary: string;
  stops: Stop[];
  home: Leg | null;
  travelMin: number;
  tips: string[];
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dowOf = (date: string) => DOW[new Date(`${date}T12:00:00+09:00`).getUTCDay()];

/** Large-taxi fare range, e.g. " · ≈₩7–10k" (Venti vs TADA Next at normal demand). */
const fareRange = (l: Leg) => {
  const f = [l.taxiFare, l.tadaFare].filter((x): x is number => !!x).map((x) => Math.round(x / 1000));
  if (!f.length) return '';
  const lo = Math.min(...f), hi = Math.max(...f);
  return ` · ≈₩${lo === hi ? lo : `${lo}–${hi}`}k`;
};

/** Taxi worth it: much faster than the subway for a short hop, or a walk of 15+ min. */
const taxiBetter = (l: Leg) => !!l.taxiMin && l.taxiMin <= 20 && (l.walkOnly ? l.totalMin >= 15 : l.totalMin >= l.taxiMin * 1.8);

function LegDetail({ legs }: { legs: RouteLeg[] }) {
  return (
    <ol className="legs legs--compact">
      {legs.map((leg, i) => (
        <li key={i} className={`leg leg--${leg.type}`} style={leg.line ? { ['--line' as string]: lineInfo(leg.line).color } : undefined}>
          <span className="leg__icon" aria-hidden="true">
            {leg.type === 'walk' ? <Footprints size={14} /> : leg.type === 'transfer' ? <Repeat size={14} /> : <TrainFront size={14} />}
          </span>
          <span className="leg__txt">
            {leg.type === 'walk' && <>Walk{leg.to ? ` to ${leg.to}` : ''}</>}
            {leg.type === 'transfer' && (
              <>
                Transfer at {leg.from} {leg.line && <LineBadge id={leg.line} size="sm" />}
              </>
            )}
            {leg.type === 'subway' && (
              <>
                {leg.line && <LineBadge id={leg.line} size="sm" />} {leg.from} → {leg.to}
                {leg.stops ? <span className="muted"> · {leg.stops} stop{leg.stops === 1 ? '' : 's'}</span> : null}
              </>
            )}
          </span>
          <span className="leg__min">{leg.minutes}′</span>
        </li>
      ))}
    </ol>
  );
}

function Transit({ leg, label }: { leg: Leg; label?: string }) {
  const [open, setOpen] = useState(false);
  const taxi = taxiBetter(leg);
  const canExpand = !leg.walkOnly && leg.legs.length > 1;
  return (
    <div className={`hop ${taxi ? 'hop--taxi' : ''}`}>
      <button type="button" className="hop__main" onClick={() => canExpand && setOpen((o) => !o)} aria-expanded={canExpand ? open : undefined} disabled={!canExpand}>
        <span className="hop__icon" aria-hidden="true">
          {leg.outOfTown ? <Car size={16} /> : leg.walkOnly ? <Footprints size={16} /> : <TrainFront size={16} />}
        </span>
        <span className="hop__txt">
          {label && <span className="hop__label">{label}</span>}
          {leg.walkOnly ? (
            <>Walk {leg.totalMin} min</>
          ) : leg.outOfTown ? (
            <>Taxi / car {leg.totalMin} min</>
          ) : (
            <>
              {leg.lines.map((l) => (
                <LineBadge key={l} id={l} size="sm" />
              ))}{' '}
              <b>{leg.totalMin} min</b>
              {leg.transfers ? <span className="muted"> · {leg.transfers} transfer{leg.transfers > 1 ? 's' : ''}</span> : null}
            </>
          )}
          {leg.taxiMin && (!leg.walkOnly || taxi) ? (
            <span className={`hop__taxi ${taxi ? 'is-better' : ''}`}>
              <Car size={13} aria-hidden="true" /> {taxi ? (leg.walkOnly ? 'or Venti/TADA ' : 'Venti/TADA faster: ') : 'Venti/TADA '}
              {leg.taxiMin} min{fareRange(leg)}
            </span>
          ) : null}
        </span>
      </button>
      {open && <LegDetail legs={leg.legs} />}
    </div>
  );
}

function StopRow({ stop, place, date }: { stop: Stop; place: Place; date: TripDate }) {
  const openPlace = usePlaceOpener();
  return (
    <div className="stop">
      <div className="stop__time">
        <b>{stop.time}</b>
        <span>{stop.stay >= 60 ? `${Math.floor(stop.stay / 60)}h${stop.stay % 60 ? ` ${stop.stay % 60}m` : ''}` : `${stop.stay}m`}</span>
      </div>
      <button type="button" className="stop__card" onClick={() => openPlace(place.id)}>
        <Img img={place.images[0]} category={place.category} name={place.name} sizes="96px" className="stop__img" />
        <span className="stop__body">
          <span className="stop__name">{place.name}</span>
          <span className="stop__meta">
            <RatingChip place={place} />
            {place.location.neighborhood && <span className="muted">{place.location.neighborhood}</span>}
          </span>
          <span className="stop__note">{stop.note}</span>
          {stop.status === 'unknown' && isChuseok(date) && (
            <span className="stop__warn">
              <MoonMark size={11} /> Chuseok hours unconfirmed — check before going
            </span>
          )}
          {stop.status === 'short' && (
            <span className="stop__warn">
              <CircleAlert size={12} aria-hidden="true" /> Shorter hours today
            </span>
          )}
        </span>
      </button>
    </div>
  );
}

export function DaysPage() {
  const { byId, status } = useData();
  const [days, setDays] = useState<Day[] | null>(null);
  const [sel, setSel] = useState<string>('');
  const [added, setAdded] = useState<string>('');

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'data/itineraries.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : []))
      .then((d: Day[]) => {
        setDays(d);
        const now = seoulNow();
        const hash = location.hash.split('?d=')[1];
        // after 18:00 show tomorrow's plan
        const pick = d.find((x) => x.date === hash) ?? d.find((x) => (now.hour >= 18 ? x.date > now.date : x.date >= now.date)) ?? d[d.length - 1];
        if (pick) setSel(pick.date);
      })
      .catch(() => setDays([]));
  }, []);

  const day = useMemo(() => days?.find((d) => d.date === sel), [days, sel]);
  const { weather } = useWeather();
  const rain = day ? weather?.daily.find((w) => w.date === day.date)?.rain ?? null : null;
  const today = seoulNow().date;

  const addAll = () => {
    if (!day) return;
    for (const s of day.stops) actions.addToDay(day.date, s.id);
    setAdded(day.date);
    setTimeout(() => setAdded(''), 2500);
  };

  return (
    <div className="wrap page daysp">
      <header className="page__head">
        <p className="kicker">Our plan · ready-made days</p>
        <h1 className="page__title">Day by day</h1>
        <p className="page__lede">Hand-picked routes for 25–29 Sep, checked against Chuseok closures. Subway times from the same router as every place; tap a hop for stations.</p>
      </header>

      {days && days.length > 0 && (
        <div className="daytabs" role="tablist" aria-label="Choose a day">
          {days.map((d) => (
            <button
              key={d.date}
              type="button"
              role="tab"
              aria-selected={d.date === sel}
              className={`daytab ${d.date === sel ? 'is-on' : ''} ${isChuseok(d.date) ? 'is-chuseok' : ''} ${d.date < today ? 'is-past' : ''}`}
              onClick={() => setSel(d.date)}
            >
              <span className="daytab__dow">
                {dowOf(d.date)} {isChuseok(d.date) && <MoonMark size={10} />}
                {d.date === today && <span className="daytab__today">Today</span>}
              </span>
              <span className="daytab__num">{Number(d.date.slice(8))}</span>
              <span className="daytab__title">{d.title}</span>
            </button>
          ))}
        </div>
      )}

      {day && status === 'ready' && (
        <section className="dayplan" aria-labelledby="dayplan-title">
          <div className="dayplan__head">
            <p className="dayplan__theme">{day.theme}</p>
            <h2 id="dayplan-title" className="dayplan__title">
              {day.title}
            </h2>
            <p className="dayplan__sum">{day.summary}</p>
            {rain != null && rain >= 50 && (
              <Link to={`/rain?d=${day.date}`} className="rainbanner">
                <Umbrella size={18} aria-hidden="true" /> <b>{rain}% chance of rain</b> — see the rain version of this day <ArrowRight size={16} aria-hidden="true" />
              </Link>
            )}
            <div className="dayplan__stats">
              <span>
                <b>{day.stops.length}</b> stops
              </span>
              <span>
                <Clock size={14} aria-hidden="true" /> <b>{Math.round(day.travelMin / 5) * 5}</b> min travelling
              </span>
              <span>
                {day.stops[0]?.time} – {(() => {
                  const last = day.stops[day.stops.length - 1];
                  if (!last) return '';
                  const [h, m] = last.time.split(':').map(Number);
                  const end = h * 60 + m + last.stay;
                  return `${Math.floor(end / 60)}:${String(end % 60).padStart(2, '0')}`;
                })()}
              </span>
              <button type="button" className="btn btn--ghost btn--sm" onClick={addAll}>
                <ListPlus size={16} aria-hidden="true" /> {added === day.date ? 'Copied to Saved ✓' : 'Copy to Saved'}
              </button>
            </div>
          </div>

          <ol className="timeline">
            {day.stops.map((s, i) => {
              const p = byId.get(s.id);
              if (!p) return null;
              return (
                <li key={s.id}>
                  <Transit leg={s.leg} label={i === 0 ? 'From home' : undefined} />
                  <StopRow stop={s} place={p} date={day.date} />
                </li>
              );
            })}
            {day.home && (
              <li className="timeline__end">
                <Transit leg={day.home} label="Back home" />
                <div className="stop stop--home">
                  <div className="stop__time">
                    <HomeIcon size={18} aria-hidden="true" />
                  </div>
                  <span className="muted">Home · Seocho</span>
                </div>
              </li>
            )}
          </ol>

          {day.tips.length > 0 && (
            <ul className="dayplan__tips">
              {day.tips.map((t) => (
                <li key={t}>
                  <Lightbulb size={15} aria-hidden="true" /> {t}
                </li>
              ))}
            </ul>
          )}
          <p className="muted small">Five people: subway is easiest. For taxi hops book one large taxi in the Kakao T app (Venti) or the TADA app (Next) — fares shown are normal-demand estimates; surge and late-night rates are higher.</p>
        </section>
      )}
    </div>
  );
}
