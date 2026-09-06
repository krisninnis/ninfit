import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Map as MapLibreMap,
  type GeoJSONSource,
  type StyleSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { JourneyGpsPoint } from '../../domain/journey';
import { journeyPointGeoJson, journeySegmentsGeoJson } from '../journeyMapGeometry';
import { journeyMapPaintColours } from '../mapLibreColour';

interface JourneyRouteMapProps {
  segments: JourneyGpsPoint[][];
  latestPoint?: JourneyGpsPoint | null;
  ariaLabel: string;
  unavailableMessage: string;
  view?: 'follow' | 'overview';
}

const ROUTE_SOURCE = 'ninfit-journey-route';
const POSITION_SOURCE = 'ninfit-journey-position';
const ROUTE_CASING_LAYER = 'ninfit-journey-route-casing';
const ROUTE_LAYER = 'ninfit-journey-route-line';
const POSITION_LAYER = 'ninfit-journey-position-dot';

/**
 * OpenFreeMap's Liberty style gives NinFit a proper vector street map with labels and
 * local context without shipping an API key. A production operator can swap the style
 * through VITE_MAP_STYLE_URL without changing code. The older raster-tile override is
 * retained for private/self-hosted deployments that already set VITE_MAP_TILE_URL.
 */
const DEFAULT_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const FALLBACK_WIDTH = 1000;
const FALLBACK_HEIGHT = 640;
const FALLBACK_PADDING = 54;
const MAP_READY_TIMEOUT_MS = 4500;

function configuredStyleUrl(): string | undefined {
  const configured = import.meta.env.VITE_MAP_STYLE_URL?.trim();
  return configured || undefined;
}

function configuredRasterTileUrl(): string | undefined {
  const configured = import.meta.env.VITE_MAP_TILE_URL?.trim();
  return configured || undefined;
}

function rasterStyle(tileUrl: string): StyleSpecification {
  return {
    version: 8,
    sources: {
      ninfitRaster: {
        type: 'raster',
        tiles: [tileUrl],
        tileSize: 256,
        maxzoom: 19,
        attribution:
          '<a href="https://www.openstreetmap.org/copyright">&copy; OpenStreetMap contributors</a>',
      },
    },
    layers: [
      {
        id: 'ninfit-map-background',
        type: 'background',
        paint: { 'background-color': '#e7ece7' },
      },
      {
        id: 'ninfit-map-base',
        type: 'raster',
        source: 'ninfitRaster',
      },
    ],
  };
}

function mapStyle(): StyleSpecification | string {
  const raster = configuredRasterTileUrl();
  if (raster !== undefined) return rasterStyle(raster);
  return configuredStyleUrl() ?? DEFAULT_STYLE_URL;
}

function addJourneyLayers(map: MapLibreMap, element: HTMLElement): void {
  const colours = journeyMapPaintColours((token) =>
    getComputedStyle(element).getPropertyValue(token).trim());

  map.addSource(ROUTE_SOURCE, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });
  map.addSource(POSITION_SOURCE, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });

  map.addLayer({
    id: ROUTE_CASING_LAYER,
    type: 'line',
    source: ROUTE_SOURCE,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': colours.routeCasing,
      'line-width': 8,
      'line-opacity': 0.92,
    },
  });

  map.addLayer({
    id: ROUTE_LAYER,
    type: 'line',
    source: ROUTE_SOURCE,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': colours.routeLine,
      'line-width': 5,
      'line-opacity': 0.98,
    },
  });

  map.addLayer({
    id: POSITION_LAYER,
    type: 'circle',
    source: POSITION_SOURCE,
    paint: {
      'circle-radius': 7,
      'circle-color': colours.positionFill,
      'circle-stroke-width': 3,
      'circle-stroke-color': colours.positionStroke,
    },
  });
}

function updateMapData(
  map: MapLibreMap,
  segments: JourneyGpsPoint[][],
  latestPoint: JourneyGpsPoint | null | undefined,
): void {
  const route = map.getSource(ROUTE_SOURCE) as GeoJSONSource | undefined;
  const position = map.getSource(POSITION_SOURCE) as GeoJSONSource | undefined;
  route?.setData(journeySegmentsGeoJson(segments));
  position?.setData(journeyPointGeoJson(latestPoint));
}

function fitOverview(map: MapLibreMap, segments: JourneyGpsPoint[][]): void {
  const coordinates = journeySegmentsGeoJson(segments).features.flatMap(
    (feature) => feature.geometry.coordinates,
  );
  if (coordinates.length === 0) return;

  let minLon = coordinates[0]?.[0] ?? 0;
  let maxLon = minLon;
  let minLat = coordinates[0]?.[1] ?? 0;
  let maxLat = minLat;

  for (const coordinate of coordinates) {
    const lon = coordinate[0];
    const lat = coordinate[1];
    if (lon === undefined || lat === undefined) continue;
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  map.fitBounds(
    [[minLon, minLat], [maxLon, maxLat]],
    { padding: 32, maxZoom: 16, duration: 0 },
  );
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface ProjectedRoute {
  paths: string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
}

/**
 * Dependency-free projection used when the real map cannot prove it rendered.
 *
 * The fallback is intentionally simple and local: it never asks a server for the
 * route and it never invents a bridge between trusted route segments. It exists so a
 * browser/WebGL/tile failure can degrade to "route line without basemap" rather than
 * the blank rectangle found in the first real Samsung walk.
 */
function projectedRoute(segments: JourneyGpsPoint[][]): ProjectedRoute {
  const drawable = segments.filter((segment) => segment.length >= 2);
  const points = drawable.flat();
  if (points.length === 0) return { paths: [] };

  let minLon = points[0]?.longitude ?? 0;
  let maxLon = minLon;
  let minLat = points[0]?.latitude ?? 0;
  let maxLat = minLat;

  for (const point of points) {
    minLon = Math.min(minLon, point.longitude);
    maxLon = Math.max(maxLon, point.longitude);
    minLat = Math.min(minLat, point.latitude);
    maxLat = Math.max(maxLat, point.latitude);
  }

  const lonSpan = Math.max(maxLon - minLon, 0.000001);
  const latSpan = Math.max(maxLat - minLat, 0.000001);
  const width = FALLBACK_WIDTH - FALLBACK_PADDING * 2;
  const height = FALLBACK_HEIGHT - FALLBACK_PADDING * 2;
  const project = (point: JourneyGpsPoint) => ({
    x: FALLBACK_PADDING + ((point.longitude - minLon) / lonSpan) * width,
    y: FALLBACK_PADDING + ((maxLat - point.latitude) / latSpan) * height,
  });

  const paths = drawable.map((segment) => segment
    .map((point, index) => {
      const projected = project(point);
      return `${index === 0 ? 'M' : 'L'} ${projected.x.toFixed(2)} ${projected.y.toFixed(2)}`;
    })
    .join(' '));

  return {
    paths,
    start: project(points[0]!),
    end: project(points[points.length - 1]!),
  };
}

function RouteFallback({ route }: { route: ProjectedRoute }) {
  if (route.paths.length === 0) return null;
  return (
    <svg
      className="active-journey__route-fallback"
      viewBox={`0 0 ${FALLBACK_WIDTH} ${FALLBACK_HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 2,
        pointerEvents: 'none',
      }}
    >
      {route.paths.map((path, index) => (
        <g key={`${index}-${path.length}`}>
          <path
            d={path}
            fill="none"
            stroke="var(--ft-surface-raised, #fff)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={path}
            fill="none"
            stroke="var(--ft-accent, #4f8065)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      ))}
      {route.start ? (
        <circle
          cx={route.start.x}
          cy={route.start.y}
          r="11"
          fill="var(--ft-surface-raised, #fff)"
          stroke="var(--ft-accent, #4f8065)"
          strokeWidth="5"
        />
      ) : null}
      {route.end ? (
        <circle
          cx={route.end.x}
          cy={route.end.y}
          r="11"
          fill="var(--ft-accent, #4f8065)"
          stroke="var(--ft-surface-raised, #fff)"
          strokeWidth="5"
        />
      ) : null}
    </svg>
  );
}

export function JourneyRouteMap({
  segments,
  latestPoint = null,
  ariaLabel,
  unavailableMessage,
  view = 'overview',
}: JourneyRouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const loadedRef = useRef(false);
  const readyRef = useRef(false);
  const segmentsRef = useRef(segments);
  const latestPointRef = useRef(latestPoint);
  const lastCenteredAtRef = useRef<string | null>(null);
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const [fallbackVisible, setFallbackVisible] = useState(false);
  const fallback = useMemo(() => projectedRoute(segments), [segments]);

  segmentsRef.current = segments;
  latestPointRef.current = latestPoint;

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return undefined;

    let map: MapLibreMap;
    try {
      const startPoint = latestPointRef.current;
      map = new MapLibreMap({
        container,
        style: mapStyle(),
        center: startPoint === null || startPoint === undefined
          ? [0, 20]
          : [startPoint.longitude, startPoint.latitude],
        zoom: startPoint === null || startPoint === undefined ? 1.5 : 15,
        interactive: false,
        attributionControl: {},
      });
    } catch {
      setMapUnavailable(true);
      setFallbackVisible(true);
      return undefined;
    }

    mapRef.current = map;

    const onLoad = () => {
      try {
        addJourneyLayers(map, container);
        loadedRef.current = true;
        updateMapData(map, segmentsRef.current, latestPointRef.current);

        if (view === 'overview') {
          fitOverview(map, segmentsRef.current);
        } else {
          const current = latestPointRef.current;
          if (current !== null && current !== undefined) {
            lastCenteredAtRef.current = current.recordedAt;
          }
        }
      } catch {
        setFallbackVisible(true);
      }
    };

    const onIdle = () => {
      readyRef.current = true;
      setFallbackVisible(false);
    };

    const onError = () => setFallbackVisible(true);
    const onContextLost = (event: Event) => {
      event.preventDefault();
      readyRef.current = false;
      setFallbackVisible(true);
    };

    const canvas = map.getCanvas();
    canvas.addEventListener('webglcontextlost', onContextLost);
    map.on('load', onLoad);
    map.on('idle', onIdle);
    map.on('error', onError);

    const readinessTimer = window.setTimeout(() => {
      if (!readyRef.current) setFallbackVisible(true);
    }, MAP_READY_TIMEOUT_MS);

    return () => {
      window.clearTimeout(readinessTimer);
      loadedRef.current = false;
      readyRef.current = false;
      canvas.removeEventListener('webglcontextlost', onContextLost);
      map.off('load', onLoad);
      map.off('idle', onIdle);
      map.off('error', onError);
      map.remove();
      if (mapRef.current === map) mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !loadedRef.current) return;

    updateMapData(map, segments, latestPoint);

    if (view === 'overview') {
      fitOverview(map, segments);
      return;
    }

    if (
      latestPoint === null
      || latestPoint === undefined
      || latestPoint.recordedAt === lastCenteredAtRef.current
    ) return;

    lastCenteredAtRef.current = latestPoint.recordedAt;
    const camera = {
      center: [latestPoint.longitude, latestPoint.latitude] as [number, number],
      zoom: Math.max(map.getZoom(), 15),
    };

    if (prefersReducedMotion()) {
      map.jumpTo(camera);
    } else {
      map.easeTo({ ...camera, duration: 450, essential: false });
    }
  }, [segments, latestPoint, view]);

  if (mapUnavailable) {
    return (
      <div
        className="active-journey__map"
        role="img"
        aria-label={ariaLabel}
        style={{ position: 'relative', overflow: 'hidden' }}
      >
        <RouteFallback route={fallback} />
        <div className="active-journey__map-unavailable" role="status" aria-live="polite">
          <strong>Map imagery unavailable</strong>
          <span>{fallback.paths.length > 0 ? 'Your recorded route is still shown.' : unavailableMessage}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="active-journey__map"
      role="img"
      aria-label={ariaLabel}
      style={{ position: 'relative', overflow: 'hidden' }}
    >
      <div ref={containerRef} aria-hidden="true" style={{ position: 'absolute', inset: 0 }} />
      {fallbackVisible ? <RouteFallback route={fallback} /> : null}
      {fallbackVisible ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'absolute',
            left: 12,
            right: 12,
            bottom: 12,
            zIndex: 4,
            padding: '8px 10px',
            borderRadius: 10,
            background: 'var(--ft-surface-raised)',
            color: 'var(--ft-text-primary)',
            fontSize: 12,
          }}
        >
          Map detail is unavailable — your recorded route is still shown.
        </div>
      ) : null}
    </div>
  );
}
