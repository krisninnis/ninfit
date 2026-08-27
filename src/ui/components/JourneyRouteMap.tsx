import { useEffect, useRef, useState } from 'react';
import {
  Map as MapLibreMap,
  type GeoJSONSource,
  type StyleSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { JourneyGpsPoint } from '../../domain/journey';
import { journeyPointGeoJson, journeySegmentsGeoJson } from '../journeyMapGeometry';

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

const DEFAULT_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

function tileUrl(): string {
  const configured = import.meta.env.VITE_MAP_TILE_URL?.trim();
  return configured || DEFAULT_TILE_URL;
}

function baseStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: [tileUrl()],
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
        source: 'osm',
      },
    ],
  };
}

function cssToken(element: HTMLElement, token: string, fallback: string): string {
  const value = getComputedStyle(element).getPropertyValue(token).trim();
  return value || fallback;
}

function addJourneyLayers(map: MapLibreMap, element: HTMLElement): void {
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
      'line-color': cssToken(element, '--ft-surface-raised', '#ffffff'),
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
      'line-color': cssToken(element, '--ft-accent', '#4f8065'),
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
      'circle-color': cssToken(element, '--ft-accent', '#4f8065'),
      'circle-stroke-width': 3,
      'circle-stroke-color': cssToken(element, '--ft-surface-raised', '#ffffff'),
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
  const segmentsRef = useRef(segments);
  const latestPointRef = useRef(latestPoint);
  const lastCenteredAtRef = useRef<string | null>(null);
  const [mapUnavailable, setMapUnavailable] = useState(false);

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
        style: baseStyle(),
        center: startPoint === null || startPoint === undefined
          ? [0, 20]
          : [startPoint.longitude, startPoint.latitude],
        zoom: startPoint === null || startPoint === undefined ? 1.5 : 15,
        interactive: false,
        attributionControl: {},
      });
    } catch {
      setMapUnavailable(true);
      return undefined;
    }

    mapRef.current = map;

    const onLoad = () => {
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
    };

    map.on('load', onLoad);

    return () => {
      loadedRef.current = false;
      map.off('load', onLoad);
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
      <div className="active-journey__map-unavailable" role="status" aria-live="polite">
        <strong>Map unavailable</strong>
        <span>{unavailableMessage}</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="active-journey__map"
      role="img"
      aria-label={ariaLabel}
    />
  );
}
