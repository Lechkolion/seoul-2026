import { useEffect, useRef, useState } from 'react';
import type { Category, PlaceImageExt } from '../lib/types';
import { imgSources } from '../lib/place-utils';
import { CATEGORY_COLOR } from '../lib/trip';
import { CATEGORY_ICON } from './icons';

interface Props {
  img?: PlaceImageExt;
  category: Category;
  name: string;
  sizes?: string;
  prefer?: 'thumb' | 'full';
  eager?: boolean;
  className?: string;
}

/** Lazy image with skeleton shimmer, srcset, a one-step retry at full size, and a designed fallback. */
export function Img({ img, category, name, sizes = '(max-width: 640px) 100vw, 33vw', prefer = 'thumb', eager, className = '' }: Props) {
  const initial = imgSources(img, prefer);
  const [src, setSrc] = useState(initial.src);
  const [srcSet, setSrcSet] = useState(initial.srcSet);
  const [state, setState] = useState<'loading' | 'ok' | 'error'>(initial.src ? 'loading' : 'error');

  const imgRef = useRef<HTMLImageElement>(null);

  // Reset only when the resolved source really changes (img objects may be recreated each render).
  useEffect(() => {
    if (initial.src === src) return;
    setSrc(initial.src);
    setSrcSet(initial.srcSet);
    setState(initial.src ? 'loading' : 'error');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.src, initial.srcSet]);

  // A cached image can finish loading before React attaches onLoad.
  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) setState('ok');
  }, [src]);

  const onError = () => {
    if (src !== initial.full && initial.full) {
      setSrc(initial.full);
      setSrcSet(undefined);
      return;
    }
    setState('error');
  };

  const Icon = CATEGORY_ICON[category];
  return (
    <div className={`img ${className} img--${state}`} style={{ ['--cat' as string]: CATEGORY_COLOR[category] }}>
      {state !== 'error' && src && (
        <img
          ref={imgRef}
          src={src}
          srcSet={srcSet}
          sizes={srcSet ? sizes : undefined}
          alt={img?.alt || name}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setState('ok')}
          onError={onError}
          fetchPriority={eager ? 'high' : undefined}
        />
      )}
      {state === 'error' && (
        <div className="img__fallback" role="img" aria-label={`${name} (no photo available)`}>
          <Icon size={28} strokeWidth={1.4} aria-hidden="true" />
          <span>{name}</span>
        </div>
      )}
    </div>
  );
}
