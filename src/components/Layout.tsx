import type { ReactNode } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Compass, Home as HomeIcon, Map as MapIcon, CalendarHeart, Info, Moon, Sun } from 'lucide-react';
import { actions, useStore } from '../lib/store';
import { MoonMark } from './icons';

const NAV = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  { to: '/explore', label: 'Explore', icon: Compass },
  { to: '/map', label: 'Map', icon: MapIcon },
  { to: '/plan', label: 'Plan', icon: CalendarHeart },
  { to: '/practical', label: 'Guide', icon: Info },
];

function ThemeToggle() {
  const theme = useStore((s) => s.theme);
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button type="button" className="icon-btn" onClick={() => actions.setTheme(next)} aria-label={`Switch to ${next} theme`}>
      {theme === 'dark' ? <Sun size={20} strokeWidth={1.7} aria-hidden="true" /> : <Moon size={20} strokeWidth={1.7} aria-hidden="true" />}
    </button>
  );
}

export function Brand() {
  return (
    <Link to="/" className="brand" aria-label="Seoul 2026 family guide — home">
      <span className="brand__orb" aria-hidden="true" />
      <span className="brand__word">
        SEOUL<span className="brand__yr">26</span>
      </span>
    </Link>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const planned = useStore((s) => s.saved.length);
  return (
    <div className="app">
      <button
        type="button"
        className="skip"
        onClick={() => {
          const el = document.getElementById('main');
          el?.focus();
        }}
      >
        Skip to content
      </button>
      <header className="topbar">
        <div className="topbar__inner">
          <Brand />
          <nav className="topnav" aria-label="Main">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className="topnav__a">
                {n.label === 'Guide' ? 'Practical' : n.label}
              </NavLink>
            ))}
            <NavLink to="/chuseok" className="topnav__a topnav__a--moon">
              <MoonMark size={12} /> Chuseok
            </NavLink>
          </nav>
          <div className="topbar__actions">
            <NavLink to="/chuseok" className="icon-btn icon-btn--moon mobile-only" aria-label="Chuseok calendar">
              <MoonMark size={18} />
            </NavLink>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <nav className="bottomnav" aria-label="Main">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className="bottomnav__a">
            <span className="bottomnav__icon">
              <n.icon size={22} strokeWidth={1.7} aria-hidden="true" />
              {n.to === '/plan' && planned > 0 && <span className="bottomnav__count">{planned}</span>}
            </span>
            <span className="bottomnav__label">{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
