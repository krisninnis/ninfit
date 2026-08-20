# NinFit Deployment Health

## Purpose

Use this skill when diagnosing a deployed NinFit build, changing environment
configuration, or investigating something that works locally and fails in
production.

It exists because a green local build proves almost nothing about a deploy.

## Stack

- Vite (build) + React
- Vercel (hosting)
- Supabase behind an auth service boundary
- local-first data; the app works without an account

## The build-time environment rule

**`VITE_*` variables are inlined at BUILD TIME, not read at runtime.**

Consequences that catch people out:

- changing a variable in Vercel does nothing until you redeploy
- a missing variable produces a build that deploys fine and throws on load
- the value is embedded in the shipped bundle, so it must be safe to publish

## Verify variable names from source, never from memory

```bash
grep -rn "import.meta.env" src/
```

At the time of writing, `src/data/supabase/env.ts` requires exactly:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Both throw on startup if absent.

**Note the second name.** `VITE_SUPABASE_ANON_KEY` is a common assumption and is
NOT what this codebase reads. Setting the anon-key name in Vercel builds and
deploys successfully, then fails at runtime with
`Missing VITE_SUPABASE_PUBLISHABLE_KEY`. Re-run the grep above rather than
trusting this list — it is a snapshot, and source is the authority.

## Never expose

- service-role keys
- any privileged Supabase credential
- private server secrets

Never paste privileged credentials into chat, logs, commits or issue threads. A
`VITE_`-prefixed variable is public by construction; anything that must stay
secret must never carry that prefix.

`.env.local` stays untracked. For a scratch verification environment, write
placeholder values rather than copying the real file.

## Diagnosing a deployment

Work through this in order. Stopping early is how wrong conclusions happen.

1. identify which deployment you are looking at — production or preview
2. confirm the required variable NAMES from source
3. confirm environment coverage in Vercel (production, preview, development)
4. redeploy after any environment change
5. open the fresh deployment URL directly
6. hard refresh
7. inspect the console and network panels
8. verify the auth flow
9. verify static assets load
10. only then call the deployment healthy

## Hashed asset returning 404

Do not reach for routing configuration first. Almost always this is cached HTML
pointing at a hashed asset from a previous build.

Check in this order:

- open the fresh deployment URL
- hard reload
- read the asset hashes in the currently served `index.html`
- compare against the failing request in the network panel
- check the Vite `base` setting (currently `'./'`, relative, chosen so the build
  is portable across hosts and sub-paths)
- only investigate Vercel routing or caching if the failure survives a genuinely
  fresh deployment and a hard reload

## Mobile metadata

Support the modern capability declaration:

```html
<meta name="mobile-web-app-capable" content="yes">
```

Apple-specific metadata may remain where it is still useful, but must not be the
only declaration. At the time of writing `index.html` declares only
`apple-mobile-web-app-capable`; adding the standard one is outstanding.

Fuller installability — manifest, icons, offline shell, update behaviour —
belongs to the PWA phase in `docs/ROADMAP.md`. Do not build it here.
