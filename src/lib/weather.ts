import { useEffect, useState } from 'react';

export interface Weather {
  temp: number;
  feels: number;
  code: number;
  isDay: boolean;
  wind: number;
  daily: { date: string; code: number; max: number; min: number; rain: number | null }[];
  fetchedAt: number;
}

const CACHE = 'sf26.weather';
const URL_ =
  'https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.978' +
  '&current=temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m' +
  '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
  '&timezone=Asia%2FSeoul&forecast_days=16';

export function describe(code: number): { label: string; kind: 'clear' | 'partly' | 'cloud' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm' } {
  if (code === 0) return { label: 'Clear', kind: 'clear' };
  if (code <= 2) return { label: 'Partly cloudy', kind: 'partly' };
  if (code === 3) return { label: 'Overcast', kind: 'cloud' };
  if (code <= 48) return { label: 'Fog', kind: 'fog' };
  if (code <= 57) return { label: 'Drizzle', kind: 'drizzle' };
  if (code <= 67 || (code >= 80 && code <= 82)) return { label: 'Rain', kind: 'rain' };
  if (code <= 77 || code === 85 || code === 86) return { label: 'Snow', kind: 'snow' };
  return { label: 'Thunderstorm', kind: 'storm' };
}

function readCache(): Weather | null {
  try {
    const raw = localStorage.getItem(CACHE);
    return raw ? (JSON.parse(raw) as Weather) : null;
  } catch {
    return null;
  }
}

/** Live Seoul weather from Open-Meteo. Fails quietly and falls back to the last good reading. */
export function useWeather() {
  const [w, setW] = useState<Weather | null>(() => readCache());
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const cached = readCache();
    if (cached && Date.now() - cached.fetchedAt < 20 * 60 * 1000) return;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    fetch(URL_, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => {
        const d = j.daily;
        const next: Weather = {
          temp: j.current.temperature_2m,
          feels: j.current.apparent_temperature,
          code: j.current.weather_code,
          isDay: !!j.current.is_day,
          wind: j.current.wind_speed_10m,
          daily: (d.time as string[]).map((date, i) => ({
            date,
            code: d.weather_code[i],
            max: d.temperature_2m_max[i],
            min: d.temperature_2m_min[i],
            rain: d.precipitation_probability_max?.[i] ?? null,
          })),
          fetchedAt: Date.now(),
        };
        setW(next);
        try {
          localStorage.setItem(CACHE, JSON.stringify(next));
        } catch {
          /* ignore */
        }
      })
      .catch(() => setFailed(true))
      .finally(() => clearTimeout(timer));
    return () => ctl.abort();
  }, []);
  return { weather: w, failed };
}
