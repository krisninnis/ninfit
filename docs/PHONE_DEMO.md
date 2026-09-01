# NinFit phone demo and installed-app updates

NinFit is installable as a Progressive Web App (PWA). The installed app is the same
web application served from the canonical production deployment; it is not a separate
APK or App Store binary.

## Which URL to use

- **Installed demo app:** use the canonical production site, `https://ninfit.vercel.app`.
- **Pull-request review:** open the PR's Vercel Preview URL in the browser. Do not
  install a PR preview as the long-lived NinFit app because each preview belongs to a
  specific branch/deployment.

This separation is intentional:

```
PR branch -> Vercel Preview -> human phone review
                         |
                         v
                     merge to main
                         |
                         v
production -> installed NinFit PWA
```

## How updates work while NinFit is being built

A deployment merged to `main` updates the canonical production URL.

The service worker keeps navigation **network-first**. When the installed app is
freshly launched while online, it asks the live deployment for the current application
shell before falling back to the offline copy.

NinFit also asks the browser to check the service worker for updates:

- on a fresh application load;
- when the app returns to the foreground after being suspended for a meaningful
  period; and
- when the device comes back online.

NinFit deliberately does **not** force an automatic page reload when a new worker is
found. A Journey may be recording and a surprise reload could interrupt live GPS.

### Fast build/review loop

After a change is merged and production is Ready:

1. swipe/close the installed NinFit app;
2. reopen NinFit while online;
3. the launch uses the current production deployment;
4. if something still looks old, close and reopen once more after the deployment has
   finished propagating.

Do not clear browser/site data as a routine update step.

## Android installation

In Chrome, open `https://ninfit.vercel.app`, then use the browser's **Install app**
or **Add to Home screen** action. Launch NinFit from the new home-screen icon.

Browser wording varies by Android/Chrome version.

## iPhone installation

In Safari, open `https://ninfit.vercel.app`, use **Share**, then **Add to Home
Screen**. Launch NinFit from the resulting icon.

Browser wording varies by iOS version.

## Local-first data warning

Fitness history is stored locally on the device/browser. NinFit ID does not currently
mean cloud fitness backup.

**Never clear site data, browser storage, or uninstall/reinstall as a casual update
fix when the device contains history you want to keep.**

Before any destructive browser-storage troubleshooting:

1. open NinFit's Data tools;
2. export a JSON backup;
3. store the file somewhere trusted;
4. only then consider clearing site data.

## Offline behaviour

The cached app shell is an offline fallback, not the source of truth for an online
launch. Offline mode can therefore show the most recently cached shell until the
device reconnects.

## Human acceptance for mobile-update changes

For any PWA/update PR, verify on a real phone where possible:

- the production site can still be installed;
- a fresh online launch loads successfully;
- offline fallback still opens;
- returning online does not erase local data;
- no unexpected reload happens during an active Journey;
- PR previews remain review-only and production remains the installed channel.
