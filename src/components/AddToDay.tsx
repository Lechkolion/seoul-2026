import { Check, CircleAlert, X } from 'lucide-react';
import type { Place, TripDate } from '../lib/types';
import { TRIP_DAYS, isChuseok } from '../lib/trip';
import { dayStatus } from '../lib/place-utils';
import { actions, useStore } from '../lib/store';
import { Dialog } from './Dialog';
import { MoonMark } from './icons';

export function AddToDay({ open, onClose, place }: { open: boolean; onClose: () => void; place: Place }) {
  const plan = useStore((s) => s.plan);
  return (
    <Dialog open={open} onClose={onClose} label={`Add ${place.name} to a day`} variant="center" className="addday">
      <header className="addday__head">
        <div>
          <p className="kicker">Add to plan</p>
          <h2>{place.name}</h2>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close" data-autofocus>
          <X size={22} aria-hidden="true" />
        </button>
      </header>
      <ul className="addday__list">
        {TRIP_DAYS.map((d) => {
          const date = d.date as TripDate;
          const inDay = (plan[date] ?? []).includes(place.id);
          const s = dayStatus(place, date);
          return (
            <li key={d.date}>
              <button
                type="button"
                className={`addday__day ${inDay ? 'is-on' : ''} is-${s}`}
                aria-pressed={inDay}
                onClick={() => (inDay ? actions.removeFromDay(date, place.id) : actions.addToDay(date, place.id))}
              >
                <span className="addday__date">
                  <b>{Number(d.date.slice(8))}</b>
                  <span>{d.dow}</span>
                </span>
                <span className="addday__label">
                  {d.label}
                  {isChuseok(d.date) && <MoonMark size={12} className="moon-inline" />}
                  {s === 'closed' && (
                    <span className="warn">
                      <CircleAlert size={14} aria-hidden="true" /> Closed this day
                    </span>
                  )}
                  {s === 'unknown' && isChuseok(d.date) && <span className="warn warn--soft">Chuseok hours unconfirmed</span>}
                  {s === 'short' && <span className="warn warn--soft">Short hours</span>}
                </span>
                <span className="addday__check" aria-hidden="true">
                  {inDay && <Check size={18} />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <button type="button" className="btn btn--primary btn--block" onClick={onClose}>
        Done
      </button>
    </Dialog>
  );
}
