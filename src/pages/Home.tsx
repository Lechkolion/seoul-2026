import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { m } from 'framer-motion';
import { ArrowRight, Search } from 'lucide-react';
import { useData } from '../lib/data';
import type { Category, Place, TripDate } from '../lib/types';
import { CATEGORY_LABEL, CATEGORY_ORDER, CHUSEOK_MAIN, TRIP_DAYS, isChuseok, seoulNow, tripPhase } from '../lib/trip';
import { dayStatus, isOpenOn, ratingKey } from '../lib/place-utils';
import { hasBadge, sortPlaces } from '../lib/filters';
import { useWeather, describe } from '../lib/weather';
import { Shelf } from '../components/Shelf';
import { WeatherCard } from '../components/WeatherCard';
import { Img } from '../components/Img';
import { CATEGORY_ICON, MoonMark } from '../components/icons';
import { Skeleton } from '../components/bits';

function greeting(hour: number) {
  if (hour < 5) return 'Late night in Seoul';
  if (hour < 12) return 'Good morning, Seoul';
  if (hour < 18) return 'Good afternoon, Seoul';
  return 'Good evening, Seoul';
}

function DayIndicator() {
  const phase = tripPhase();
  const now = seoulNow();
  const clock = `${String(now.hour).padStart(2, '0')}:${String(now.minutes % 60).padStart(2, '0')}`;
  let line: string;
  if (phase.kind === 'during' && phase.day) {
    line = `Day ${phase.dayIndex + 1} of 8 · ${phase.day.label}`;
    if (phase.day.main) line = `Day ${phase.dayIndex + 1} · Chuseok day — many places closed`;
  } else if (phase.kind === 'before') {
    line = `${phase.daysUntil} day${phase.daysUntil === 1 ? '' : 's'} to go`;
  } else {
    line = 'Trip complete — see you next time';
  }
  return (
    <div className="dayind">
      <p className="hud">
        <span className="hud__live" aria-hidden="true" />
        {clock} KST · {line}
      </p>
      <ol className="dayind__bar" aria-label="Trip days">
        {TRIP_DAYS.map((d, i) => {
          const state = phase.kind === 'after' || (phase.kind === 'during' && i < phase.dayIndex) ? 'past' : phase.kind === 'during' && i === phase.dayIndex ? 'now' : 'future';
          return (
            <li key={d.date} className={`dayind__seg is-${state} ${isChuseok(d.date) ? 'is-chuseok' : ''}`} aria-current={state === 'now' ? 'date' : undefined}>
              <span className="dayind__n">{Number(d.date.slice(8))}</span>
              <span className="dayind__d">{d.dow}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ChuseokBanner({ places }: { places: Place[] }) {
  const phase = tripPhase();
  const closed = places.filter((p) => dayStatus(p, CHUSEOK_MAIN) === 'closed').length;
  const open = places.filter((p) => isOpenOn(p, CHUSEOK_MAIN)).length;
  const today = phase.kind === 'during' && isChuseok(phase.today);
  return (
    <Link to="/chuseok" className={`chuseok-banner ${today ? 'is-today' : ''}`}>
      <span className="chuseok-banner__moon" aria-hidden="true" />
      <span className="chuseok-banner__text">
        <span className="kicker kicker--moon">
          <MoonMark size={12} /> {today ? 'Chuseok holiday — today' : 'Chuseok holiday'}
        </span>
        <strong>Thu 24 – Sat 26 Sep. Fri 25 is Chuseok day.</strong>
        <span>
          Many restaurants and shops close.{' '}
          {places.length > 0 && (
            <>
              <b>{closed}</b> of our places are closed on the 25th, <b>{open}</b> confirmed or expected open.
            </>
          )}
        </span>
      </span>
      <ArrowRight className="chuseok-banner__go" size={22} aria-hidden="true" />
    </Link>
  );
}

function CategoryTiles({ places }: { places: Place[] }) {
  const tiles = useMemo(
    () =>
      CATEGORY_ORDER.map((c) => {
        const list = places.filter((p) => p.category === c);
        const hero = [...list].sort((a, b) => Number(!!b.images.length) - Number(!!a.images.length) || ratingKey(b) - ratingKey(a))[0];
        return { c, count: list.length, hero };
      }),
    [places],
  );
  return (
    <section className="tiles" aria-label="Categories">
      {tiles.map(({ c, count, hero }, i) => {
        const Icon = CATEGORY_ICON[c];
        return (
          <m.div key={c} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i, duration: 0.5 }}>
            <Link to={`/explore?cat=${c}`} className="tile" aria-label={`${CATEGORY_LABEL[c]} — ${count} places`}>
              <Img img={hero?.images[0]} category={c as Category} name={CATEGORY_LABEL[c]} sizes="(max-width: 640px) 50vw, 25vw" className="tile__img" />
              <span className="tile__shade" aria-hidden="true" />
              <span className="tile__icon" aria-hidden="true">
                <Icon size={20} strokeWidth={1.6} />
              </span>
              <span className="tile__label">{CATEGORY_LABEL[c]}</span>
              <span className="tile__count">{count}</span>
            </Link>
          </m.div>
        );
      })}
    </section>
  );
}

export function HomePage() {
  const { places, status, isMock } = useData();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const { weather } = useWeather();
  const now = seoulNow();
  const rainyToday = weather ? ['rain', 'drizzle', 'storm'].includes(describe(weather.code).kind) || (weather.daily.find((d) => d.date === now.date)?.rain ?? 0) >= 60 : false;

  const hero = useMemo(() => {
    // modern skyline over palaces: the family prefers high-tech, futuristic places
    const cands = places.filter((p) => p.images.length && p.badges.futuristic && (p.category === 'sight' || p.badges.mustSee));
    return sortPlaces(cands.length ? cands : places.filter((p) => p.images.length), 'rating')[0];
  }, [places]);

  const shelves = useMemo(() => {
    const top = (list: Place[], n = 14) => sortPlaces(list, 'rating').slice(0, n);
    const today = tripPhase().kind === 'during' ? (now.date as TripDate) : null;
    const s = [
      { key: 'top', kicker: 'Ranked by Tripadvisor', title: 'Top rated', to: '/explore?sort=rating', places: top(places.filter((p) => p.ratings.tripadvisor?.score)) },
      { key: 'fut', kicker: 'Comfort · tech · design', title: 'Futuristic & high-tech', to: '/explore?badge=futuristic', places: top(places.filter((p) => hasBadge(p, 'futuristic'))) },
      { key: 'near', kicker: 'Door to door ≤ 20 min', title: 'Near home', to: '/explore?time=20&sort=time', places: sortPlaces(places.filter((p) => (p.route?.totalMin ?? 99) <= 20), 'time').slice(0, 14) },
      { key: 'chu', kicker: 'Fri 25 Sep', title: 'Open on Chuseok day', to: `/explore?day=${CHUSEOK_MAIN}`, places: top(places.filter((p) => isOpenOn(p, CHUSEOK_MAIN))) },
      { key: 'val', kicker: '가성비', title: 'Great value', to: '/explore?badge=value', places: top(places.filter((p) => hasBadge(p, 'value'))) },
      { key: 'gem', kicker: 'Few foreigners find these', title: 'Hidden gems', to: '/explore?badge=gem', places: top(places.filter((p) => hasBadge(p, 'gem'))) },
      { key: 'mic', kicker: 'Guide Michelin', title: 'Michelin', to: '/explore?badge=michelin', places: top(places.filter((p) => hasBadge(p, 'michelin'))) },
      { key: 'rain', kicker: rainyToday ? 'Rain today — stay dry' : 'Indoors', title: 'Rainy-day picks', to: '/explore?tag=rainy-day', places: top(places.filter((p) => p.tags.includes('rainy-day') || p.goodFor.includes('Rainy day'))) },
      { key: 'evt', kicker: '23–30 Sep only', title: 'Happening this week', to: '/explore?cat=event', places: top(places.filter((p) => p.category === 'event')) },
    ];
    if (today) s.splice(1, 0, { key: 'today', kicker: 'Open today', title: 'Open today, near home', to: `/explore?day=${today}&sort=time`, places: sortPlaces(places.filter((p) => isOpenOn(p, today)), 'time').slice(0, 14) });
    if (rainyToday) {
      const i = s.findIndex((x) => x.key === 'rain');
      s.unshift(...s.splice(i, 1));
    }
    return s;
  }, [places, rainyToday, now.date]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    nav(q.trim() ? `/explore?q=${encodeURIComponent(q.trim())}` : '/explore');
  };

  return (
    <div className="home">
      <section className="hero">
        <div className="hero__bg" aria-hidden="true">
          {hero && <Img img={hero.images[0]} category={hero.category} name={hero.name} prefer="full" eager sizes="100vw" className="hero__img" />}
          <span className="hero__fade" />
          <span className="hero__aurora" />
        </div>
        <div className="hero__inner wrap">
          <DayIndicator />
          <m.h1 className="hero__title" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}>
            {greeting(now.hour)}
          </m.h1>
          <p className="hero__sub">
            {places.length ? `${places.length} hand-picked places` : 'Hand-picked places'} to eat, drink, see and do — ranked by Tripadvisor, cross-checked on Naver, timed from home.
          </p>
          <form className="bigsearch" role="search" onSubmit={submit}>
            <Search size={22} aria-hidden="true" />
            <label htmlFor="home-q" className="sr-only">
              Search places
            </label>
            <input id="home-q" type="search" placeholder="Search — hanwoo, 성수, rooftop, sauna…" value={q} onChange={(e) => setQ(e.target.value)} enterKeyHint="search" />
            <button type="submit" className="bigsearch__go" aria-label="Search">
              <ArrowRight size={20} aria-hidden="true" />
            </button>
          </form>
          <Link to="/days" className="btn btn--primary hero__days">
            Ready-made day plans <ArrowRight size={18} aria-hidden="true" />
          </Link>
          {hero && <p className="hero__credit">Photo: {hero.name} · {hero.images[0]?.credit}</p>}
        </div>
      </section>

      <div className="wrap home__grid">
        <ChuseokBanner places={places} />
        <WeatherCard />
      </div>

      {isMock && (
        <p className="wrap mockwarn" role="note">
          Development preview — showing fake sample data because public/data/places.json is missing.
        </p>
      )}

      <div className="wrap">
        {status === 'loading' ? (
          <div className="tiles">
            {CATEGORY_ORDER.map((c) => (
              <Skeleton key={c} className="tile" />
            ))}
          </div>
        ) : (
          <CategoryTiles places={places} />
        )}
      </div>

      <div className="wrap shelves">
        {status === 'loading' && (
          <div className="shelf">
            <Skeleton className="skeleton--title" />
            <div className="shelf__track">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="card card--shelf skeleton--card" />
              ))}
            </div>
          </div>
        )}
        {status === 'error' && <p className="empty">Couldn’t load the guide data. Check your connection and reload.</p>}
        {shelves.map((s) => (
          <Shelf key={s.key} kicker={s.kicker} title={s.title} to={s.to} places={s.places} />
        ))}
      </div>
    </div>
  );
}
