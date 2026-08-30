# NinFit phone demo

Use this guide when installing or refreshing the web app used for a phone demo.
NinFit is an installable web app, not a native Android or iOS app.

## Canonical production address

**[https://ninfit.vercel.app/](https://ninfit.vercel.app/)**

Install only that origin for a reusable demo. A Vercel preview has a different
origin, its own service worker and its own local NinFit data. Installing a preview
can therefore look permanently old after a newer release reaches production.

Before adding the icon, check that the address bar says exactly
`ninfit.vercel.app`. Links containing another Vercel hostname are review previews,
not the canonical phone demo.

## What the current mobile build supports

The production architecture was audited against `main` at
`87c613b6905a793c5f32da05333393874b470fad` on 30 August 2026.

| Area | Verified behaviour |
|---|---|
| Manifest | `/manifest.webmanifest`, app ID/start URL/scope `/` |
| Launch | Root document, then NinFit's existing hash routes such as `#/today` |
| Presentation | `standalone`, portrait-primary |
| Icons | 192 px, 512 px and Apple touch icons are present |
| Mobile chrome | Modern and Apple mobile-web-app declarations are present |
| Safe areas | `viewport-fit=cover`; shell, bottom navigation and active Journey use safe-area insets |
| Service worker | Root-scoped `/sw.js`; same-origin GETs only; network-first navigation |
| Hosting cache | Production HTML, manifest and worker currently return `max-age=0, must-revalidate` |
| Offline | A minimal fallback shell, manifest and icons; this is not yet a promise that every NinFit feature works offline |

### Stale-build finding and correction

The original service worker cached `/` only when the worker was first installed.
Its cache was called `ninfit-shell-v1`, while the worker file itself did not change
on ordinary product deployments. Online navigation was already network-first, so a
healthy online launch should fetch production. However, the offline fallback could
remain the HTML from the first installed build indefinitely.

The worker now replaces that fallback after every successful online launch. The app
also asks the browser to check the worker byte-for-byte on launch without consulting
the HTTP cache. This is a bounded cache/update correction; it does not cache fitness
records, change hash routing or add a second offline system.

An installed copy that still looks old is most likely one of these:

1. it was installed from an old preview origin;
2. it has not completed one online launch since the new deployment;
3. it is showing the old offline fallback because the phone has no usable network;
4. the app was left open as a long-lived standalone client and has not been closed
   and relaunched.

## Install on Android with Chrome

1. Open Chrome and visit [the canonical production address](https://ninfit.vercel.app/).
2. Wait for Today to load while the phone is online.
3. Open Chrome's **More** menu.
4. Choose **Install and create shortcut**, then **Install**. Some Chrome versions
   label this **Install app** or **Add to Home screen**.
5. Follow the on-screen prompt, then launch NinFit from its new icon.

Google's current Android instructions are in
[Use web apps](https://support.google.com/chrome/answer/9658361/use-progressive-web-apps-android?co=GENIE.Platform%3DAndroid&hl=en-GB).
A plain Chrome-logo shortcut is different: it opens a browser tab rather than the
standalone installed presentation.

## Add on iPhone with Safari

1. Open Safari and visit [the canonical production address](https://ninfit.vercel.app/).
2. Wait for Today to load while the phone is online.
3. Tap **More**, then **Share** (or tap Share directly, depending on the Safari tab
   layout).
4. Tap **Add to Home Screen**. If it is hidden, use **Edit Actions** to add it.
5. Turn on **Open as Web App**, then tap **Add**.
6. Launch NinFit from the new Home Screen icon.

These steps follow Apple's current
[Turn a website into an app in Safari on iPhone](https://support.apple.com/en-gb/guide/iphone/iphea86e5236/ios)
guidance. Install from Safari, not from an in-app browser opened by Messages, Mail or
another app.

## Get the latest production deployment

Try these in order. Stop as soon as the current production UI appears.

1. Confirm the phone is online.
2. Close the standalone NinFit window completely, including its card in the app
   switcher.
3. Open [https://ninfit.vercel.app/](https://ninfit.vercel.app/) in the normal
   Chrome or Safari browser and reload it once.
4. Leave the production page open long enough to finish loading, then close it.
5. Relaunch the Home Screen icon. A successful online launch refreshes NinFit's
   offline fallback for the next launch.
6. Check the origin. If the installed copy came from a preview hostname, follow the
   backup-first reinstall procedure below.

Do not repeatedly tap reload while offline. The fallback is deliberately the last
successfully cached production shell; it cannot learn about a newer deployment
without one successful network response.

## How to identify the build

The current app does **not** expose a human-readable commit SHA in its UI. Do not use
the `0.1.0` value in a JSON backup as proof of a particular deployment: that is the
package release version, not a unique build identifier.

For a phone demo, verify all of the following:

- the origin is `https://ninfit.vercel.app/`;
- the screen matches the feature expected from the latest merged PR;
- the same production URL shows the same feature in a fresh normal-browser tab.

For an engineering check, GitHub's latest successful **Production** deployment must
point to the expected `main` commit. On desktop, the entry script named in the live
`index.html` (for example `assets/index-<hash>.js`) provides a deployment fingerprint,
but that hash is not a user-facing version number.

A visible build identifier remains a future release-operations improvement; its
absence should not be hidden by inventing one in this guide.

## Backup-first reinstall

NinFit is local-first. Fitness history, Journey records and game state are stored by
the browser for the exact site origin. Clearing site data can erase the only copy.

Before removing an old icon or changing origins:

1. Open the copy that contains the wanted history.
2. Open **Data** (or **Settings → Data & privacy** once that navigation release is
   in production).
3. Export a JSON backup.
4. Confirm the downloaded file exists in Files/Downloads before continuing.

Then:

1. Remove the stale Home Screen icon or installed web app using the phone's normal
   remove/uninstall action.
2. **Do not** choose an option that says it will clear site data, storage or browsing
   data.
3. Reinstall from [the canonical production address](https://ninfit.vercel.app/)
   using the platform steps above.
4. Check whether the local history is present before importing anything.
5. If the new install is empty, keep the backup safe and use NinFit's existing
   restore flow deliberately. Review the import summary before confirming it.

Browser/platform versions differ in what they retain when a Home Screen web app is
removed. Treat removal as potentially destructive and rely on the verified backup,
not on an assumption that storage will survive.

## Do not use these as routine update steps

- **Clear browsing data / clear site data / clear storage** — may delete NinFit data.
- **Clear all Chrome or Safari history and website data** — much broader than needed
  and potentially destructive.
- **Install a fresh preview URL** — creates another isolated data origin.
- **Restore a backup without reading the import summary** — restore is an explicit
  data replacement decision.

If a stale copy cannot export, preserve it and record its exact URL before doing
anything destructive. That origin may be the only place where its local history can
still be recovered.

## Limits of this audit

- Manifest, worker, production headers, hash routing, icons and responsive safe-area
  code were verified from the deployed web origin and repository.
- Android Chrome and iPhone Safari install instructions were checked against the
  platform owners' current documentation.
- A real-device Android install/upgrade and iPhone Add to Home Screen cycle still
  require human device checks; desktop emulation cannot prove launcher or iOS storage
  behaviour.
- Full offline tracking is still roadmap work. The present service worker is a
  conservative shell fallback, not a completed offline product contract.
