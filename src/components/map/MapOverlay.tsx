'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as maplibregl from 'maplibre-gl';
import { setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { GeoJSONSource, Map as MLMap, Marker as MLMarker } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import { LiquidGlass } from '@/components/glass/LiquidGlass';
import { Icon } from '@/components/icons/Icon';
import { usePreferences } from '@/hooks/use-preferences';
import type { City, GeoQuake, Units } from '@/types/weather';
import { HeatCanvas } from './HeatCanvas';
import { LayerPicker, type MapLayerKey } from './LayerPicker';
import { MapLegend, type LegendInfo } from './MapLegend';
import { PointPopup, QuakePopup } from './PopupContents';
import { TimeScrubber } from './TimeScrubber';
import { useGrid, type ViewBbox } from './use-grid';
import { WindParticles } from './WindParticles';
import {
  BASEMAP_BG,
  GIBS_ATTRIBUTION,
  GIBS_MAX_ZOOM,
  PRECIP_RAMP,
  RADAR_RAMP,
  RAINVIEWER_ATTRIBUTION,
  RAINVIEWER_MAX_ZOOM,
  TEMP_RAMP,
  WIND_RAMP,
  buildBasemapStyle,
  gibsTileUrl,
  rainViewerTileUrl,
} from './map-styles';
import './map.css';

/* maplibre v6 derives its web-worker URL from import.meta.url, which breaks
 * under bundlers (the derived path 404s → "Worker failed to load"). The worker
 * bundle is served from /public and pointed at explicitly instead. */
/* Verified by 18-2: without this override Turbopack's default worker URL
 * fails to load (console: "Worker failed to load") and tile decoding dies —
 * the public worker file IS required. Kept + eslint-ignored (see
 * eslint.config.mjs). File is byte-identical to maplibre-gl/dist/maplibre-gl-worker.mjs. */
setWorkerUrl('/maplibre-gl-worker.mjs?v=6.13.0');

/* ================================================================== */
/* MapOverlay — full-screen Map mode.                                  */
/*                                                                     */
/* Dynamically imported (ssr: false) by AetherApp so maplibre never    */
/* loads unless the map is opened. Owns the MapLibre instance, all     */
/* raster/geojson layers, the canvas overlays and the glass chrome.    */
/* Esc closes; focus is trapped and restored; rAF + fetches are        */
/* cancelled on unmount.                                               */
/* ================================================================== */

export interface MapOverlayProps {
  onClose: () => void;
  city: City | null;
  units: Units;
  surface: 'dark' | 'light';
}

const HOUR_STEPS = 48;

type LayerState = Record<MapLayerKey, boolean>;

type ActivePopup =
  | { kind: 'point'; lng: number; lat: number }
  | { kind: 'quake'; quake: GeoQuake };

interface RainViewerApi {
  host?: string;
  radar?: { past?: Array<{ time: number; path: string }> };
}

function normalizeQuake(p: Record<string, unknown>): GeoQuake {
  return {
    id: String(p.id ?? ''),
    magnitude: Number(p.magnitude ?? 0),
    place: String(p.place ?? ''),
    time: String(p.time ?? new Date().toISOString()),
    latitude: Number(p.latitude ?? 0),
    longitude: Number(p.longitude ?? 0),
    depthKm: Number(p.depthKm ?? 0),
    url: String(p.url ?? ''),
    tsunami: Boolean(p.tsunami),
  };
}

function quakesToCollection(quakes: GeoQuake[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: quakes.map((q) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [q.longitude, q.latitude] },
      properties: { ...q },
    })),
  };
}

export default function MapOverlay({ onClose, city, units, surface }: MapOverlayProps) {
  // Saved cities come straight from the same store the sidebar uses (read-only).
  const savedCities = usePreferences((state) => state.savedCities);

  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const dynamicLayersRef = useRef<Set<string>>(new Set());
  const dynamicSourcesRef = useRef<Set<string>>(new Set());
  const viewBboxRef = useRef<ViewBbox | null>(null);
  const layersRef = useRef<LayerState | null>(null);
  const radarHiddenRef = useRef(false);
  const cityRef = useRef(city);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const markerRef = useRef<MLMarker | null>(null);
  const popupDataRef = useRef<ActivePopup | null>(null);

  const [map, setMap] = useState<MLMap | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [viewBbox, setViewBbox] = useState<ViewBbox | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [basemap, setBasemap] = useState<'dark' | 'light'>(surface === 'light' ? 'light' : 'dark');
  const [basemapTouched, setBasemapTouched] = useState(false);
  const [layers, setLayers] = useState<LayerState>({
    wind: true,
    precip: false,
    temp: false,
    radar: false,
    satellite: false,
    quakes: false,
  });
  const [hour, setHour] = useState(0);
  const [hourPlaying, setHourPlaying] = useState(false);
  const [radarData, setRadarData] = useState<{
    host: string;
    frames: Array<{ time: number; path: string }>;
    fetchedAt: number;
  } | null>(null);
  const [radarError, setRadarError] = useState<string | null>(null);
  const [radarIndex, setRadarIndex] = useState(0);
  const [radarPlaying, setRadarPlaying] = useState(false);
  const [radarHiddenByZoom, setRadarHiddenByZoom] = useState(false);
  const [quakes, setQuakes] = useState<GeoQuake[] | null>(null);
  const [popupData, setPopupData] = useState<ActivePopup | null>(null);
  const [popupContainer, setPopupContainer] = useState<HTMLDivElement | null>(null);

  cityRef.current = city;
  layersRef.current = layers;

  /* ------------------------- focus management ------------------------ */

  useEffect(() => {
    prevFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeBtnRef.current?.focus();
    return () => {
      if (prevFocusRef.current?.isConnected) prevFocusRef.current.focus();
    };
  }, []);

  /* --------------------------- popups -------------------------------- */

  const closePopup = useCallback(() => {
    popupRef.current?.remove();
    popupRef.current = null;
    markerRef.current?.remove();
    markerRef.current = null;
    popupDataRef.current = null;
    setPopupData(null);
    setPopupContainer(null);
  }, []);

  const attachPopup = useCallback(
    (data: ActivePopup, lng: number, lat: number, withMarker: boolean) => {
      const mapInstance = mapRef.current;
      if (!mapInstance) return;
      closePopup();
      const host = document.createElement('div');
      const popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        className: 'aether-popup',
        offset: 18,
        maxWidth: '360px',
      })
        .setLngLat([lng, lat])
        .setDOMContent(host)
        .addTo(mapInstance);
      let marker: MLMarker | null = null;
      if (withMarker) {
        const el = document.createElement('span');
        el.className = 'aether-pin aether-pin--point';
        el.setAttribute('aria-hidden', 'true');
        marker = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(mapInstance);
      }
      popupRef.current = popup;
      markerRef.current = marker;
      popupDataRef.current = data;
      setPopupData(data);
      setPopupContainer(host);
    },
    [closePopup],
  );

  const openPointPopup = useCallback(
    (lng: number, lat: number) => {
      attachPopup({ kind: 'point', lng, lat }, lng, lat, true);
    },
    [attachPopup],
  );

  const openQuakePopup = useCallback(
    (quake: GeoQuake) => {
      attachPopup({ kind: 'quake', quake }, quake.longitude, quake.latitude, false);
    },
    [attachPopup],
  );

  /* --------------------------- map init ------------------------------ */

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const initial = cityRef.current;
    // Defense-in-depth: a malformed City (legacy/hand-edited localStorage)
    // must never reach MapLibre — `new LngLat(NaN, NaN)` throws and takes the
    // whole app down. Fall back to the neutral world view instead.
    const initialLng = Number.isFinite(initial?.longitude) ? initial!.longitude : 15;
    const initialLat = Number.isFinite(initial?.latitude) ? initial!.latitude : 25;
    const hasInitial = Number.isFinite(initial?.longitude) && Number.isFinite(initial?.latitude);
    const instance = new maplibregl.Map({
      container,
      style: buildBasemapStyle(),
      center: [initialLng, initialLat],
      zoom: hasInitial ? 5.2 : 1.9,
      minZoom: 1,
      maxZoom: 17,
      dragRotate: false,
      touchPitch: false,
      attributionControl: { compact: true },
    });
    mapRef.current = instance;
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
    // Radar/satellite tiles 404 at the edges — expected, stay quiet.
    instance.on('error', () => {});

    const round1 = (v: number) => Math.round(v * 10) / 10;
    const syncBbox = () => {
      const b = instance.getBounds();
      const next: ViewBbox = {
        minLat: round1(b.getSouth()),
        minLon: round1(b.getWest()),
        maxLat: round1(b.getNorth()),
        maxLon: round1(b.getEast()),
      };
      const prev = viewBboxRef.current;
      if (
        !prev ||
        prev.minLat !== next.minLat ||
        prev.minLon !== next.minLon ||
        prev.maxLat !== next.maxLat ||
        prev.maxLon !== next.maxLon
      ) {
        viewBboxRef.current = next;
        setViewBbox(next);
      }
    };

    let bboxDebounce = 0;
    const onMoveEnd = () => {
      window.clearTimeout(bboxDebounce);
      bboxDebounce = window.setTimeout(syncBbox, 350);
    };
    const onLoad = () => {
      setMapReady(true);
      setMap(instance);
      syncBbox();
    };
    instance.on('load', onLoad);
    instance.on('moveend', onMoveEnd);

    // RainViewer free tier: radar hides above zoom 7.
    const onZoom = () => {
      const hide = instance.getZoom() > RAINVIEWER_MAX_ZOOM + 0.2;
      if (hide !== radarHiddenRef.current) {
        radarHiddenRef.current = hide;
        setRadarHiddenByZoom(hide);
      }
    };
    instance.on('zoom', onZoom);

    const onClick = (e: maplibregl.MapMouseEvent) => {
      if (layersRef.current?.quakes && instance.getLayer('quakes-circles')) {
        const hits = instance.queryRenderedFeatures(e.point, { layers: ['quakes-circles'] });
        if (hits.length > 0 && hits[0].properties) {
          openQuakePopup(normalizeQuake(hits[0].properties as Record<string, unknown>));
          return;
        }
      }
      openPointPopup(e.lngLat.lng, e.lngLat.lat);
    };
    instance.on('click', onClick);

    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      if (!layersRef.current?.quakes || !instance.getLayer('quakes-circles')) return;
      const hits = instance.queryRenderedFeatures(e.point, { layers: ['quakes-circles'] });
      instance.getCanvas().style.cursor = hits.length > 0 ? 'pointer' : '';
    };
    instance.on('mousemove', onMouseMove);

    return () => {
      window.clearTimeout(bboxDebounce);
      popupRef.current?.remove();
      markerRef.current?.remove();
      popupRef.current = null;
      markerRef.current = null;
      // Explicit removal of every dynamic layer/source, then the map itself.
      for (const id of dynamicLayersRef.current) {
        if (instance.getLayer(id)) instance.removeLayer(id);
      }
      for (const id of dynamicSourcesRef.current) {
        if (instance.getSource(id)) instance.removeSource(id);
      }
      dynamicLayersRef.current.clear();
      dynamicSourcesRef.current.clear();
      instance.remove();
      mapRef.current = null;
    };
  }, []);

  /* ---------------------- basemap + theme ---------------------------- */

  useEffect(() => {
    if (basemapTouched) return;
    setBasemap(surface === 'light' ? 'light' : 'dark');
  }, [surface, basemapTouched]);

  useEffect(() => {
    const instance = mapRef.current;
    if (!instance || !mapReady) return;
    const showDark = basemap === 'dark';
    instance.setLayoutProperty('basemap-dark', 'visibility', showDark ? 'visible' : 'none');
    instance.setLayoutProperty('basemap-dark-labels', 'visibility', showDark ? 'visible' : 'none');
    instance.setLayoutProperty('basemap-light', 'visibility', showDark ? 'none' : 'visible');
    instance.setLayoutProperty('basemap-light-labels', 'visibility', showDark ? 'none' : 'visible');
    instance.setPaintProperty('bg', 'background-color', BASEMAP_BG[basemap]);
  }, [mapReady, basemap]);

  /* ------------------------- grid metrics ---------------------------- */

  const windGrid = useGrid('wind', viewBbox, hour, layers.wind);
  const precipGrid = useGrid('precip', viewBbox, hour, layers.precip);
  const tempGrid = useGrid('temp', viewBbox, hour, layers.temp);

  /* ------------------------ RainViewer radar ------------------------- */

  useEffect(() => {
    if (!layers.radar) return;
    if (radarData && Date.now() - radarData.fetchedAt < 10 * 60 * 1000) return;
    const controller = new AbortController();
    fetch('https://api.rainviewer.com/public/weather-maps.json', {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`RainViewer failed (${res.status})`);
        return (await res.json()) as RainViewerApi;
      })
      .then((json) => {
        const frames = (json.radar?.past ?? []).slice(-12);
        setRadarData({
          host: json.host ?? 'https://tilecache.rainviewer.com',
          frames,
          fetchedAt: Date.now(),
        });
        setRadarError(null);
        setRadarIndex(frames.length - 1);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setRadarError(error instanceof Error ? error.message : 'Radar unavailable');
      });
    return () => controller.abort();
  }, [layers.radar, radarData]);

  const radarTotal = radarData?.frames.length ?? 0;

  useEffect(() => {
    const instance = mapRef.current;
    if (!instance || !mapReady) return;
    const frames = radarData?.frames ?? [];
    const active = layers.radar && frames.length > 0;
    if (active) {
      const idx = Math.min(Math.max(0, radarIndex), frames.length - 1);
      const frame = frames[idx];
      const id = `rv-${frame.time}`;
      if (!instance.getSource(id)) {
        instance.addSource(id, {
          type: 'raster',
          tiles: [rainViewerTileUrl(radarData!.host, frame.path)],
          tileSize: 256,
          maxzoom: RAINVIEWER_MAX_ZOOM,
          attribution: RAINVIEWER_ATTRIBUTION,
        });
        dynamicSourcesRef.current.add(id);
        const beforeId = instance.getLayer('quakes-circles') ? 'quakes-circles' : 'overlay-anchor';
        instance.addLayer(
          {
            id,
            type: 'raster',
            source: id,
            paint: { 'raster-opacity': 0.8, 'raster-fade-duration': 200 },
          },
          beforeId,
        );
        dynamicLayersRef.current.add(id);
      }
      for (const frameItem of frames) {
        const fid = `rv-${frameItem.time}`;
        if (!instance.getLayer(fid)) continue;
        instance.setLayoutProperty(
          fid,
          'visibility',
          frameItem === frame && !radarHiddenByZoom ? 'visible' : 'none',
        );
      }
    } else {
      for (const frameItem of frames) {
        const fid = `rv-${frameItem.time}`;
        if (instance.getLayer(fid)) instance.setLayoutProperty(fid, 'visibility', 'none');
      }
    }
  }, [mapReady, layers.radar, radarData, radarIndex, radarHiddenByZoom]);

  /* -------------------------- GIBS satellite ------------------------- */

  useEffect(() => {
    const instance = mapRef.current;
    if (!instance || !mapReady) return;
    if (layers.satellite && !instance.getSource('gibs-satellite')) {
      instance.addSource('gibs-satellite', {
        type: 'raster',
        tiles: [gibsTileUrl()],
        tileSize: 256,
        maxzoom: GIBS_MAX_ZOOM,
        attribution: GIBS_ATTRIBUTION,
      });
      dynamicSourcesRef.current.add('gibs-satellite');
      const radarLayer = radarData?.frames
        .map((f) => `rv-${f.time}`)
        .find((id) => instance.getLayer(id));
      const beforeId =
        radarLayer ?? (instance.getLayer('quakes-circles') ? 'quakes-circles' : 'overlay-anchor');
      instance.addLayer(
        {
          id: 'gibs-layer',
          type: 'raster',
          source: 'gibs-satellite',
          paint: { 'raster-opacity': 0.85 },
        },
        beforeId,
      );
      dynamicLayersRef.current.add('gibs-layer');
    }
    if (instance.getLayer('gibs-layer')) {
      instance.setLayoutProperty('gibs-layer', 'visibility', layers.satellite ? 'visible' : 'none');
    }
  }, [mapReady, layers.satellite, radarData]);

  /* --------------------------- earthquakes --------------------------- */

  useEffect(() => {
    if (!layers.quakes || quakes) return;
    const controller = new AbortController();
    fetch('/api/earthquakes', { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Earthquake feed failed (${res.status})`);
        return (await res.json()) as { quakes: GeoQuake[] };
      })
      .then((data) => {
        if (!controller.signal.aborted) setQuakes(data.quakes ?? []);
      })
      .catch(() => {
        /* silent — the layer simply stays empty */
      });
    return () => controller.abort();
  }, [layers.quakes, quakes]);

  const quakesCollection = useMemo(
    () => (quakes ? quakesToCollection(quakes) : null),
    [quakes],
  );

  useEffect(() => {
    const instance = mapRef.current;
    if (!instance || !mapReady) return;
    if (quakesCollection && !instance.getSource('quakes')) {
      instance.addSource('quakes', { type: 'geojson', data: quakesCollection });
      dynamicSourcesRef.current.add('quakes');
      instance.addLayer(
        {
          id: 'quakes-circles',
          type: 'circle',
          source: 'quakes',
          paint: {
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['get', 'magnitude'],
              2.5,
              4,
              4,
              6,
              5,
              8.5,
              7,
              12,
            ],
            'circle-color': [
              'case',
              ['>=', ['get', 'magnitude'], 5],
              '#E1552F',
              ['>=', ['get', 'magnitude'], 4],
              '#E8C54D',
              '#45d1b3',
            ],
            'circle-opacity': 0.88,
            'circle-stroke-width': 1.2,
            'circle-stroke-color': 'rgba(255, 255, 255, 0.75)',
          },
        },
        'overlay-anchor',
      );
      dynamicLayersRef.current.add('quakes-circles');
    } else if (quakesCollection) {
      (instance.getSource('quakes') as GeoJSONSource | undefined)?.setData(quakesCollection);
    }
    if (instance.getLayer('quakes-circles')) {
      instance.setLayoutProperty('quakes-circles', 'visibility', layers.quakes ? 'visible' : 'none');
    }
  }, [mapReady, quakesCollection, layers.quakes]);

  /* --------------------------- city pins ----------------------------- */

  useEffect(() => {
    const instance = mapRef.current;
    if (!instance || !mapReady) return;
    const markers: MLMarker[] = [];
    const pins: Array<{ city: City; active: boolean }> = [
      ...savedCities.filter((c) => c.id !== city?.id).map((c) => ({ city: c, active: false })),
    ];
    if (city) pins.push({ city, active: true });
    for (const pin of pins) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `aether-pin focus-ring ${pin.active ? 'aether-pin--active' : ''}`;
      el.title = pin.city.name;
      el.setAttribute(
        'aria-label',
        pin.active ? `${pin.city.name} — current city` : pin.city.name,
      );
      el.addEventListener('click', () => {
        if (!Number.isFinite(pin.city.longitude) || !Number.isFinite(pin.city.latitude)) return;
        instance.flyTo({
          center: [pin.city.longitude, pin.city.latitude],
          zoom: Math.max(instance.getZoom(), 7),
          duration: 900,
        });
      });
      const pinLng = Number.isFinite(pin.city.longitude) ? pin.city.longitude : 15;
      const pinLat = Number.isFinite(pin.city.latitude) ? pin.city.latitude : 25;
      markers.push(
        new maplibregl.Marker({ element: el })
          .setLngLat([pinLng, pinLat])
          .addTo(instance),
      );
    }
    return () => {
      for (const m of markers) m.remove();
    };
  }, [mapReady, savedCities, city]);

  /* ---------------------------- playback ----------------------------- */

  useEffect(() => {
    if (!radarPlaying || !layers.radar || radarTotal < 2) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      setRadarIndex((i) => (i + 1) % radarTotal);
    }, 500);
    return () => window.clearInterval(id);
  }, [radarPlaying, layers.radar, radarTotal]);

  useEffect(() => {
    if (!hourPlaying || (!layers.precip && !layers.temp)) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      setHour((h) => (h + 1) % HOUR_STEPS);
    }, 800);
    return () => window.clearInterval(id);
  }, [hourPlaying, layers.precip, layers.temp]);

  /* ------------------------ keyboard + focus ------------------------- */

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (popupDataRef.current) closePopup();
        else onClose();
        return;
      }
      if (event.key === 'Tab') {
        const root = rootRef.current;
        if (!root) return;
        const focusables = Array.from(
          root.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => (el as HTMLButtonElement).disabled !== true && el.offsetParent !== null);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (event.shiftKey && (active === first || !root.contains(active))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (active === last || !root.contains(active))) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [closePopup, onClose]);

  /* ----------------------------- chrome ------------------------------ */

  const toggleLayer = useCallback((key: MapLayerKey) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleBasemap = useCallback((kind: 'dark' | 'light') => {
    setBasemapTouched(true);
    setBasemap(kind);
  }, []);

  const radarTimeLabel = useMemo(() => {
    if (radarTotal === 0) return radarError ? 'Radar unavailable' : null;
    const frame = radarData!.frames[Math.min(radarIndex, radarTotal - 1)];
    const time = new Date(frame.time * 1000).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    const minutesAgo = Math.max(0, Math.round((Date.now() / 1000 - frame.time) / 60));
    return minutesAgo < 1 ? `${time} · now` : `${time} · ${minutesAgo}m ago`;
  }, [radarData, radarIndex, radarTotal, radarError]);

  const legend: LegendInfo | null = useMemo(() => {
    const note = hour === 0 ? 'Now' : `+${hour}h`;
    if (layers.radar) {
      return {
        label: 'Radar',
        ramp: RADAR_RAMP,
        ticks: ['light', 'heavy'],
        note: radarError ? 'Unavailable' : 'Past 2h · RainViewer',
      };
    }
    if (layers.precip) {
      return {
        label: 'Precipitation',
        ramp: PRECIP_RAMP,
        ticks: ['0', '4', '8+ mm/h'],
        note,
      };
    }
    if (layers.temp) {
      return {
        label: 'Temperature',
        ramp: TEMP_RAMP,
        ticks: units === 'metric' ? ['-15°', '10°', '35°'] : ['5°', '50°', '95°'],
        note,
      };
    }
    if (layers.wind) {
      return {
        label: 'Wind',
        ramp: WIND_RAMP,
        ticks: units === 'metric' ? ['0', '30', '60+ km/h'] : ['0', '20', '40+ mph'],
        note: windGrid.error ? 'Unavailable' : note,
      };
    }
    return null;
  }, [layers, hour, units, radarError, windGrid.error]);

  const gridLoading = (layers.wind && windGrid.loading) || (layers.precip && precipGrid.loading) || (layers.temp && tempGrid.loading);

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Map mode — live weather layers"
      className="fixed inset-0 z-[80] flex flex-col"
    >
      {/* Top chrome — Clear LiquidGlass over the map (dimming scrim built in) */}
      <LiquidGlass
        variant="clear"
        className="relative z-30 flex items-center gap-2 px-3 py-2"
      >
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-aurora-300"
        >
          <Icon name="map" size={18} animated />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight text-surface">Aether Map</p>
          <p className="truncate text-[11px] leading-tight text-surface-muted">
            {city
              ? `${city.name}${city.country ? ` · ${city.country}` : ''}`
              : 'Live weather layers around the world'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPickerOpen((open) => !open)}
          aria-label={pickerOpen ? 'Close layers panel' : 'Open layers panel'}
          aria-pressed={pickerOpen}
          className={`focus-ring flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition-all duration-200 ${
            pickerOpen
              ? 'border-aurora-500/50 bg-aurora-500/15 text-aurora-400'
              : 'text-surface-muted hover:text-surface'
          }`}
        >
          <Icon name="layers" size={17} />
        </button>
        <button
          ref={closeBtnRef}
          type="button"
          onClick={onClose}
          aria-label="Close map (Escape)"
          title="Close (Esc)"
          className="focus-ring flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/85 transition-colors duration-200 hover:text-white"
        >
          <Icon name="x" size={17} />
        </button>
      </LiquidGlass>

      {/* Map viewport */}
      <div className="aether-map relative min-h-0 flex-1">
        <div ref={containerRef} className="absolute inset-0" aria-label="Interactive weather map" />

        {map && layers.precip && <HeatCanvas map={map} grid={precipGrid.data} metric="precip" />}
        {map && layers.temp && <HeatCanvas map={map} grid={tempGrid.data} metric="temp" />}
        {map && layers.wind && <WindParticles map={map} grid={windGrid.data} />}

        <MapLegend legend={legend} loading={gridLoading} />

        <TimeScrubber
          showRadar={layers.radar}
          radarIndex={radarIndex}
          radarTotal={radarTotal}
          radarTimeLabel={radarTimeLabel}
          radarHiddenByZoom={radarHiddenByZoom}
          radarPlaying={radarPlaying}
          onRadarIndex={setRadarIndex}
          onRadarPlaying={setRadarPlaying}
          showHour={layers.precip || layers.temp}
          hour={hour}
          hourPlaying={hourPlaying}
          onHour={setHour}
          onHourPlaying={setHourPlaying}
        />

        <LayerPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          layers={layers}
          onToggleLayer={toggleLayer}
          basemap={basemap}
          onBasemap={handleBasemap}
        />

        {popupContainer &&
          popupData &&
          createPortal(
            popupData.kind === 'point' ? (
              <PointPopup
                key={`${popupData.lng},${popupData.lat}`}
                lng={popupData.lng}
                lat={popupData.lat}
                units={units}
                onClose={closePopup}
              />
            ) : (
              <QuakePopup key={popupData.quake.id} quake={popupData.quake} onClose={closePopup} />
            ),
            popupContainer,
          )}
      </div>
    </div>
  );
}
