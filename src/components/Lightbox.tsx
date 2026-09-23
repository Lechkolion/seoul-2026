import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, X } from 'lucide-react';
import type { Category, PlaceImageExt } from '../lib/types';
import { Dialog } from './Dialog';
import { Img } from './Img';

interface Props {
  open: boolean;
  onClose: () => void;
  images: PlaceImageExt[];
  start: number;
  name: string;
  category: Category;
}

export function Lightbox({ open, onClose, images, start, name, category }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(start);

  useEffect(() => {
    if (!open) return;
    setIdx(start);
    requestAnimationFrame(() => {
      const el = track.current;
      if (el) el.scrollTo({ left: el.clientWidth * start, behavior: 'instant' as ScrollBehavior });
    });
  }, [open, start]);

  const go = (i: number) => {
    const el = track.current;
    if (!el) return;
    const n = Math.max(0, Math.min(images.length - 1, i));
    el.scrollTo({ left: el.clientWidth * n, behavior: 'smooth' });
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(idx + 1);
      if (e.key === 'ArrowLeft') go(idx - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const img = images[idx];
  return (
    <Dialog open={open} onClose={onClose} label={`${name} photos`} variant="full" className="lightbox">
      <div className="lightbox__top">
        <span className="lightbox__count mono">
          {idx + 1} / {images.length}
        </span>
        <button type="button" className="icon-btn icon-btn--glass" onClick={onClose} aria-label="Close photos" data-autofocus>
          <X size={24} aria-hidden="true" />
        </button>
      </div>
      <div
        className="lightbox__track"
        ref={track}
        onScroll={(e) => {
          const el = e.currentTarget;
          const i = Math.round(el.scrollLeft / el.clientWidth);
          if (i !== idx) setIdx(i);
        }}
      >
        {images.map((im, i) => (
          <figure key={i} className="lightbox__slide">
            <Img img={im} category={category} name={name} prefer="full" sizes="100vw" eager={Math.abs(i - start) <= 1} />
          </figure>
        ))}
      </div>
      {images.length > 1 && (
        <>
          <button type="button" className="lightbox__nav lightbox__nav--prev" onClick={() => go(idx - 1)} disabled={idx === 0} aria-label="Previous photo">
            <ChevronLeft size={28} aria-hidden="true" />
          </button>
          <button type="button" className="lightbox__nav lightbox__nav--next" onClick={() => go(idx + 1)} disabled={idx === images.length - 1} aria-label="Next photo">
            <ChevronRight size={28} aria-hidden="true" />
          </button>
        </>
      )}
      {img && (
        <figcaption className="lightbox__cap">
          <span>{img.alt}</span>
          <span className="lightbox__credit">
            Photo: {img.credit}
            {img.source && (
              <a href={img.source} target="_blank" rel="noreferrer noopener">
                Source <ExternalLink size={13} aria-hidden="true" />
              </a>
            )}
          </span>
        </figcaption>
      )}
    </Dialog>
  );
}
