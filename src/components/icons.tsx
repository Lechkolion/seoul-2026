import {
  Bath,
  CalendarDays,
  Coffee,
  Landmark,
  Martini,
  ShoppingBag,
  Sparkles,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';
import type { Category } from '../lib/types';

export const CATEGORY_ICON: Record<Category, LucideIcon> = {
  food: UtensilsCrossed,
  cafe: Coffee,
  bar: Martini,
  sight: Landmark,
  shopping: ShoppingBag,
  experience: Sparkles,
  wellness: Bath,
  event: CalendarDays,
};

/** Full-moon glyph used for Chuseok markers (not an emoji). */
export function MoonMark({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={`moonmark ${className}`} aria-hidden="true">
      <circle cx="8" cy="8" r="6.2" fill="currentColor" />
      <circle cx="10.2" cy="6.3" r="1.1" fill="#000" opacity=".12" />
      <circle cx="6.1" cy="9.6" r="1.5" fill="#000" opacity=".1" />
    </svg>
  );
}

/** Stylised Tripadvisor-like bubble score (5 dots), brand-neutral. */
export function Bubbles({ score }: { score: number }) {
  return (
    <span className="bubbles" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, score - i));
        return (
          <span key={i} className="bubble">
            <span style={{ width: `${fill * 100}%` }} />
          </span>
        );
      })}
    </span>
  );
}
