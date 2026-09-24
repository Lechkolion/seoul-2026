import { useState } from 'react';
import {
  Banknote,
  Car,
  Copy,
  CreditCard,
  House,
  LockKeyhole,
  Navigation,
  Phone,
  Receipt,
  ShieldAlert,
  Smartphone,
  Users,
  Wifi,
  HandCoins,
  Languages,
} from 'lucide-react';
import { useData } from '../lib/data';
import { trip } from '../lib/trip';
import { useOverlay } from '../lib/nav';
import { forgetKey } from '../lib/crypto';
import { TaxiCard } from '../components/TaxiCard';
import { LineBadge } from '../components/bits';

const APPS = [
  { name: 'Naver Map', ko: '네이버 지도', why: 'Best transit + walking directions in Korea, English UI. Use this instead of Google Maps.' },
  { name: 'Kakao T', ko: '카카오 T', why: 'Hail taxis (incl. large “Venti” vans for 5). Works with foreign cards after sign-up.' },
  { name: 'TADA', ko: '타다', why: 'Book “TADA Next” — a clean, roomy van (Staria/Carnival) that fits all 5. Fixed price shown before you book.' },
  { name: 'Kakao Map', ko: '카카오맵', why: 'Second opinion for directions; great subway exit info.' },
  { name: 'Papago', ko: '파파고', why: 'Translation that understands Korean menus — use the camera mode.' },
  { name: 'CatchTable Global', ko: '캐치테이블', why: 'Reservations for many top restaurants; English version available.' },
  { name: 'Tabling', ko: '테이블링', why: 'Remote queue for popular walk-in spots — join the line before you arrive.' },
];

const PHRASES = [
  { en: 'Hello', ko: '안녕하세요', ro: 'an-nyeong-ha-se-yo' },
  { en: 'Thank you', ko: '감사합니다', ro: 'gam-sa-ham-ni-da' },
  { en: 'Table for five, please', ko: '다섯 명이에요', ro: 'da-seot myeong-i-e-yo' },
  { en: 'This one, please', ko: '이거 주세요', ro: 'i-geo ju-se-yo' },
  { en: 'Not spicy, please', ko: '안 맵게 해 주세요', ro: 'an maep-ge hae ju-se-yo' },
  { en: 'Is there an English menu?', ko: '영어 메뉴 있어요?', ro: 'yeong-eo me-nyu i-sseo-yo?' },
  { en: 'The bill, please', ko: '계산해 주세요', ro: 'gye-san-hae ju-se-yo' },
  { en: 'Where is the restroom?', ko: '화장실 어디예요?', ro: 'hwa-jang-sil eo-di-ye-yo?' },
  { en: 'Please take me here', ko: '여기로 가 주세요', ro: 'yeo-gi-ro ga ju-se-yo' },
  { en: 'Tax refund, please', ko: '택스 리펀 돼요?', ro: 'taek-seu ri-peon dwae-yo?' },
];

const EMERGENCY = [
  { n: '112', label: 'Police' },
  { n: '119', label: 'Fire & ambulance' },
  { n: '1330', label: 'Korea Travel Hotline — English, 24/7, also interprets' },
  { n: '120', label: 'Seoul Dasan call center — city info, English option' },
];

export function PracticalPage() {
  const { home } = useData();
  const taxi = useOverlay('taxi-home');
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!home) return;
    try {
      await navigator.clipboard.writeText(home.addressKo);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="wrap page practical">
      <header className="page__head">
        <p className="kicker">Practical</p>
        <h1 className="page__title">Know before you go</h1>
        <p className="page__lede">Everything for a smooth week: getting home, getting around, paying, and staying connected.</p>
      </header>

      {home && (
        <section className="homecard" aria-labelledby="homecard-t">
          <div className="homecard__glow" aria-hidden="true" />
          <p className="kicker">
            <House size={14} aria-hidden="true" /> {home.label || 'Home'} · {trip.home.neighborhood}
          </p>
          <h2 id="homecard-t" className="homecard__addr" lang="ko">
            {home.addressKo}
          </h2>
          <p className="homecard__en">{home.address}</p>
          <div className="homecard__btns">
            <button type="button" className="btn btn--primary btn--lg" onClick={() => taxi.show()}>
              <Car size={20} aria-hidden="true" /> Take me home — taxi card
            </button>
            <button type="button" className="btn btn--ghost" onClick={copy}>
              <Copy size={18} aria-hidden="true" /> {copied ? 'Copied' : 'Copy address'}
            </button>
            <a className="btn btn--ghost" href={`https://map.kakao.com/link/to/${encodeURIComponent(home.label || 'Home')},${home.lat},${home.lng}`} target="_blank" rel="noreferrer noopener">
              <Navigation size={18} aria-hidden="true" /> Kakao Map
            </a>
            <a className="btn btn--ghost" href={`https://map.naver.com/p/search/${encodeURIComponent(home.addressKo)}`} target="_blank" rel="noreferrer noopener">
              <Navigation size={18} aria-hidden="true" /> Naver Map
            </a>
          </div>
          <ul className="homecard__st">
            {trip.home.stations.map((s) => (
              <li key={s.name}>
                {s.lines.map((l) => (
                  <LineBadge key={l} id={l} />
                ))}
                <span>
                  <b>{s.name}</b> <span lang="ko" className="muted">{s.nameKo}</span>
                </span>
                <span className="mono">{s.walkMin} min walk</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="pgrid">
        <section className="pcard">
          <h2>
            <Users size={20} aria-hidden="true" /> Taxis for five
          </h2>
          <p>A regular Seoul taxi takes 4 passengers. As a group of {trip.travellers}, book one large van taxi so everyone rides together — every taxi price on this site assumes that:</p>
          <ul>
            <li>
              <b>Kakao T Venti</b> — ₩4,000 for the first 1.5 km, then ₩100 per 123 m plus ₩100 per 40 s. Surge 0.8–2× at busy times.
            </li>
            <li>
              <b>TADA Next</b> — ₩5,000 base, ₩100 per 143 m plus ₩100 per 30 s (first 8 km). Surge 0.8–4×, so compare both apps at rush hour.
            </li>
          </ul>
          <p>Home → Gangnam Stn ≈ ₩7–9k; home → Jamsil ≈ ₩16–17k; home → Gwanghwamun ≈ ₩18–19k (normal demand). Both apps show the price before you confirm. Fallback: two regular taxis.</p>
          <p className="muted">Pay by card or T-money in the taxi. Late-night surcharge applies from 22:00.</p>
        </section>

        <section className="pcard">
          <h2>
            <CreditCard size={20} aria-hidden="true" /> T-money &amp; Climate Card
          </h2>
          <p>
            Buy a <b>T-money</b> card at any convenience store and top it up with cash; tap in and out on subway and bus (transfers are discounted). Each person needs their own card.
          </p>
          <p>
            Visitors can also buy a short-term <b>Climate Card</b> (기후동행카드) for unlimited Seoul subway and bus rides over a few days — worth it if you ride a lot. Check the current price at station machines.
          </p>
        </section>

        <section className="pcard">
          <h2>
            <Receipt size={20} aria-hidden="true" /> Tax refund
          </h2>
          <p>
            Carry passports when shopping. Many stores with a <b>Tax Free</b> sign deduct VAT immediately at checkout; otherwise keep receipts and use the refund kiosks downtown or at Incheon Airport before check-in.
          </p>
        </section>

        <section className="pcard">
          <h2>
            <HandCoins size={20} aria-hidden="true" /> Money &amp; tipping
          </h2>
          <p>
            <b>No tipping</b>, anywhere. Cards are accepted almost everywhere, including taxis and markets; keep some cash for street stalls. Many restaurants: pay at the counter on the way out.
          </p>
        </section>

        <section className="pcard">
          <h2>
            <Wifi size={20} aria-hidden="true" /> Wi-Fi &amp; data
          </h2>
          <p>Free Wi-Fi is everywhere (subway, cafés, “Seoul Free Wi-Fi” in public spaces). For maps on the go an eSIM is the easiest option — install before you fly. This guide works offline once opened.</p>
        </section>

        <section className="pcard">
          <h2>
            <Banknote size={20} aria-hidden="true" /> Cash
          </h2>
          <p>Convenience-store ATMs (GS25, CU, 7-Eleven) accept foreign cards 24/7 — useful while banks are closed for Chuseok (24–26 Sep).</p>
        </section>
      </div>

      <section className="psec">
        <h2 className="section-title">
          <Smartphone size={22} aria-hidden="true" /> Apps to install
        </h2>
        <ul className="apps">
          {APPS.map((a) => (
            <li key={a.name} className="appitem">
              <span className="appitem__icon" aria-hidden="true">
                {a.name.slice(0, 1)}
              </span>
              <span>
                <b>{a.name}</b> <span lang="ko" className="muted">{a.ko}</span>
                <span className="appitem__why">{a.why}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="psec">
        <h2 className="section-title">
          <ShieldAlert size={22} aria-hidden="true" /> Emergency numbers
        </h2>
        <ul className="emerg">
          {EMERGENCY.map((e) => (
            <li key={e.n}>
              <a href={`tel:${e.n}`} className="emerg__a">
                <span className="emerg__n mono">{e.n}</span>
                <span>{e.label}</span>
                <Phone size={18} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="psec">
        <h2 className="section-title">
          <Languages size={22} aria-hidden="true" /> Useful phrases
        </h2>
        <ul className="phrases">
          {PHRASES.map((p) => (
            <li key={p.en}>
              <span className="phrases__en">{p.en}</span>
              <span className="phrases__ko" lang="ko">
                {p.ko}
              </span>
              <span className="phrases__ro">{p.ro}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="psec psec--quiet">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            forgetKey();
            location.reload();
          }}
        >
          <LockKeyhole size={18} aria-hidden="true" /> Lock this device
        </button>
      </section>

      {home && <TaxiCard open={taxi.open} onClose={taxi.close} titleKo="집으로 가 주세요" title="Take me home" addressKo={home.addressKo} address={home.address} kind="home" />}
    </div>
  );
}
