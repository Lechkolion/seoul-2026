import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { LazyMotion, MotionConfig, domAnimation } from 'framer-motion';
import '@fontsource-variable/unbounded/index.css';
import '@fontsource/geist-mono/400.css';
import '@fontsource/geist-mono/500.css';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/pages.css';
import { registerSW } from 'virtual:pwa-register';
import { applyTheme } from './lib/store';
import { App } from './App';

applyTheme();

// New deploys activate right away (autoUpdate reloads the page); also check for one whenever the app is reopened.
const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && reg.update());
    setInterval(() => reg.update(), 30 * 60 * 1000);
  },
});
void updateSW;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <MotionConfig reducedMotion="user">
        <LazyMotion features={domAnimation} strict>
          <App />
        </LazyMotion>
      </MotionConfig>
    </HashRouter>
  </StrictMode>,
);
