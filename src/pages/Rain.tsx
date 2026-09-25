import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CloudRain, Umbrella, TrainFront, Lightbulb, ArrowRightLeft } from 'lucide-react';
import { useData } from '../lib/data';
import type { Place, TripDate } from '../lib/types';
import { seoulNow } from '../lib/trip';
import { dayStatus, ratingKey } from '../lib/place-utils';
import { isHeritage } from '../lib/filters';
import { matchesType } from '../lib/placeTypes';
import { describe, useWeather } from '../lib/weather';
import { PlaceCard } from '../components/PlaceCard';
import { usePlaceOpener } from '../lib/nav';
import { Img } from '../components/Img';
import { RatingChip } from '../components/bits';

interface DayPlan {
  date: TripDate;
  title: string;
  stops: { id: string; time: string }[];
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dowOf = (date: string) => DOW[new Date(`${date}T12:00:00+09:00`).getUTCDay()];

/** Reachable without going outside: connected underground to the station (from research notes). */
const UNDERGROUND: { ids: string[]; via: string }[] = [
  { ids: ['goto-mall-express-bus-terminal', 'shinsegae-gangnam', 'newcore-outlet-gangnam'], via: 'Express Bus Terminal (Line 3/7/9) — closest to home' },
  { ids: ['starfield-coex-mall', 'starfield-coex-library', 'megabox-coex-dolby-cinema', 'sea-life-coex-aquarium'], via: 'Samseong (Line 2) / Bongeunsa (Line 9) — COEX' },
  { ids: ['lotte-world-mall-avenuel', 'lotte-world-tower-seoul-sky', 'lotte-world-aquarium', 'lotte-cinema-world-tower-super-plex-g', 'lotte-world-adventure'], via: 'Jamsil (Line 2/8) — Lotte World Tower & Mall' },
  { ids: ['the-hyundai-seoul', 'ifc-mall'], via: 'Yeouido (Line 5/9)' },
  { ids: ['yongsan-ipark-mall', 'cgv-yongsan-ipark-imax'], via: 'Yongsan Station (Line 1)' },
  { ids: ['kyobo-book-centre-gangnam'], via: 'Sinnonhyeon (Line 9)' },
  { ids: ['lotte-department-store-myeongdong-main'], via: 'Euljiro 1-ga (Line 2)' },
  { ids: ['shinsegae-main-store-myeongdong'], via: 'Hoehyeon (Line 4)' },
  { ids: ['kyobo-book-centre-gwanghwamun'], via: 'Gwanghwamun (Line 5)' },
  { ids: ['hyundai-department-store-pangyo'], via: 'Pangyo (Shinbundang Line)' },
];

const RAIN_SENSITIVE = /cruise|balloon|fountain|park|forest|lake|stream|street|market|river|tower|square|viewpoint|walk/i;
const isIndoor = (p: Place) => p.tags.includes('indoor') || p.tags.includes('rainy-day') || p.goodFor?.includes('Rainy day');
const needsSwap = (p: Place) => (p.tags.includes('outdoor') && !p.tags.includes('indoor')) || (!isIndoor(p) && RAIN_SENSITIVE.test(`${p.subcategory} ${p.name}`));

const DOW_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
/** Open at hh:mm on that date? Unknown hours count as open; "closed" or ranges that miss the time don't. */
function openAt(p: Place, date: string, time: string) {
  const dow = DOW_KEYS[new Date(`${date}T12:00:00+09:00`).getUTCDay()];
  const h = p.hours?.weekly?.[dow] ?? p.hours?.note;
  if (!h) return true;
  const t = h.trim().toLowerCase();
  if (t === 'closed') return false;
  if (t.includes('24h')) return true;
  const [hh, mm] = time.split(':').map(Number);
  const at = hh * 60 + mm;
  const ranges = [...t.matchAll(/(\d{1,2}):(\d{2})\s*[-–~]\s*(\d{1,2}):(\d{2})/g)];
  if (!ranges.length) return true;
  return ranges.some((m) => {
    const a = +m[1] * 60 + +m[2];
    let b = +m[3] * 60 + +m[4];
    if (b <= a) b += 1440;
    return at >= a && at + 45 <= b; // at least 45 min before closing
  });
}

function km(a: Place, b: Place) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.location.lat - a.location.lat) * r, dLng = (b.location.lng - a.location.lng) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.location.lat * r) * Math.cos(b.location.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

const GROUPS: { key: string; title: string; kicker: string; pick: (p: Place) => boolean }[] = [
  { key: 'screen', title: 'Cinemas & shows', kicker: 'Sit down, stay dry', pick: (p) => p.category === 'experience' && (matchesType(p, 'cinema') || matchesType(p, 'shows')) },
  { key: 'art', title: 'Exhibitions & modern museums', kicker: 'Immersive, art, tech', pick: (p) => ((p.category === 'sight' && isIndoor(p)) || (p.category === 'experience' && matchesType(p, 'exhibit')) || p.category === 'event') && isIndoor(p) && !isHeritage(p) },
  { key: 'spa', title: 'Spas & massage', kicker: 'The best rainy-day plan', pick: (p) => p.category === 'wellness' },
  { key: 'mall', title: 'Malls, department stores & food halls', kicker: 'Shop, eat, repeat', pick: (p) => p.category === 'shopping' && isIndoor(p) && !matchesType(p, 'outlet') && !matchesType(p, 'streets') },
  { key: 'fun', title: 'Aquariums & indoor fun', kicker: 'Under one roof', pick: (p) => p.category === 'experience' && matchesType(p, 'fun') && isIndoor(p) },
  { key: 'bar', title: 'Cozy bars', kicker: 'Wait it out with a drink', pick: (p) => p.category === 'bar' && !p.tags.includes('rooftop') && !p.tags.includes('outdoor') },
  { key: 'cafe', title: 'Big cafés to linger in', kicker: 'Coffee and cake', pick: (p) => p.category === 'cafe' && (matchesType(p, 'big') || p.tags.includes('indoor')) },
];

function SwapRow({ stop, place, alts }: { stop: { time: string }; place: Place; alts: Place[] }) {
  const open = usePlaceOpener();
  return (
    <li className="swap">
      <div className="swap__from">
        <span className="swap__time mono">{stop.time}</span>
        <span className="swap__name">{place.name}</span>
        <span className="swap__tag">outdoor</span>
      </div>
      {alts.length ? (
        <div className="swap__to">
          <ArrowRightLeft size={16} aria-hidden="true" />
          <div className="swap__alts">
            {alts.map((a) => (
              <button key={a.id} type="button" className="swap__alt" onClick={() => open(a.id)}>
                <Img img={a.images[0]} category={a.category} name={a.name} sizes="56px" className="swap__img" />
                <span>
                  <b>{a.name}</b>
                  <span className="swap__meta">
                    <RatingChip place={a} /> <span className="muted">{km(place, a).toFixed(1)} km away</span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="muted small">No close indoor match — pick from the lists below.</p>
      )}
    </li>
  );
}

export function RainPage() {
  const { places, byId, status } = useData();
  const { weather } = useWeather();
  const [days, setDays] = useState<DayPlan[]>([]);
  const [sel, setSel] = useState('');
  const now = seoulNow();

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'data/itineraries.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : []))
      .then((d: DayPlan[]) => setDays(d.filter((x) => x.date >= now.date)))
      .catch(() => setDays([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rainOf = (date: string) => weather?.daily.find((d) => d.date === date);
  // default: the wettest upcoming plan day, else today/tomorrow
  useEffect(() => {
    if (!days.length || sel) return;
    const hash = location.hash.split('?d=')[1];
    const wet = [...days].sort((a, b) => (rainOf(b.date)?.rain ?? 0) - (rainOf(a.date)?.rain ?? 0))[0];
    const pick = days.find((d) => d.date === hash) ?? ((rainOf(wet.date)?.rain ?? 0) >= 50 ? wet : days.find((d) => (now.hour >= 18 ? d.date > now.date : d.date >= now.date)) ?? days[0]);
    setSel(pick.date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, weather]);

  const day = days.find((d) => d.date === sel);

  const swaps = useMemo(() => {
    if (!day) return [];
    return day.stops
      .map((s) => ({ stop: s, place: byId.get(s.id) }))
      .filter((x): x is { stop: { id: string; time: string }; place: Place } => !!x.place && needsSwap(x.place))
      .map(({ stop, place }) => {
        const alts = places
          .filter((a) => a.id !== place.id && isIndoor(a) && !isHeritage(a) && dayStatus(a, day.date) !== 'closed' && openAt(a, day.date, stop.time))
          .filter((a) => (['food', 'cafe', 'bar'].includes(place.category) ? a.category === place.category : !['food', 'cafe', 'bar'].includes(a.category)))
          .filter((a) => !day.stops.some((s) => s.id === a.id) && !/women only/i.test(`${a.name} ${a.subcategory}`))
          .map((a) => ({ a, d: km(place, a) }))
          .filter((x) => x.d <= 3)
          .sort((x, y) => x.d - y.d || ratingKey(y.a) - ratingKey(x.a))
          .slice(0, 2)
          .map((x) => x.a);
        return { stop, place, alts };
      });
  }, [day, places, byId]);

  const groups = useMemo(
    () =>
      GROUPS.map((g) => ({
        ...g,
        list: places
          .filter((p) => g.pick(p) && p.route && !p.route.outOfTown)
          .sort((a, b) => (a.route.totalMin - b.route.totalMin) * 0.04 + (ratingKey(b) - ratingKey(a)))
          .slice(0, 10),
      })).filter((g) => g.list.length),
    [places],
  );

  const tripDaily = (weather?.daily ?? []).filter((d) => d.date >= now.date && d.date <= '2026-09-30');

  return (
    <div className="wrap page rainp">
      <header className="page__head">
        <p className="kicker">
          <Umbrella size={14} aria-hidden="true" /> Rainy day
        </p>
        <h1 className="page__title">When it rains</h1>
        <p className="page__lede">Live forecast, a rain version of each day's plan, and places you can reach without stepping outside.</p>
      </header>

      {tripDaily.length > 0 && (
        <ol className="rainstrip" aria-label="Rain forecast">
          {tripDaily.map((d) => {
            const wet = (d.rain ?? 0) >= 50 || ['rain', 'drizzle', 'storm'].includes(describe(d.code).kind);
            return (
              <li key={d.date} className={`rainstrip__d ${wet ? 'is-wet' : ''}`}>
                <span className="rainstrip__dow">
                  {d.date === now.date ? 'Today' : dowOf(d.date)} {Number(d.date.slice(8))}
                </span>
                <CloudRain size={18} aria-hidden="true" />
                <b>{d.rain ?? '–'}%</b>
                <span className="rainstrip__lbl">{describe(d.code).label}</span>
              </li>
            );
          })}
        </ol>
      )}

      {days.length > 0 && status === 'ready' && (
        <section className="rainplan" aria-labelledby="rainplan-t">
          <h2 id="rainplan-t" className="section-title">
            Rain version of our plan
          </h2>
          <div className="daytabs" role="tablist" aria-label="Choose a day">
            {days.map((d) => (
              <button key={d.date} type="button" role="tab" aria-selected={d.date === sel} className={`daytab ${d.date === sel ? 'is-on' : ''}`} onClick={() => setSel(d.date)}>
                <span className="daytab__dow">
                  {dowOf(d.date)} · {rainOf(d.date)?.rain ?? '–'}% rain
                </span>
                <span className="daytab__num">{Number(d.date.slice(8))}</span>
                <span className="daytab__title">{d.title}</span>
              </button>
            ))}
          </div>
          {day && (
            <>
              {swaps.length ? (
                <>
                  <p className="muted">Swap these outdoor stops for something nearby and indoors ({swaps.length} of {day.stops.length} stops). Everything else stays as planned.</p>
                  <ul className="swaps">
                    {swaps.map((s) => (
                      <SwapRow key={s.place.id} stop={s.stop} place={s.place} alts={s.alts} />
                    ))}
                  </ul>
                </>
              ) : (
                <p className="muted">This day is already rain-proof — every stop is indoors.</p>
              )}
              <Link to={`/days?d=${day.date}`} className="btn btn--ghost btn--sm">
                Full plan with routes <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </>
          )}
        </section>
      )}

      <section className="dry" aria-labelledby="dry-t">
        <h2 id="dry-t" className="section-title">
          <TrainFront size={18} aria-hidden="true" /> Straight from the subway — no umbrella
        </h2>
        <ul className="dry__list">
          {UNDERGROUND.map((g) => {
            const ps = g.ids.map((id) => byId.get(id)).filter(Boolean) as Place[];
            if (!ps.length) return null;
            return (
              <li key={g.via} className="dry__grp">
                <p className="dry__via">{g.via}</p>
                <div className="rowlist">
                  {ps.map((p) => (
                    <PlaceCard key={p.id} place={p} variant="row" />
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {groups.map((g) => (
        <section key={g.key} className="raingrp" aria-label={g.title}>
          <p className="kicker">{g.kicker}</p>
          <h2 className="section-title">{g.title}</h2>
          <div className="rowlist">
            {g.list.map((p) => (
              <PlaceCard key={p.id} place={p} variant="row" />
            ))}
          </div>
        </section>
      ))}

      <section className="pcard raintips" aria-labelledby="raintips-t">
        <h2 id="raintips-t">
          <Lightbulb size={18} aria-hidden="true" /> Rain tips
        </h2>
        <ul>
          <li>Every convenience store (GS25, CU, 7-Eleven) sells umbrellas for about ₩5,000–10,000.</li>
          <li>Taxis get scarce when it pours — book the Venti/TADA van 15–20 minutes early.</li>
          <li>Called off in rain or strong wind: the Banpo rainbow fountain and the Seoul Dal balloon; river cruises can be cancelled too — check before going.</li>
          <li>Near home, the Express Bus Terminal underground (GOTO Mall, Shinsegae Gangnam) is a whole rainy afternoon in itself.</li>
          <li>Shops and restaurants put umbrella bags or stands at the door — use them.</li>
        </ul>
      </section>
    </div>
  );
}

