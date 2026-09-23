/**
 * DEV ONLY — clearly fake places used when public/data/places.json is missing.
 * Imported behind `import.meta.env.DEV`, so it is never part of a production build.
 */
import type { Category, DayStatus, Place } from '../types/place';

const CATS: Category[] = ['food', 'food', 'food', 'cafe', 'bar', 'sight', 'shopping', 'experience', 'wellness', 'event'];
const HOODS = [
  ['Seocho', 'Seocho-gu', 37.4919, 127.0077, 'Seocho', '서초역', ['2']],
  ['Sinsa', 'Gangnam-gu', 37.5163, 127.0203, 'Sinsa', '신사역', ['3', 'SB']],
  ['Seongsu', 'Seongdong-gu', 37.5446, 127.0557, 'Seongsu', '성수역', ['2']],
  ['Jamsil', 'Songpa-gu', 37.5133, 127.1001, 'Jamsil', '잠실역', ['2', '8']],
  ['Hannam', 'Yongsan-gu', 37.5344, 127.0006, 'Hangangjin', '한강진역', ['6']],
  ['Jongno', 'Jongno-gu', 37.5704, 126.9921, 'Jongno 3-ga', '종로3가역', ['1', '3', '5']],
  ['Yeouido', 'Yeongdeungpo-gu', 37.5216, 126.9244, 'Yeouido', '여의도역', ['5', '9']],
  ['Samseong', 'Gangnam-gu', 37.5088, 127.0631, 'Samseong', '삼성역', ['2']],
] as const;
const SUBS: Record<Category, string[]> = {
  food: ['Korean BBQ', 'Italian', 'Noodles & naengmyeon', 'Sushi & omakase', 'Korean fine dining'],
  cafe: ['Coffee', 'Bakery', 'Dessert'],
  bar: ['Cocktail bar', 'Rooftop bar', 'Whisky bar'],
  sight: ['Palace', 'Museum', 'Viewpoint'],
  shopping: ['Department store', 'Flagship', 'Market'],
  experience: ['VR arcade', 'Immersive art', 'Cooking class'],
  wellness: ['Jjimjilbang', 'Spa'],
  event: ['Festival', 'Exhibition'],
};
const DATES = ['2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30'] as const;
const IMG = [
  'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Korean_barbecue-Samgyeopsal-05.jpg/1280px-Korean_barbecue-Samgyeopsal-05.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Gyeongbokgung_palace.jpg/1280px-Gyeongbokgung_palace.jpg',
  'https://example.invalid/broken-image-to-test-fallback.jpg',
];

function rnd(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

export const mockPlaces: Place[] = Array.from({ length: 64 }, (_, i) => {
  const r = (k: number) => rnd(i * 13 + k);
  const cat = CATS[i % CATS.length];
  const h = HOODS[i % HOODS.length];
  const sub = SUBS[cat][i % SUBS[cat].length];
  const lat = h[2] + (r(1) - 0.5) * 0.012;
  const lng = h[3] + (r(2) - 0.5) * 0.014;
  const total = 8 + Math.round(r(3) * 50);
  const statuses: DayStatus[] = ['open', 'closed', 'unknown', 'short'];
  const tripDays = Object.fromEntries(DATES.map((d, j) => [d, j >= 1 && j <= 3 ? statuses[Math.floor(r(10 + j) * 4)] : r(20 + j) > 0.85 ? 'closed' : 'open'])) as Place['tripDays'];
  const hasTA = r(4) > 0.2;
  return {
    id: `mock-${String(i + 1).padStart(2, '0')}`,
    name: `MOCK ${sub} ${String(i + 1).padStart(2, '0')}`,
    nameKo: `가짜 장소 ${i + 1}`,
    category: cat,
    subcategory: sub,
    cuisine: cat === 'food' || cat === 'cafe' ? [sub] : undefined,
    tags: [r(5) > 0.5 ? 'rainy-day' : 'outdoor', r(6) > 0.6 ? 'high-tech' : 'group-friendly', 'english-menu'],
    vibes: [r(7) > 0.5 ? 'futuristic' : 'cozy', r(8) > 0.5 ? 'view' : 'minimal'],
    summary: 'Fake development record — shows layout only. Not a real place.',
    description: 'This is placeholder text generated for local development when the real data file is missing. Nothing here is real: names, ratings, hours and addresses are invented for layout testing only.',
    highlights: ['Placeholder highlight one', 'Placeholder highlight two'],
    tips: ['Placeholder tip for layout testing', 'Second placeholder tip'],
    badges: { futuristic: r(6) > 0.6, valueForMoney: r(9) > 0.6, hiddenGem: r(11) > 0.75, familyFriendly: true, michelin: r(12) > 0.85 ? 'bib' : undefined, mustSee: cat === 'sight' },
    ratings: {
      tripadvisor: hasTA ? { score: Math.round((3.8 + r(13) * 1.2) * 2) / 2, count: Math.round(r(14) * 3000), rank: `#${1 + Math.round(r(15) * 500)} (mock)`, url: 'https://example.invalid/' } : undefined,
      google: { score: Math.round((3.9 + r(16)) * 10) / 10, count: Math.round(r(17) * 9000), url: 'https://example.invalid/' },
      naver: { visitorReviews: Math.round(r(18) * 5000), blogReviews: Math.round(r(19) * 2000), keywords: ['가짜 키워드', '테스트'], url: 'https://example.invalid/' },
    },
    reviews: [{ source: 'TripAdvisor', text: 'Placeholder review text for layout testing only.', paraphrased: true, lang: 'en' }],
    price: { level: (1 + (i % 4)) as 1 | 2 | 3 | 4, note: 'Mock price' },
    hours: { weekly: { mon: 'closed', tue: '11:30-22:00', wed: '11:30-22:00', thu: '11:30-22:00', fri: '11:30-15:00,17:00-23:30', sat: '10:00-02:00', sun: '10:00-21:00' }, lastOrder: '21:00' },
    tripDays,
    chuseok: { status: 'partial', note: 'Mock: closed on Chuseok day (fake).', verified: r(21) > 0.7 },
    location: { address: `${i + 1} Mock-ro, ${h[1]}, Seoul`, addressKo: `서울 가짜로 ${i + 1}`, district: h[1], neighborhood: h[0], lat, lng, nearestStation: { name: h[4], nameKo: h[5], lines: [...h[6]], exit: `Exit ${1 + (i % 8)}`, walkMin: 3 + (i % 9) } },
    links: { website: 'https://example.invalid/', phone: '+82-2-000-0000' },
    images: [0, 1, 2].map((k) => ({ url: IMG[(i + k) % IMG.length], source: 'https://commons.wikimedia.org/', credit: 'Wikimedia Commons (mock)', alt: 'Mock image' })),
    duration: '1–2 h',
    goodFor: ['Family of 5'],
    sources: ['https://example.invalid/'],
    lastVerified: '2026-09-23',
    route: {
      totalMin: total,
      transfers: total > 30 ? 1 : 0,
      lines: total > 30 ? ['3', h[6][0]] : ['3'],
      homeStation: 'Nambu Bus Terminal',
      legs: [
        { type: 'walk', to: 'Nambu Bus Terminal', minutes: 6 },
        { type: 'subway', line: '3', from: 'Nambu Bus Terminal', to: total > 30 ? 'Transfer stn' : h[4], stops: 4, minutes: Math.round(total / 3) },
        ...(total > 30 ? [{ type: 'transfer' as const, from: 'Transfer stn', minutes: 4 }, { type: 'subway' as const, line: h[6][0], from: 'Transfer stn', to: h[4], stops: 3, minutes: 8 }] : []),
        { type: 'walk', from: h[4], minutes: 5 },
      ],
      taxi: { minutes: Math.round(total * 0.6), distanceKm: total / 4, fareKRW: 4800 + total * 250, taxisNeeded: 2, note: '' },
      straightKm: total / 5,
    },
  };
});
