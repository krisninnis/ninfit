const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

function shouldCheckForUpdate(lastCheckedAt: number, now: number): boolean {
  return now - lastCheckedAt >= UPDATE_CHECK_INTERVAL_MS;
}

/**
 * Keep the installed NinFit PWA eager to discover a newly deployed service worker
 * without turning an update into an unsafe mid-session reload.
 *
 * The app shell navigation is already network-first, so fully closing and reopening
 * the installed app loads current HTML from the deployment. This registration layer
 * additionally asks the browser to re-check /sw.js on launch and when NinFit returns
 * to the foreground after a meaningful interval.
 *
 * Deliberately no automatic page reload: a Journey may be active, and replacing the
 * running document merely because a new build exists could interrupt live GPS.
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => {
        let lastCheckedAt = Date.now();

        const check = () => {
          const now = Date.now();
          if (!navigator.onLine || !shouldCheckForUpdate(lastCheckedAt, now)) return;
          lastCheckedAt = now;
          void registration.update();
        };

        // Check once on every fresh application load.
        void registration.update();

        // A phone may leave the installed app suspended for hours. Re-check when it
        // becomes visible again, without forcing a reload or disturbing active state.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') check();
        });

        window.addEventListener('online', check);
      })
      .catch((error: unknown) => {
        console.warn('NinFit service worker registration failed.', error);
      });
  });
}
