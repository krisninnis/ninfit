# NinFit Journey mapping stack v1

## Decision

Use **MapLibre GL JS + OpenFreeMap vector styles on web**, with NinFit's trusted GPS route kept as local GeoJSON and a dependency-free route fallback when the map cannot prove it rendered. Keep the renderer/provider boundary configurable so the native app can move to **MapLibre Native** without changing Journey's route truth model.

The default web style is:

`https://tiles.openfreemap.org/styles/liberty`

A deployment can replace it with `VITE_MAP_STYLE_URL`. Existing private/self-hosted raster deployments can continue to use `VITE_MAP_TILE_URL`.

## Five options reviewed

### 1. MapLibre GL JS + OpenFreeMap

Strengths:
- open-source TypeScript renderer already in NinFit;
- vector street map with labels and local context;
- no API key required for OpenFreeMap public styles;
- route stays a local GeoJSON overlay rather than being submitted to a directions service;
- clean path to MapLibre Native later;
- style/provider can be replaced without changing Journey records.

Trade-offs:
- browser rendering still depends on WebGL;
- public OpenFreeMap has no SLA, so NinFit must degrade safely.

### 2. Leaflet + raster/vector provider

Strengths:
- mature and reliable on low-end/mobile browsers;
- SVG/Canvas polylines avoid a hard WebGL dependency;
- simple mental model for route playback.

Trade-offs:
- vector basemaps need extra plugins or a separate SDK;
- a new dependency and second rendering architecture would diverge from the planned native stack;
- lower ceiling for the richer Journey world NinFit wants later.

### 3. Mapbox GL JS / Mapbox mobile SDK

Strengths:
- polished vector maps, search, navigation, POIs and commercial support;
- strong web/mobile tooling.

Trade-offs:
- account/token and usage billing;
- tighter provider coupling than NinFit needs for a private local-first route viewer;
- route display does not require Mapbox Directions, so much of the paid stack would be unused today.

### 4. Google Maps Platform

Strengths:
- excellent global POI/landmark coverage and familiar map UX;
- mature route/polyline APIs.

Trade-offs:
- API key/billing and stronger platform coupling;
- less consistent with NinFit's local-first/open renderer direction;
- using a routing API would be unnecessary for replaying the route NinFit already recorded itself.

### 5. Static-map image service

Strengths:
- very reliable presentation on completion screens;
- low client rendering cost.

Trade-offs:
- usually requires uploading route geometry or encoding it into a remote request;
- poor fit for NinFit's private exact-route boundary;
- not useful for live Journey tracking or future interactive exploration.

## Narrowed shortlist

1. **MapLibre + OpenFreeMap** — best architecture fit and best future path.
2. **Leaflet** — strongest browser-only reliability alternative.
3. **Mapbox** — strongest managed/commercial alternative.

## Why MapLibre + OpenFreeMap wins

NinFit already records its own trusted GPS points. The map's job is therefore to provide geographic context — streets, paths, place names and landmarks — while NinFit draws its own route truth. MapLibre keeps that separation clean.

OpenFreeMap provides an OpenStreetMap-derived vector basemap without an application API key. It also means NinFit can use the same MapLibre style family in a future native application. If NinFit later needs an SLA, custom cartography, geocoding or commercial support, the style/provider can be switched without migrating stored Journey data.

## Real-device failure contract

The first real Samsung walk proved that a browser map can fail as a blank rectangle even while the Journey itself records correctly. A blank rectangle is therefore forbidden as a final state.

JourneyRouteMap now treats mapping as two layers of truth:

1. **Trusted route truth** — local accepted GPS segments owned by NinFit.
2. **Basemap context** — replaceable remote map imagery/style.

If MapLibre construction fails, emits an error, loses its WebGL context, or cannot reach an idle/render-ready state within the readiness window, NinFit shows its locally projected trusted route with start/end markers and an explicit map-detail warning. It never invents a straight bridge between separate trusted segments.

## Privacy boundary

The precise Journey route remains local to the device in this feature. NinFit supplies route coordinates to MapLibre locally as GeoJSON; it does not send the route to a directions/geocoding API.

A remote basemap provider will necessarily receive requests for the map tiles/style needed for the visible viewport. That is map-context traffic, not a route upload. Any future geocoding, landmark enrichment, social route or sharing feature requires a separate privacy/product review.

## Future native path

When NinFit moves Journey recording into the native Android/iOS layer:

- keep Journey GPS/domain/storage contracts unchanged;
- use MapLibre Native for the native map surface;
- keep the web MapLibre implementation for browser/PWA use;
- keep provider selection behind configuration;
- preserve the same route-segmentation and privacy rules on both renderers.

This avoids tying background GPS work to a map vendor and lets native recording, auto-pause and map rendering evolve independently.
