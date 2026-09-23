import { Heart, Clock, Gem, Cpu, Award, Users, BadgeCheck, Star, PiggyBank } from 'lucide-react';
import { m } from 'framer-motion';
import type { Place, TripDate } from '../lib/types';
import { CHUSEOK_MAIN, TRIP_DAYS, isChuseok, lineInfo } from '../lib/trip';
import { compact, dayStatus, primaryRating } from '../lib/place-utils';
import { actions, useStore } from '../lib/store';
import { MoonMark } from './icons';

export function LineBadge({ id, size = 'md' }: { id: string; size?: 'sm' | 'md' }) {
  const info = lineInfo(id);
  const short = /^\d$/.test(id) ? id : info.name.replace(/Line\s*/i, '').slice(0, 10);
  return (
    <span className={`line line--${size} ${/^\d$/.test(id) ? 'line--num' : ''}`} style={{ ['--line' as string]: info.color }} title={info.name} aria-label={info.name}>
      {short}
    </span>
  );
}

export function LineDots({ lines }: { lines: string[] }) {
  return (
    <span className="line-dots" aria-hidden="true">
      {lines.slice(0, 4).map((l) => (
        <span key={l} style={{ background: lineInfo(l).color }} />
      ))}
    </span>
  );
}

export function SaveButton({ id, name, variant = 'float' }: { id: string; name: string; variant?: 'float' | 'pill' }) {
  const saved = useStore((s) => s.saved.includes(id));
  return (
    <button
      type="button"
      className={`save save--${variant} ${saved ? 'is-on' : ''}`}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${name} from saved` : `Save ${name}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        actions.toggleSaved(id);
      }}
    >
      <m.span key={String(saved)} initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }} className="save__icon">
        <Heart size={20} strokeWidth={1.8} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
      </m.span>
      {variant === 'pill' && <span>{saved ? 'Saved' : 'Save'}</span>}
    </button>
  );
}

export function RatingChip({ place }: { place: Place }) {
  const r = primaryRating(place);
  if (!r) return <span className="rating rating--none">No rating yet</span>;
  return (
    <span className="rating" title={`${r.source} ${r.score}${r.count ? ` from ${r.count} reviews` : ''}`}>
      <Star size={14} strokeWidth={0} fill="currentColor" aria-hidden="true" />
      <b>{r.score.toFixed(1)}</b>
      <span className="rating__src">{r.source === 'TripAdvisor' ? 'TA' : r.source}</span>
      {r.count ? <span className="rating__n">({compact(r.count)})</span> : null}
    </span>
  );
}

export function TimeChip({ place }: { place: Place }) {
  if (!place.route) return null;
  return (
    <span className="time-chip">
      <Clock size={14} strokeWidth={2} aria-hidden="true" />
      <b>{place.route.totalMin}</b>&nbsp;min
      {place.route.lines?.length ? <LineDots lines={place.route.lines} /> : null}
    </span>
  );
}

export function ChuseokFlag({ place }: { place: Place }) {
  const s = dayStatus(place, CHUSEOK_MAIN);
  if (s === 'closed') {
    return (
      <span className="cflag cflag--closed">
        <MoonMark size={12} /> Closed 25 Sep
      </span>
    );
  }
  if (place.chuseok?.status === 'open' || s === 'open') {
    return (
      <span className="cflag cflag--open">
        <MoonMark size={12} /> Open Chuseok
      </span>
    );
  }
  return null;
}

export function BadgeRow({ place, max = 6 }: { place: Place; max?: number }) {
  const b = place.badges ?? {};
  const items: { key: string; label: string; icon: React.ReactNode; tone?: string }[] = [];
  if (b.michelin) {
    const label = { star3: 'Michelin ★★★', star2: 'Michelin ★★', star1: 'Michelin ★', bib: 'Bib Gourmand', selected: 'Michelin Selected' }[b.michelin];
    items.push({ key: 'mi', label, icon: <Award size={14} aria-hidden="true" />, tone: 'red' });
  }
  if (b.asias50best) items.push({ key: 'a50', label: "Asia's 50 Best", icon: <Award size={14} aria-hidden="true" />, tone: 'gold' });
  if (b.blueRibbon) items.push({ key: 'br', label: `Blue Ribbon ×${b.blueRibbon}`, icon: <Award size={14} aria-hidden="true" />, tone: 'blue' });
  if (b.mustSee) items.push({ key: 'ms', label: 'Must-see', icon: <Star size={14} aria-hidden="true" />, tone: 'accent' });
  if (b.futuristic) items.push({ key: 'fu', label: 'Futuristic', icon: <Cpu size={14} aria-hidden="true" />, tone: 'accent' });
  if (b.hiddenGem) items.push({ key: 'hg', label: 'Hidden gem', icon: <Gem size={14} aria-hidden="true" />, tone: 'violet' });
  if (b.valueForMoney) items.push({ key: 'vm', label: '가성비 value', icon: <PiggyBank size={14} aria-hidden="true" />, tone: 'green' });
  if (b.localFavorite) items.push({ key: 'lf', label: 'Local favourite', icon: <BadgeCheck size={14} aria-hidden="true" /> });
  if (b.familyFriendly) items.push({ key: 'ff', label: 'Family-friendly', icon: <Users size={14} aria-hidden="true" /> });
  if (!items.length) return null;
  return (
    <ul className="badges" aria-label="Badges">
      {items.slice(0, max).map((i) => (
        <li key={i.key} className={`badge ${i.tone ? `badge--${i.tone}` : ''}`}>
          {i.icon}
          {i.label}
        </li>
      ))}
    </ul>
  );
}

const STATUS_LABEL = { open: 'Open', closed: 'Closed', short: 'Short hours', unknown: 'Unknown' } as const;
const STATUS_SHORT = { open: 'Open', closed: 'Closed', short: 'Short', unknown: '?' } as const;

/** 8-day strip 23–30 Sep with Chuseok days marked. */
export function TripStrip({ place, compact: small = false }: { place: Place; compact?: boolean }) {
  return (
    <ol className={`strip ${small ? 'strip--sm' : ''}`} aria-label="Status on each trip day">
      {TRIP_DAYS.map((d) => {
        const s = dayStatus(place, d.date as TripDate);
        return (
          <li key={d.date} className={`strip__day is-${s} ${isChuseok(d.date) ? 'is-chuseok' : ''} ${d.main ? 'is-main' : ''}`}>
            <span className="strip__dow">{d.dow}</span>
            <span className="strip__num">{Number(d.date.slice(8))}</span>
            <span className="strip__state">
              <span className="sr-only">{`${d.dow} ${Number(d.date.slice(8))} Sep: ${STATUS_LABEL[s]}`}</span>
              <span aria-hidden="true">{STATUS_SHORT[s]}</span>
            </span>
            {isChuseok(d.date) && <MoonMark size={10} className="strip__moon" />}
          </li>
        );
      })}
    </ol>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}
