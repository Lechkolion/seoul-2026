import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import type { Home as HomeT } from './lib/types';
import { DataProvider } from './lib/data';
import type { NavState } from './lib/nav';
import { Gate } from './components/Gate';
import { Layout } from './components/Layout';
import { HomePage } from './pages/Home';
import { ExplorePage } from './pages/Explore';
import { PlanPage } from './pages/Plan';
import { ChuseokPage } from './pages/Chuseok';
import { PracticalPage } from './pages/Practical';
import { PlaceDetail } from './pages/PlaceDetail';
import { NotFound } from './pages/NotFound';

const MapPage = lazy(() => import('./pages/MapPage'));

function ScrollToTop() {
  const loc = useLocation();
  const st = (loc.state ?? {}) as NavState;
  const key = st.background ? st.background.pathname : loc.pathname;
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [key]);
  return null;
}

/** Place detail opened without a background page (shared link / reload): show Home behind it. */
function StandalonePlace() {
  const nav = useNavigate();
  const close = useCallback(() => nav('/', { replace: true }), [nav]);
  return (
    <>
      <HomePage />
      <PlaceDetail onClose={close} />
    </>
  );
}

function ModalPlace() {
  const nav = useNavigate();
  const close = useCallback(() => nav(-1), [nav]);
  return <PlaceDetail onClose={close} />;
}

export function App() {
  const [home, setHome] = useState<HomeT | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const loc = useLocation();
  const st = (loc.state ?? {}) as NavState;
  const background = st.background;

  const onUnlock = useCallback((h: HomeT) => {
    setHome(h);
    setUnlocked(true);
  }, []);

  if (!unlocked) return <Gate onUnlock={onUnlock} />;

  return (
    <DataProvider home={home}>
      <ScrollToTop />
      <Layout>
        <Suspense fallback={<div className="page-loading" aria-busy="true" />}>
          <Routes location={background ?? loc}>
            <Route path="/" element={<HomePage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/plan" element={<PlanPage />} />
            <Route path="/chuseok" element={<ChuseokPage />} />
            <Route path="/practical" element={<PracticalPage />} />
            <Route path="/place/:id" element={<StandalonePlace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </Layout>
      {background && (
        <Routes>
          <Route path="/place/:id" element={<ModalPlace />} />
        </Routes>
      )}
    </DataProvider>
  );
}
