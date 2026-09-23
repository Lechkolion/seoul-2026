import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Bus, Building2, CircleAlert, Crown, Landmark, Pill, Store, UtensilsCrossed } from 'lucide-react';
import { useData } from '../lib/data';
import type { Place, TripDate } from '../lib/types';
import { TRIP_DAYS, isChuseok, tripPhase, trip } from '../lib/trip';
import { dayStatus, hostOf, ratingKey } from '../lib/place-utils';
import { MoonMark } from '../components/icons';

const DAY_TIP: Partial<Record<TripDate, string>> = {
  '2026-09-23': 'Last normal day before the holiday. Good for anything small, family-run or market-based.',
  '2026-09-24': 'Holiday begins. Traffic out of Seoul peaks in the morning; the city itself gets calmer by afternoon.',
  '2026-09-25': 'Chuseok day — the quietest day of the year. Lean on hotels, big malls, palaces and chains.',
  '2026-09-26': 'Still a holiday. More places reopen in the afternoon; return traffic into Seoul builds.',
  '2026-09-27': 'Normal Sunday. Busy: locals are out before work resumes. Book popular dinners.',
  '2026-09-28': 'Monday: many museums and Changdeokgung / Deoksugung / Changgyeonggung are closed.',
  '2026-09-29': 'Tuesday: Gyeongbokgung and Jongmyo are closed; other palaces open.',
  '2026-09-30': 'Last day — keep it near home or on the way to the airport.',
};

const TIPS = [
  { icon: Bus, title: 'Seoul empties, highways fill', text: 'Millions leave for hometowns. Inside Seoul, streets and subways are unusually calm; intercity trains and buses sell out and expressways jam on 24 Sep (outbound) and 26–27 Sep (return). Stay in the city.' },
  { icon: Crown, title: 'Palaces are your friend', text: 'Royal palaces normally stay open through Chuseok, often with free admission and holiday events in recent years — check the notice for 2026. Remember weekly closures: Gyeongbokgung on Tuesdays; Changdeokgung, Deoksugung, Changgyeonggung on Mondays.' },
  { icon: Building2, title: 'Department stores close one day', text: 'Each chain (Shinsegae, Hyundai, Lotte, Galleria) typically shuts for one day around Chuseok, not always the same one. Our place cards show each store’s day. Big malls like Starfield COEX usually stay open.' },
  { icon: UtensilsCrossed, title: 'Family restaurants close; book the rest', text: 'Small family-run restaurants often close for two or three days. Hotel restaurants, big chains and mall food courts usually stay open — and get busy. Reserve through CatchTable where possible.' },
  { icon: Store, title: 'Convenience stores never close', text: 'GS25, CU and 7-Eleven stay open 24 hours with ATMs that take foreign cards. Banks are closed 24–26 Sep.' },
  { icon: Pill, title: 'If someone feels unwell', text: 'Emergency rooms run as normal. Only some pharmacies open on the holiday — call 1330 (tourist hotline, English) or 120 (Seoul Dasan call center) to find one nearby.' },
  { icon: Landmark, title: 'Taste the holiday', text: 'Look for songpyeon (half-moon rice cakes) and jeon (savory pancakes) at bakeries, department-store food halls and markets that stay open.' },
];

function List({ title, places, tone }: { title: string; places: Place[]; tone: 'open' | 'closed' | 'unknown' }) {
  const loc = useLocation();
  if (!places.length) return null;
  return (
    <details className={`chu-list chu-list--${tone}`}>
      <summary>
        <span className={`dotl is-${tone}`} aria-hidden="true" /> {title} <span className="chu-list__n">{places.length}</span>
      </summary>
      <ul>
        {places.slice(0, 40).map((p) => (
          <li key={p.id}>
            <Link to={`/place/${encodeURIComponent(p.id)}`} state={{ background: loc }}>
              {p.name}
            </Link>
            <span className="muted"> · {p.subcategory}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function ChuseokPage() {
  const { places } = useData();
  const phase = tripPhase();
  const days = useMemo(
    () =>
      TRIP_DAYS.map((d) => {
        const date = d.date as TripDate;
        const sorted = [...places].sort((a, b) => ratingKey(b) - ratingKey(a));
        const open = sorted.filter((p) => ['open', 'short'].includes(dayStatus(p, date)));
        const closed = sorted.filter((p) => dayStatus(p, date) === 'closed');
        const unknown = sorted.filter((p) => dayStatus(p, date) === 'unknown');
        return { d, date, open, closed, unknown };
      }),
    [places],
  );
  const verified = places.filter((p) => p.chuseok?.verified).length;

  return (
    <div className="page chuseok">
      <section className="chu-hero">
        <div className="chu-hero__moon" aria-hidden="true" />
        <div className="wrap chu-hero__in">
          <p className="kicker kicker--moon">
            <MoonMark size={12} /> 추석 · Korean harvest festival
          </p>
          <h1 className="page__title">Chuseok 2026</h1>
          <p className="chu-hero__dates">
            <b>Thu 24 – Sat 26 September</b>
            <span>Fri 25 is Chuseok day — the quietest day in Seoul.</span>
          </p>
          <p className="page__lede">{trip.holidays.chuseok.note}</p>
          <p className="muted small">
            {verified} of {places.length} places have a verified 2026 holiday notice; the rest are inferred from usual hours and past years — treat “unknown” as “call ahead”.
          </p>
        </div>
      </section>

      <div className="wrap">
        <h2 className="section-title">Day by day</h2>
        <ol className="chu-days">
          {days.map(({ d, date, open, closed, unknown }) => {
            const total = open.length + closed.length + unknown.length || 1;
            const today = phase.kind === 'during' && phase.today === date;
            return (
              <li key={date} className={`chu-day ${isChuseok(date) ? 'is-chuseok' : ''} ${d.main ? 'is-main' : ''} ${today ? 'is-today' : ''}`}>
                <div className="chu-day__date">
                  <span className="chu-day__num">{Number(date.slice(8))}</span>
                  <span className="chu-day__dow">{d.dow}</span>
                  {isChuseok(date) && <MoonMark size={16} className="chu-day__moon" />}
                </div>
                <div className="chu-day__body">
                  <h3>
                    {d.label}
                    {today && <span className="pill-now">Today</span>}
                  </h3>
                  <p>{DAY_TIP[date]}</p>
                  <div className="chu-bar" role="img" aria-label={`${open.length} open, ${closed.length} closed, ${unknown.length} unknown`}>
                    <span className="is-open" style={{ width: `${(open.length / total) * 100}%` }} />
                    <span className="is-unknown" style={{ width: `${(unknown.length / total) * 100}%` }} />
                    <span className="is-closed" style={{ width: `${(closed.length / total) * 100}%` }} />
                  </div>
                  <p className="chu-legend">
                    <span>
                      <span className="dotl is-open" aria-hidden="true" /> {open.length} open
                    </span>
                    <span>
                      <span className="dotl is-unknown" aria-hidden="true" /> {unknown.length} unknown
                    </span>
                    <span>
                      <span className="dotl is-closed" aria-hidden="true" /> {closed.length} closed
                    </span>
                  </p>
                  <div className="chu-day__lists">
                    <List title="Closed" places={closed} tone="closed" />
                    <List title="Open" places={open} tone="open" />
                  </div>
                  <Link className="see-all" to={`/explore?day=${date}`}>
                    Everything open on the {Number(date.slice(8))}th <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </div>
              </li>
            );
          })}
        </ol>

        <h2 className="section-title">Holiday know-how</h2>
        <div className="tipgrid">
          {TIPS.map((t) => (
            <article key={t.title} className="tipcard glass">
              <t.icon size={22} strokeWidth={1.6} aria-hidden="true" />
              <h3>{t.title}</h3>
              <p>{t.text}</p>
            </article>
          ))}
        </div>

        <p className="note">
          <CircleAlert size={16} aria-hidden="true" /> Holiday dates:{' '}
          {trip.holidays.chuseok.sources.map((s, i) => (
            <span key={s}>
              {i > 0 && ', '}
              <a href={s} target="_blank" rel="noreferrer noopener">
                {hostOf(s)}
              </a>
            </span>
          ))}
          . Venue-specific notices are linked on each place.
        </p>
      </div>
    </div>
  );
}
