# OpenStreetMap tile-policy review — 2026-09-05

Status: **policy evidence for provider review; not production approval**.

Reviewed against the OpenStreetMap Foundation Operations Working Group Tile Usage Policy on 2026-09-05.

## What the policy permits

Normal interactive viewing by a human is permitted when the client requests only the tiles needed for the current viewport (plus modest short-range look-ahead typical of browsers), attribution remains visible, normal browser Referer behaviour is preserved, and caching headers are respected.

Modern browsers in standard configuration are stated to satisfy the policy's technical identification/caching requirements.

## What the policy does not permit

`tile.openstreetmap.org` must not be used for bulk download, pre-seeding, background prefetch, building tile archives, or an offline-map/download-area feature. If NinFit later wants offline map imagery, it must use a provider or self-hosting strategy that explicitly permits that use.

## Reliability boundary

The OSMF tile service is best-effort and provides no SLA or availability guarantee. Access may be blocked without notice if usage harms the service. NinFit therefore must keep Journey recording independent of imagery availability and must present imagery failure honestly rather than treating missing tiles as a failed Journey.

## Privacy boundary

Tile requests reveal the viewed map area together with ordinary network/request metadata to the tile service. NinFit must not upload the user's raw Journey route merely to draw the map. The privacy notice/provider register must describe the actual production map request flow before beta.

## NinFit decision at this review

No production provider is approved by this note.

The current direct `tile.openstreetmap.org` integration may remain a candidate for normal interactive map viewing while NinFit verifies the full checklist: attribution, expected traffic, privacy wording, cache behaviour, provider availability expectations and exit/switching strategy.

Do not describe OSMF tiles as categorically forbidden for distributed apps: that overstates the current policy. Equally, do not treat the current prototype endpoint as production-approved merely because normal interactive use is permitted.

## Source reviewed

- OpenStreetMap Foundation Operations Working Group — Tile Usage Policy: `https://operations.osmfoundation.org/policies/tiles/`
