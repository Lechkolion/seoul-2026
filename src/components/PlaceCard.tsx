import { memo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { Place } from '../lib/types';
import { CATEGORY_LABEL } from '../lib/trip';
import { priceLabel } from '../lib/place-utils';
import type { NavState } from '../lib/nav';
import { Img } from './Img';
import { ChuseokFlag, RatingChip, SaveButton, TimeChip } from './bits';

interface Props {
  place: Place;
  variant?: 'grid' | 'shelf' | 'row';
  eager?: boolean;
}

function CardBase({ place, variant = 'grid', eager }: Props) {
  const loc = useLocation();
  const st = (loc.state ?? {}) as NavState;
  const background = st.background ?? loc;
  const meta = [place.subcategory || CATEGORY_LABEL[place.category], place.location.neighborhood].filter(Boolean).join(' · ');

  return (
    <article className={`card card--${variant}`}>
      <div className="card__media">
        <Img
          img={place.images[0]}
          category={place.category}
          name={place.name}
          eager={eager}
          sizes={variant === 'shelf' ? '300px' : variant === 'row' ? '120px' : '(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 33vw'}
        />
        <div className="card__overlay" aria-hidden="true" />
        {variant !== 'row' && (
          <div className="card__top">
            <ChuseokFlag place={place} />
          </div>
        )}
        {variant !== 'row' && (
          <div className="card__bottom">
            <TimeChip place={place} />
          </div>
        )}
      </div>
      <div className="card__body">
        <p className="card__meta">{meta}</p>
        <h3 className="card__title">
          <Link to={`/place/${encodeURIComponent(place.id)}`} state={{ background }} className="card__link">
            {place.name}
          </Link>
        </h3>
        {place.nameKo && <p className="card__ko" lang="ko">{place.nameKo}</p>}
        <div className="card__facts">
          <RatingChip place={place} />
          <span className="card__price" aria-label={`Price level ${place.price.level} of 4`}>
            {priceLabel(place.price.level)}
          </span>
          {variant === 'row' && <TimeChip place={place} />}
        </div>
        {variant === 'grid' && place.summary && <p className="card__summary">{place.summary}</p>}
        {variant === 'row' && <ChuseokFlag place={place} />}
      </div>
      <SaveButton id={place.id} name={place.name} />
    </article>
  );
}

export const PlaceCard = memo(CardBase);
