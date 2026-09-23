import { useCallback } from 'react';
import { useLocation, useNavigate, type Location } from 'react-router-dom';

export interface NavState {
  background?: Location;
  overlay?: string;
  overlayData?: unknown;
}

export function useNavState(): NavState {
  return (useLocation().state ?? {}) as NavState;
}

/** Opens a place as a modal route over the current page (back button closes it). */
export function usePlaceOpener() {
  const loc = useLocation();
  const nav = useNavigate();
  return useCallback(
    (id: string) => {
      const st = (loc.state ?? {}) as NavState;
      const background = st.background ?? loc;
      nav(`/place/${encodeURIComponent(id)}`, { state: { background } });
    },
    [loc, nav],
  );
}

/** History-backed overlay (sheets, lightbox, taxi card). Opening pushes an entry; Back/Esc pops it. */
export function useOverlay<T = unknown>(name: string) {
  const loc = useLocation();
  const nav = useNavigate();
  const st = (loc.state ?? {}) as NavState;
  const open = st.overlay === name;
  const show = useCallback(
    (data?: T) => nav(loc.pathname + loc.search, { state: { ...st, overlay: name, overlayData: data } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loc, nav, name],
  );
  const close = useCallback(() => {
    if (open) nav(-1);
  }, [open, nav]);
  return { open, data: (open ? st.overlayData : undefined) as T | undefined, show, close };
}
