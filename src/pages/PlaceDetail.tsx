import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarPlus,
  Car,
  CircleCheck,
  CircleHelp,
  Clock,
  ExternalLink,
  Footprints,
  Globe,
  Lightbulb,
  MapPin,
  Navigation,
  Phone,
  Quote,
  Repeat,
  Share2,
  Ticket,
  TrainFront,
  Wallet,
  Camera,
} from 'lucide-react';
import { useData } from '../lib/data';
import type { Place } from '../lib/types';
import { CATEGORY_LABEL, DOW_ORDER, lineInfo, seoulNow, trip } from '../lib/trip';
import { PRICE_HINT, compact, hostOf, mapLinks, openNow, priceLabel, telHref } from '../lib/place-utils';
import { useOverlay } from '../lib/nav';
import { Dialog } from '../components/Dialog';
import { Img } from '../components/Img';
import { Lightbox } from '../components/Lightbox';
import { TaxiCard } from '../components/TaxiCard';
import { AddToDay } from '../components/AddToDay';
import { BadgeRow, LineBadge, SaveButton, TripStrip } from '../components/bits';
import { Bubbles, MoonMark } from '../components/icons';
import { PlaceCard } from '../components/PlaceCard';

const DOW_LABEL: Record<string, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };

function km(a: Place, b: Place) {
  const R = 6371;
  const dLat = ((b.location.lat - a.location.lat) * Math.PI) / 180;
  const dLng = ((b.location.lng - a.location.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.location.lat * Math.PI) / 180) * Math.cos((b.location.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function Gallery({ place, onOpen }: { place: Place; onOpen: (i: number) => void }) {
  const [idx, setIdx] = useState(0);
  const imgs = place.images;
  if (!imgs.length) {
    return (
      <div className="gallery gallery--empty">
        <Img category={place.category} name={place.name} />
      </div>
    );
  }
  return (
    <div className="gallery">
      <div
        className="gallery__track"
        onScroll={(e) => {
          const el = e.currentTarget;
          const i = Math.round(el.scrollLeft / el.clientWidth);
          if (i !== idx) setIdx(i);
        }}
      >
        {imgs.slice(0, 8).map((im, i) => (
          <button key={i} type="button" className="gallery__slide" onClick={() => onOpen(i)} aria-label={`Open photo ${i + 1} of ${imgs.length}: ${im.alt}`}>
            <Img img={im} category={place.category} name={place.name} prefer={i === 0 ? 'full' : 'thumb'} eager={i === 0} sizes={i === 0 ? '(max-width: 900px) 100vw, 600px' : '(max-width: 900px) 100vw, 300px'} />
          </button>
        ))}
      </div>
      {imgs.length > 1 && (
        <div className="gallery__dots" aria-hidden="true">
          {imgs.slice(0, 8).map((_, i) => (
            <span key={i} className={i === idx ? 'is-on' : ''} />
          ))}
        </div>
      )}
      <span className="gallery__count mono" aria-hidden="true">
        {idx + 1}/{imgs.length}
      </span>
    </div>
  );
}

function Ratings({ place }: { place: Place }) {
  const { tripadvisor: ta, google: g, naver: n, kakao: k } = place.ratings;
  if (!ta && !g && !n && !k) return <p className="muted">No verified ratings found yet.</p>;
  return (
    <div className="ratings">
      {ta && (
        <a className="rcard rcard--ta" href={ta.url} target="_blank" rel="noreferrer noopener">
          <span className="rcard__src">Tripadvisor</span>
          {ta.score ? (
            <span className="rcard__score">
              <b>{ta.score.toFixed(1)}</b>
              <Bubbles score={ta.score} />
            </span>
          ) : (
            <span className="rcard__score muted">No score</span>
          )}
          {ta.count != null && <span className="rcard__n">{ta.count.toLocaleString()} reviews</span>}
          {ta.rank && <span className="rcard__rank">{ta.rank}</span>}
          <ExternalLink className="rcard__ext" size={14} aria-hidden="true" />
        </a>
      )}
      {g && (
        <a className="rcard" href={g.url} target="_blank" rel="noreferrer noopener">
          <span className="rcard__src">Google</span>
          {g.score ? (
            <span className="rcard__score">
              <b>{g.score.toFixed(1)}</b>
              <span className="muted">/ 5</span>
            </span>
          ) : null}
          {g.count != null && <span className="rcard__n">{compact(g.count)} reviews</span>}
          <ExternalLink className="rcard__ext" size={14} aria-hidden="true" />
        </a>
      )}
      {k && (
        <a className="rcard" href={k.url} target="_blank" rel="noreferrer noopener">
          <span className="rcard__src">Kakao Map</span>
          {k.score ? (
            <span className="rcard__score">
              <b>{k.score.toFixed(1)}</b>
              <span className="muted">/ 5</span>
            </span>
          ) : null}
          {k.count != null && <span className="rcard__n">{compact(k.count)} reviews</span>}
          <ExternalLink className="rcard__ext" size={14} aria-hidden="true" />
        </a>
      )}
      {n && (
        <a className="rcard rcard--naver" href={n.url} target="_blank" rel="noreferrer noopener">
          <span className="rcard__src">Naver</span>
          <span className="rcard__counts">
            {n.score ? (
              <span>
                <b>{n.score.toFixed(2)}</b> score
              </span>
            ) : null}
            {n.visitorReviews != null && (
              <span>
                <b>{compact(n.visitorReviews)}</b> visitor reviews
              </span>
            )}
            {n.blogReviews != null && (
              <span>
                <b>{compact(n.blogReviews)}</b> blog posts
              </span>
            )}
          </span>
          {n.keywords && n.keywords.length > 0 && (
            <span className="rcard__kw" lang="ko">
              {n.keywords.slice(0, 5).map((kw) => (
                <span key={kw}>“{kw}”</span>
              ))}
            </span>
          )}
          <ExternalLink className="rcard__ext" size={14} aria-hidden="true" />
        </a>
      )}
    </div>
  );
}

function Hours({ place }: { place: Place }) {
  const weekly = place.hours.weekly;
  const today = seoulNow().dow;
  const state = openNow(place);
  return (
    <div className="hours">
      <p className={`openstate openstate--${state.tone}`}>
        <Clock size={16} aria-hidden="true" /> {state.label}
      </p>
      {weekly && (
        <table className="hours__t">
          <caption className="sr-only">Weekly opening hours</caption>
          <tbody>
            {DOW_ORDER.map((d) => (
              <tr key={d} className={d === today ? 'is-today' : ''}>
                <th scope="row">{DOW_LABEL[d]}</th>
                <td className={weekly[d] && /closed/i.test(weekly[d]!) ? 'is-closed' : ''}>{weekly[d] ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {place.hours.lastOrder && <p className="muted small">Last order {place.hours.lastOrder}</p>}
      {place.hours.note && <p className="muted small">{place.hours.note}</p>}
    </div>
  );
}

function GettingThere({ place }: { place: Place }) {
  const r = place.route;
  const st = place.location.nearestStation;
  const links = mapLinks(place);
  return (
    <div className="getting">
      {r && (
        <div className="getting__sum">
          <div className="getting__big">
            <b>{r.totalMin}</b>
            <span>{r.outOfTown ? 'min by car' : 'min door to door'}</span>
          </div>
          <div className="getting__lines">
            {r.outOfTown ? (
              <span className="muted">
                <Car size={16} aria-hidden="true" /> Out of town · by car or taxi ({r.straightKm} km) — see tips for bus/train
              </span>
            ) : r.walkOnly ? (
              <span className="muted">
                <Footprints size={16} aria-hidden="true" /> Walkable from home
              </span>
            ) : (
              <>
                {r.lines.map((l) => (
                  <LineBadge key={l} id={l} />
                ))}
                <span className="muted small">
                  {r.transfers === 0 ? 'No transfers' : `${r.transfers} transfer${r.transfers > 1 ? 's' : ''}`} · from {r.homeStation}
                </span>
              </>
            )}
          </div>
        </div>
      )}
      {r && r.legs?.length > 0 && (
        <ol className="legs">
          {r.legs.map((leg, i) => (
            <li key={i} className={`leg leg--${leg.type}`} style={leg.line ? { ['--line' as string]: lineInfo(leg.line).color } : undefined}>
              <span className="leg__icon" aria-hidden="true">
                {leg.type === 'walk' ? <Footprints size={16} /> : leg.type === 'transfer' ? <Repeat size={16} /> : <TrainFront size={16} />}
              </span>
              <span className="leg__txt">
                {leg.type === 'walk' && (
                  <>
                    Walk{leg.to ? ` to ${leg.to}` : ''}
                    {leg.from && !leg.to ? ` from ${leg.from}` : ''}
                  </>
                )}
                {leg.type === 'transfer' && (
                  <>
                    Transfer{leg.from ? ` at ${leg.from}` : ''}
                    {leg.line && (
                      <>
                        {' '}to <LineBadge id={leg.line} size="sm" />
                      </>
                    )}
                  </>
                )}
                {leg.type === 'subway' && (
                  <>
                    {leg.line && <LineBadge id={leg.line} size="sm" />} {leg.from} → {leg.to}
                    {leg.stops ? <span className="muted"> · {leg.stops} stop{leg.stops === 1 ? '' : 's'}</span> : null}
                  </>
                )}
              </span>
              <span className="leg__min mono">{leg.minutes}′</span>
            </li>
          ))}
        </ol>
      )}
      {st && (
        <p className="station">
          <MapPin size={16} aria-hidden="true" />
          <span>
            Nearest: <b>{st.name}</b> <span lang="ko">{st.nameKo}</span> {st.lines.map((l) => <LineBadge key={l} id={l} size="sm" />)}
            {st.exit ? ` · ${st.exit}` : ''} · {st.walkMin} min walk
          </span>
        </p>
      )}
      {r?.taxi && (
        <div className="taxibox">
          <Car size={22} aria-hidden="true" />
          <div>
            <p>
              <b>Large taxi ≈ {r.taxi.minutes} min</b> · {r.taxi.distanceKm.toFixed(1)} km
            </p>
            {r.taxi.ventiKRW ? (
              <p className="taxibox__fares">
                <span>
                  Kakao T Venti <b>≈₩{r.taxi.ventiKRW.toLocaleString()}</b>
                </span>
                {r.taxi.tadaKRW ? (
                  <span>
                    TADA Next <b>≈₩{r.taxi.tadaKRW.toLocaleString()}</b>
                  </span>
                ) : null}
              </p>
            ) : (
              <p>≈ ₩{r.taxi.fareKRW.toLocaleString()} per car</p>
            )}
            <p className="muted small">{r.taxi.note || `You are ${trip.travellers}: book one large taxi (Kakao T Venti / TADA Next).`}</p>
          </div>
        </div>
      )}
      <div className="deeplinks">
        <a className="btn btn--map btn--naver" href={links.naver} target="_blank" rel="noreferrer noopener">
          <Navigation size={18} aria-hidden="true" /> Naver Map
        </a>
        <a className="btn btn--map btn--kakao" href={links.kakao} target="_blank" rel="noreferrer noopener">
          <Navigation size={18} aria-hidden="true" /> Kakao Map
        </a>
        <a className="btn btn--map" href={links.google} target="_blank" rel="noreferrer noopener">
          <Navigation size={18} aria-hidden="true" /> Google Maps
        </a>
      </div>
    </div>
  );
}

function Section({ title, icon, children, className = '' }: { title: string; icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`dsec ${className}`}>
      <h2 className="dsec__title">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

export function PlaceDetail({ onClose }: { onClose: () => void }) {
  const { id = '' } = useParams();
  const { byId, places, status } = useData();
  const place = byId.get(decodeURIComponent(id));
  const light = useOverlay<number>('lightbox');
  const taxi = useOverlay('taxi');
  const addday = useOverlay('addday');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    document.querySelector('.dlg__panel.detail')?.scrollTo({ top: 0 });
  }, [id]);

  const nearby = useMemo(() => {
    if (!place) return [];
    return places
      .filter((p) => p.id !== place.id)
      .map((p) => ({ p, d: km(place, p) }))
      .filter((x) => x.d < 1.6)
      .sort((a, b) => a.d - b.d)
      .slice(0, 6)
      .map((x) => x.p);
  }, [place, places]);

  const share = async () => {
    const url = location.href.split('?')[0];
    try {
      if (navigator.share) {
        await navigator.share({ title: place?.name, text: place?.summary, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* user cancelled */
    }
  };

  return (
    <Dialog open onClose={onClose} label={place ? place.name : 'Place'} variant="page" className="detail">
      <div className="detail__scroll">
        <div className="detail__topbar">
          <button type="button" className="icon-btn icon-btn--glass" onClick={onClose} aria-label="Close" data-autofocus>
            <ArrowLeft size={22} aria-hidden="true" />
          </button>
          {place && (
            <div className="detail__topact">
              <button type="button" className="icon-btn icon-btn--glass" onClick={share} aria-label="Share this place">
                <Share2 size={20} aria-hidden="true" />
              </button>
              <SaveButton id={place.id} name={place.name} variant="float" />
            </div>
          )}
        </div>
        {!place ? (
          <div className="detail__missing">
            {status === 'loading' ? <p>Loading…</p> : <p>This place isn’t in the guide (it may have been removed).</p>}
          </div>
        ) : (
          <>
            <Gallery place={place} onOpen={(i) => light.show(i)} />
            <div className="detail__content">
              <header className="detail__head">
                <p className="detail__meta">
                  {CATEGORY_LABEL[place.category]} · {place.subcategory} · {place.location.neighborhood}
                </p>
                <h1 className="detail__name">{place.name}</h1>
                {place.nameKo && (
                  <p className="detail__ko" lang="ko">
                    {place.nameKo}
                  </p>
                )}
                <BadgeRow place={place} max={9} />
                {place.summary && <p className="detail__summary">{place.summary}</p>}
                <div className="detail__actions">
                  <SaveButton id={place.id} name={place.name} variant="pill" />
                  <button type="button" className="btn btn--ghost" onClick={() => addday.show()}>
                    <CalendarPlus size={18} aria-hidden="true" /> Add to day
                  </button>
                  <button type="button" className="btn btn--ghost" onClick={() => taxi.show()}>
                    <Car size={18} aria-hidden="true" /> Show taxi driver
                  </button>
                  {copied && <span className="toast" role="status">Link copied</span>}
                </div>
              </header>

              <div className="detail__cols">
                <div className="detail__main">
                  <Section title="Ratings">
                    <Ratings place={place} />
                  </Section>

                  {place.description && (
                    <Section title="About">
                      <p className="prose">{place.description}</p>
                      {place.highlights.length > 0 && (
                        <ul className="highlights">
                          {place.highlights.map((h) => (
                            <li key={h}>{h}</li>
                          ))}
                        </ul>
                      )}
                    </Section>
                  )}

                  {place.tips.length > 0 && (
                    <section className="kkul">
                      <h2 className="kkul__title">
                        <Lightbulb size={18} aria-hidden="true" /> 꿀팁 <span>Insider tips</span>
                      </h2>
                      <ul>
                        {place.tips.map((t) => (
                          <li key={t}>{t}</li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {place.reviews.length > 0 && (
                    <Section title="What people say">
                      <ul className="reviews">
                        {place.reviews.map((r, i) => (
                          <li key={i} className="review">
                            <Quote size={18} className="review__q" aria-hidden="true" />
                            <p lang={r.lang}>{r.text}</p>
                            <p className="review__by">
                              <span className="review__src">{r.source}</span>
                              {r.author && <span>{r.author}</span>}
                              {r.date && <span>{r.date}</span>}
                              {r.paraphrased && <span className="muted">paraphrased</span>}
                              {r.url && (
                                <a href={r.url} target="_blank" rel="noreferrer noopener">
                                  source <ExternalLink size={12} aria-hidden="true" />
                                </a>
                              )}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </Section>
                  )}
                </div>

                <aside className="detail__side">
                  <Section title="Chuseok & your trip days" icon={<MoonMark size={16} />} className="dsec--chuseok">
                    <TripStrip place={place} />
                    <p className="muted small strip-legend">Moon = Chuseok holiday · ? = no confirmed hours that day</p>
                    <p className="chu-note">{place.chuseok.note || 'No Chuseok information found — call ahead.'}</p>
                    <p className={`verified ${place.chuseok.verified ? 'is-yes' : ''}`}>
                      {place.chuseok.verified ? <CircleCheck size={16} aria-hidden="true" /> : <CircleHelp size={16} aria-hidden="true" />}
                      {place.chuseok.verified ? 'Verified from a 2026 notice' : 'Not verified for 2026 — inferred'}
                      {place.chuseok.source && (
                        <a href={place.chuseok.source} target="_blank" rel="noreferrer noopener">
                          source
                        </a>
                      )}
                    </p>
                  </Section>

                  <Section title="Getting there">
                    <GettingThere place={place} />
                  </Section>

                  <Section title="Hours & price">
                    <Hours place={place} />
                    <p className="price">
                      <Wallet size={16} aria-hidden="true" />
                      <b className="mono">{priceLabel(place.price.level)}</b>
                      <span className="muted">{PRICE_HINT[place.price.level]}</span>
                      {place.price.note && <span>· {place.price.note}</span>}
                    </p>
                    {place.duration && <p className="small">Plan {place.duration}{place.bestTime ? ` · Best: ${place.bestTime}` : ''}</p>}
                    {place.reservation && (
                      <p className="small">
                        <Ticket size={14} aria-hidden="true" /> {place.reservation.recommended ? 'Reservation recommended' : 'Walk-in OK'}
                        {place.reservation.how ? ` · ${place.reservation.how}` : ''}
                      </p>
                    )}
                  </Section>

                  <div className="linkbtns">
                    {place.links.reservation && (
                      <a className="btn btn--primary" href={place.links.reservation} target="_blank" rel="noreferrer noopener">
                        <Ticket size={18} aria-hidden="true" /> Reserve
                      </a>
                    )}
                    {place.links.website && (
                      <a className="btn btn--ghost" href={place.links.website} target="_blank" rel="noreferrer noopener">
                        <Globe size={18} aria-hidden="true" /> Website
                      </a>
                    )}
                    {place.links.phone && (
                      <a className="btn btn--ghost" href={telHref(place.links.phone)}>
                        <Phone size={18} aria-hidden="true" /> Call
                      </a>
                    )}
                    {place.links.instagram && (
                      <a className="btn btn--ghost" href={place.links.instagram} target="_blank" rel="noreferrer noopener">
                        <Camera size={18} aria-hidden="true" /> Instagram
                      </a>
                    )}
                  </div>

                  <p className="address">
                    <MapPin size={16} aria-hidden="true" />
                    <span>
                      {place.location.address}
                      <br />
                      <span lang="ko" className="muted">
                        {place.location.addressKo}
                      </span>
                    </span>
                  </p>
                </aside>
              </div>

              {nearby.length > 0 && (
                <section className="dsec">
                  <h2 className="dsec__title">Nearby</h2>
                  <div className="rowlist">
                    {nearby.map((p) => (
                      <PlaceCard key={p.id} place={p} variant="row" />
                    ))}
                  </div>
                </section>
              )}

              <footer className="sources">
                <p>
                  Last verified <b>{place.lastVerified}</b>. Sources:{' '}
                  {place.sources.slice(0, 8).map((s, i) => (
                    <span key={s}>
                      {i > 0 && ', '}
                      <a href={s} target="_blank" rel="noreferrer noopener">
                        {hostOf(s)}
                      </a>
                    </span>
                  ))}
                </p>
              </footer>
            </div>

            <Lightbox open={light.open} onClose={light.close} images={place.images} start={light.data ?? 0} name={place.name} category={place.category} />
            <TaxiCard open={taxi.open} onClose={taxi.close} titleKo={place.nameKo || place.name} title={place.name} addressKo={place.location.addressKo} address={place.location.address} />
            <AddToDay open={addday.open} onClose={addday.close} place={place} />
          </>
        )}
      </div>
    </Dialog>
  );
}

