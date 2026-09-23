import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Moon, Sun, Umbrella } from 'lucide-react';
import { describe, useWeather } from '../lib/weather';
import { TRIP_DAYS, isChuseok } from '../lib/trip';

const ICON = { clear: Sun, partly: CloudSun, cloud: Cloud, fog: CloudFog, drizzle: CloudDrizzle, rain: CloudRain, snow: CloudSnow, storm: CloudLightning };

export function WeatherIcon({ code, isDay = true, size = 20 }: { code: number; isDay?: boolean; size?: number }) {
  const k = describe(code).kind;
  const I = k === 'clear' && !isDay ? Moon : ICON[k];
  return <I size={size} strokeWidth={1.6} aria-hidden="true" />;
}

export function WeatherCard() {
  const { weather, failed } = useWeather();
  if (!weather) {
    return (
      <div className="weather weather--empty glass">
        <Cloud size={20} aria-hidden="true" />
        <span>{failed ? 'Weather unavailable offline' : 'Loading Seoul weather…'}</span>
      </div>
    );
  }
  const d = describe(weather.code);
  const tripDaily = weather.daily.filter((x) => TRIP_DAYS.some((t) => t.date === x.date));
  return (
    <section className="weather glass" aria-label="Seoul weather">
      <div className="weather__now">
        <WeatherIcon code={weather.code} isDay={weather.isDay} size={34} />
        <div>
          <p className="weather__temp">
            {Math.round(weather.temp)}°<span className="weather__unit">C</span>
          </p>
          <p className="weather__desc">
            {d.label} · feels {Math.round(weather.feels)}°
          </p>
        </div>
      </div>
      {tripDaily.length > 0 && (
        <ol className="weather__days" aria-label="Forecast for trip days">
          {tripDaily.map((x) => (
            <li key={x.date} className={isChuseok(x.date) ? 'is-chuseok' : ''}>
              <span className="weather__dn">{Number(x.date.slice(8))}</span>
              <WeatherIcon code={x.code} size={18} />
              <span className="weather__hi">{Math.round(x.max)}°</span>
              {x.rain != null && x.rain >= 40 && (
                <span className="weather__rain">
                  <Umbrella size={11} aria-hidden="true" />
                  {x.rain}%
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
      <p className="weather__src">Open-Meteo · Seoul</p>
    </section>
  );
}
