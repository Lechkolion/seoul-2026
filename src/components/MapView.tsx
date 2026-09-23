/// <reference types="leaflet.markercluster" />
import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, CircleMarker } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css';
import { AnimatePresence, m } from 'framer-motion';
import { ArrowRight, House, LocateFixed, X } from 'lucide-react';
import type { Category, Home, Place } from '../lib/types';
import { CATEGORY_COLOR, CATEGORY_LABEL, trip } from '../lib/trip';
import { useStore } from '../lib/store';
import { usePlaceOpener } from '../lib/nav';
import { priceLabel } from '../lib/place-utils';
import { Img } from './Img';
import { ChuseokFlag, RatingChip, TimeChip } from './bits';

const SEOUL: [number, number] = [37.535, 127.0];
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas';

const iconCache = new Map<string, L.DivIcon>();
function pinIcon(cat: Category, selected: boolean) {
  const key = `${cat}-${selected}`;
  let icon = iconCache.get(key);
  if (!icon) {
    const size = selected ? 30 : 22;
    icon = L.divIcon({
      className: 'pin-wrap',
      html: `<span class="pin ${selected ? 'is-sel' : ''}" style="--c:${CATEGORY_COLOR[cat]}"></span>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
    iconCache.set(key, icon);
  }
  return icon;
}

const HOUSE_SVG =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
const homeIcon = L.divIcon({ className: 'pin-wrap', html: `<span class="pin-home">${HOUSE_SVG}</span>`, iconSize: [40, 40], iconAnchor: [20, 20] });

function clusterIcon(cluster: L.MarkerCluster) {
  const n = cluster.getChildCount();
  const size = n < 10 ? 38 : n < 50 ? 46 : 54;
  return L.divIcon({ html: `<span class="cluster"><b>${n}</b></span>`, className: 'cluster-wrap', iconSize: [size, size] });
}

function FitBounds({ places, home }: { places: Place[]; home: Home | null }) {
  const map = useMap();
  const sig = places.map((p) => p.id).join('|');
  useEffect(() => {
    const pts = places.map((p) => [p.location.lat, p.location.lng] as [number, number]);
    if (home) pts.push([home.lat, home.lng]);
    if (pts.length === 0) return;
    if (pts.length === 1) map.setView(pts[0], 15);
    else map.fitBounds(L.latLngBounds(pts), { padding: [48, 48], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, map]);
  return null;
}

function Controls({ home }: { home: Home | null }) {
  const map = useMap();
  const [me, setMe] = useState<[number, number] | null>(null);
  const [busy, setBusy] = useState(false);
  const locate = () => {
    if (!navigator.geolocation) return;
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const ll: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setMe(ll);
        map.setView(ll, 15);
        setBusy(false);
      },
      () => setBusy(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };
  return (
    <>
      <div className="map-ctl">
        {home && (
          <button type="button" className="map-ctl__btn" onClick={() => map.setView([home.lat, home.lng], 15)} aria-label="Center on home">
            <House size={20} aria-hidden="true" />
          </button>
        )}
        <button type="button" className={`map-ctl__btn ${busy ? 'is-busy' : ''}`} onClick={locate} aria-label="Show my location">
          <LocateFixed size={20} aria-hidden="true" />
        </button>
      </div>
      {me && <CircleMarker center={me} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: '#2f80ff', fillOpacity: 1 }} />}
    </>
  );
}

interface Props {
  places: Place[];
  home: Home | null;
  className?: string;
}

export default function MapView({ places, home, className = '' }: Props) {
  const theme = useStore((s) => s.theme);
  const [sel, setSel] = useState<string | null>(null);
  const openPlace = usePlaceOpener();
  const selected = useMemo(() => places.find((p) => p.id === sel) ?? null, [places, sel]);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sel && !places.some((p) => p.id === sel)) setSel(null);
  }, [places, sel]);

  const markers = useMemo(
    () =>
      places.map((p) => (
        <Marker
          key={p.id}
          position={[p.location.lat, p.location.lng]}
          icon={pinIcon(p.category, false)}
          title={`${p.name} — ${CATEGORY_LABEL[p.category]}`}
          eventHandlers={{ click: () => setSel(p.id) }}
        />
      )),
    [places],
  );

  const tiles = theme === 'dark' ? 'Dark' : 'Light';
  const homeLL: [number, number] | null = home ? [home.lat, home.lng] : null;

  return (
    <div className={`mapview ${className}`}>
      <MapContainer center={homeLL ?? SEOUL} zoom={12} maxZoom={19} className="mapview__map" zoomControl={false} attributionControl preferCanvas={false} worldCopyJump={false}>
        {/* Esri Canvas basemap: keyless, calm grey base + separate label layer (CARTO now needs an API key). */}
        <TileLayer
          key={`${tiles}-base`}
          url={`${ESRI}/World_${tiles}_Gray_Base/MapServer/tile/{z}/{y}/{x}`}
          attribution='Tiles &copy; <a href="https://www.esri.com">Esri</a> &mdash; Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxNativeZoom={16}
          maxZoom={19}
        />
        <TileLayer key={`${tiles}-ref`} url={`${ESRI}/World_${tiles}_Gray_Reference/MapServer/tile/{z}/{y}/{x}`} maxNativeZoom={16} maxZoom={19} />
        <MarkerClusterGroup chunkedLoading maxClusterRadius={46} showCoverageOnHover={false} spiderfyOnMaxZoom iconCreateFunction={clusterIcon}>
          {markers}
        </MarkerClusterGroup>
        {selected && <Marker position={[selected.location.lat, selected.location.lng]} icon={pinIcon(selected.category, true)} zIndexOffset={1000} interactive={false} keyboard={false} />}
        {homeLL && <Marker position={homeLL} icon={homeIcon} title={home?.label || trip.home.label} zIndexOffset={900} />}
        <FitBounds places={places} home={home} />
        <Controls home={home} />
      </MapContainer>

      <AnimatePresence>
        {selected && (
          <m.div
            ref={previewRef}
            key={selected.id}
            className="map-preview glass"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: 'spring', damping: 30, stiffness: 360 }}
            role="region"
            aria-label={`Selected: ${selected.name}`}
          >
            <button type="button" className="map-preview__main" onClick={() => openPlace(selected.id)}>
              <Img img={selected.images[0]} category={selected.category} name={selected.name} sizes="120px" className="map-preview__img" />
              <span className="map-preview__body">
                <span className="card__meta">{selected.subcategory || CATEGORY_LABEL[selected.category]} · {selected.location.neighborhood}</span>
                <span className="map-preview__name">{selected.name}</span>
                <span className="card__facts">
                  <RatingChip place={selected} />
                  <span className="card__price">{priceLabel(selected.price.level)}</span>
                  <TimeChip place={selected} />
                </span>
                <ChuseokFlag place={selected} />
              </span>
              <ArrowRight className="map-preview__go" size={22} aria-hidden="true" />
            </button>
            <button type="button" className="icon-btn map-preview__x" onClick={() => setSel(null)} aria-label="Close preview">
              <X size={18} aria-hidden="true" />
            </button>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
