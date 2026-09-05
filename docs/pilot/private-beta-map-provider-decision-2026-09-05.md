# Private-beta map provider decision — 2026-09-05

Status: **approved for constrained NinFit private-beta map imagery only**. This is not public-beta or production approval.

Reviewed against:

- exact repository `main` `1e3ec4efd892ecb1662cbbd91c211babb3bb67ed`;
- `docs/pilot/osm-tile-policy-review-2026-09-05.md`;
- OpenStreetMap Foundation Operations Working Group Tile Usage Policy, rechecked 2026-09-05: `https://operations.osmfoundation.org/policies/tiles/`.

## Decision

For the planned small private beta, NinFit may continue using the OpenStreetMap Foundation standard raster tile service at:

`https://tile.openstreetmap.org/{z}/{x}/{y}.png`

for **human-triggered, on-screen Journey map viewing only**, subject to every constraint in this record.

This decision intentionally avoids introducing a new paid mapping provider before the private beta when the existing integration already meets the low-volume functional need and the current OSMF policy explicitly permits normal human viewing of the tiles needed for the current viewport.

The decision expires before public beta. A public-beta/provider review must either re-approve OSMF use against then-current traffic and policy or move NinFit to another provider/self-hosted strategy.

## Repository evidence

At the reviewed `main`, `src/ui/components/JourneyRouteMap.tsx`:

- defaults to exactly `https://tile.openstreetmap.org/{z}/{x}/{y}.png`;
- allows replacement through `VITE_MAP_TILE_URL`, so provider switching does not require changing Journey data or route truth;
- declares visible OpenStreetMap attribution in the MapLibre raster source;
- sends only raster tile requests for the viewed map area; the route itself remains a local GeoJSON source and is not submitted to OSMF merely to draw the line;
- does not implement an offline-map download, regional prefetch, archive build or background tile-seeding feature;
- keeps Journey recording/data independent from the tile provider.

PR #217 further preserves that separation by keeping the map mounted and route truth available when base imagery fails, with an honest imagery-unavailable message after repeated base-tile failure.

## OSMF policy conditions NinFit must preserve

The current Tile Usage Policy requires, among other things:

- the correct HTTPS tile URL;
- visible OpenStreetMap attribution;
- valid browser Referer behaviour for web clients;
- normal caching behaviour and no default no-cache bypass;
- no bulk download, scraping, pre-seeding, background prefetch or offline-area feature;
- acceptance that the service is best-effort, has no SLA and may block access if usage harms the service.

The policy notes that modern browsers in standard configuration satisfy its browser identification/caching requirements. NinFit must not introduce a proxy, restrictive referrer policy, custom tile-fetch layer or cache-bypass behaviour without re-review.

## Private-beta scope limits

This approval is valid only while all of the following remain true:

1. Beta remains small and invitation-only, approximately the planned 15–25 people/pairs of hands.
2. Tiles are requested only while a human is viewing a Journey map; no background tile collection is added.
3. No offline-map imagery/download-area feature exists. Offline NinFit app boot does not imply offline map imagery.
4. Existing visible attribution remains present and unobscured.
5. `VITE_MAP_TILE_URL` remains available as the provider exit switch.
6. Missing imagery never corrupts, cancels or changes the authoritative Journey record.
7. The privacy notice discloses that viewing map imagery can expose the viewed geography plus ordinary network/request metadata to the map tile service.
8. No raw Journey route is uploaded to OSMF as a route payload.

## Immediate re-review triggers

Re-review before continuing if any of these occur:

- beta size or map traffic grows materially beyond the planned private-beta cohort;
- public beta or paid/commercial launch is proposed;
- OSMF changes the relevant policy;
- tiles are blocked, throttled or unreliable enough to harm the experience;
- a proxy/CDN/custom fetch layer is introduced;
- map interactivity starts prefetching beyond ordinary viewport behaviour;
- offline map imagery is proposed;
- route/search/geocoding features would send additional user location data to a provider.

## Reliability and fallback

OSMF gives no SLA. The map provider therefore remains presentation infrastructure, never Journey truth. A tile outage may remove background imagery but must not remove or alter recorded route points, distance, completion state or local history.

PR #217 is the runtime candidate that makes this outage boundary visible to the user. Its H-H real-GPU route-line and phone visual gates remain required independently of this provider decision.

## Privacy boundary

A raster tile request necessarily identifies a viewed tile/map area to the tile service and carries ordinary web-request metadata such as IP/network information. This is less data than uploading NinFit's raw GPS route, which the current renderer does not do.

Before strangers enter beta, the actual privacy notice must describe this real request flow. This technical approval does not replace the separate legal/privacy publication gate.

## Public-beta disposition

**Not approved for public beta by this record.**

Before public beta, compare at least one production-oriented OSM-derived provider or self-hosted strategy against expected traffic, reliability, privacy, attribution, cost, keys, caching/offline terms and exit path. If continued OSMF use is proposed, re-read the live policy and explicitly justify expected load again.

## Verdict

**Private beta: APPROVED WITH CONSTRAINTS.**

**Public beta / production: PENDING REVIEW.**
