import { useEffect, useRef, useState } from 'react';
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

/** The raster source `baseStyle` declares; tile failures are reported against it. */
const BASE_IMAGERY_SOURCE = 'osm';
/** One slow tile is not an outage. Several failures with none arriving is. */
const BASE_IMAGERY_FAILURE_THRESHOLD = 3;

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
  const [baseImageryUnavailable, setBaseImageryUnavailable] = useState(false);

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

    /**
     * Tile failures do not stop the map from "loading".
     *
     * The style is inline, so `load` fires whether or not a single tile arrived.
     * Offline - which is where a walk usually is - every tile request fails and the
     * result was a large empty rectangle on the Active Journey screen and on a saved
     * Journey, with nothing saying why. That reads as a broken screen.
     *
     * The route line is still drawn on the background colour, so the map is not
     * replaced: only a note is added, and only once it is clear that no imagery is
     * arriving rather than after a single slow tile.
     */
    let tileFailures = 0;
    // MapLibre types these events as a bare `Event`, so the two fields this needs are
    // read through a narrow local shape rather than an `any`.
    const sourceOf = (event: unknown): { sourceId?: string; tile?: unknown } =>
      (event ?? {}) as { sourceId?: string; tile?: unknown };

    const onTileData = (event: unknown) => {
      const detail = sourceOf(event);
      if (detail.sourceId === BASE_IMAGERY_SOURCE && detail.tile) {
        setBaseImageryUnavailable(false);
        tileFailures = 0;
      }
    };
    const onMapError = (event: unknown) => {
      if (sourceOf(event).sourceId !== BASE_IMAGERY_SOURCE) return;
      tileFailures += 1;
      if (tileFailures >= BASE_IMAGERY_FAILURE_THRESHOLD) setBaseImageryUnavailable(true);
    };

    map.on('data', onTileData);
    map.on('error', onMapError);

    return () => {
      map.off('data', onTileData);
      map.off('error', onMapError);
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
    <>
      {baseImageryUnavailable ? (
        <p className="active-journey__map-imagery-note" role="status">
          <strong>Map images could not load.</strong> <span>{unavailableMessage}</span>
        </p>
      ) : null}
      <div
        ref={containerRef}
        className="active-journey__map"
        data-base-imagery={baseImageryUnavailable ? 'unavailable' : 'available'}
        role="img"
        aria-label={ariaLabel}
      />
    </>
  );
}
