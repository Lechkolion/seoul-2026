import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Route as RouteIcon } from 'lucide-react';
import { useData } from '../lib/data';
import { seoulNow } from '../lib/trip';

interface DaySummary {
  date: string;
  title: string;
  theme: string;
  stops: { id: string; time: string }[];
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Home: the ready-made plan for today (or tomorrow once the evening is under way). */
export function PlanCard() {
  const { byId } = useData();
  const [days, setDays] = useState<DaySummary[]>([]);
  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'data/itineraries.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : []))
      .then(setDays)
      .catch(() => setDays([]));
  }, []);

  const now = seoulNow();
  // after 18:00 the useful plan is tomorrow's
  const next = days.find((d) => (now.hour >= 18 ? d.date > now.date : d.date >= now.date));
  if (!next) return null;
  const label = next.date === now.date ? 'Today' : 'Tomorrow';
  const isTomorrow = label === 'Tomorrow' && new Date(`${now.date}T12:00:00+09:00`).getTime() + 864e5 === new Date(`${next.date}T12:00:00+09:00`).getTime();
  const dow = DOW[new Date(`${next.date}T12:00:00+09:00`).getUTCDay()];

  return (
    <Link to={`/days?d=${next.date}`} className="plancard">
      <span className="plancard__icon" aria-hidden="true">
        <RouteIcon size={22} />
      </span>
      <span className="plancard__body">
        <span className="kicker">
          {label === 'Today' ? 'Today' : isTomorrow ? 'Tomorrow' : 'Next'} · {dow} {Number(next.date.slice(8))} Sep
        </span>
        <strong className="plancard__title">{next.title}</strong>
        <span className="plancard__stops">
          {next.stops.slice(0, 5).map((s) => (
            <span key={s.id}>
              <b>{s.time}</b> {byId.get(s.id)?.name ?? s.id}
            </span>
          ))}
          {next.stops.length > 5 && <span className="muted">+{next.stops.length - 5} more</span>}
        </span>
        <span className="plancard__cta">
          Open the plan with subway routes <ArrowRight size={16} aria-hidden="true" />
        </span>
      </span>
    </Link>
  );
}
