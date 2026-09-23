import { useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Place } from '../lib/types';
import { PlaceCard } from './PlaceCard';

interface Props {
  title: ReactNode;
  kicker?: string;
  to: string;
  places: Place[];
  note?: ReactNode;
}

export function Shelf({ title, kicker, to, places, note }: Props) {
  const track = useRef<HTMLDivElement>(null);
  if (!places.length) return null;
  const scroll = (dir: 1 | -1) => {
    const el = track.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  };
  return (
    <section className="shelf">
      <header className="shelf__head">
        <div>
          {kicker && <p className="kicker">{kicker}</p>}
          <h2 className="shelf__title">{title}</h2>
          {note && <p className="shelf__note">{note}</p>}
        </div>
        <div className="shelf__ctl">
          <button type="button" className="icon-btn desktop-only" onClick={() => scroll(-1)} aria-label="Scroll left">
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <button type="button" className="icon-btn desktop-only" onClick={() => scroll(1)} aria-label="Scroll right">
            <ChevronRight size={20} aria-hidden="true" />
          </button>
          <Link to={to} className="see-all">
            See all <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </header>
      <div className="shelf__track" ref={track}>
        {places.map((p) => (
          <PlaceCard key={p.id} place={p} variant="shelf" />
        ))}
      </div>
    </section>
  );
}
