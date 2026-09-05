# NinFit Rollback Rehearsal Record v1

## Status

**NOT RUN.**

This is the evidence record for launch-summit milestone M10. Creating this document does
not satisfy the rehearsal. M10 passes only after an authorised human deliberately
executes the existing `release-and-rollback-runbook-v1.md`, verifies recovery, and
records the exact production/deployment evidence below.

## Purpose

Prove that NinFit can return from a bad client release to a known-good build without:

- force-pushing `main`;
- deleting browser/site storage;
- corrupting local fitness history;
- confusing a Vercel deployment rollback with data recovery;
- leaving an installed PWA trapped on the bad build.

The rehearsal is about release recovery. It must not manufacture or destroy user data
for the sake of proving the deployment mechanism.

## Preconditions

Before the rehearsal starts, record and verify:

- [ ] current canonical `main` SHA;
- [ ] current production deployment URL/ID and Ready state;
- [ ] current in-app version/channel/build fingerprint;
- [ ] a genuinely known-good target SHA for the affected smoke-test flow;
- [ ] one disposable/test-device local dataset whose preservation can be checked;
- [ ] a JSON backup of that test dataset stored outside the app/device storage being exercised;
- [ ] authorised human reviewer is present;
- [ ] no active Journey is recording;
- [ ] the exact rollback mechanism to be used is chosen before making production changes.

Do not choose the known-good SHA merely because it is older. It must have evidence that
the relevant flow worked on that build.

## Rehearsal scenario

Use a controlled scenario that proves deployment rollback without deliberately shipping
a data-corrupting build. The preferred rehearsal is:

1. record the current healthy production identity;
2. identify the known-good rollback target;
3. use the normal Vercel/GitHub release mechanism authorised by the runbook to move
   production to that known-good target;
4. wait for production to reach Ready;
5. launch the canonical production URL and the installed PWA;
6. verify local test data is still present;
7. verify the minimum production smoke checks;
8. record the new in-app build fingerprint;
9. restore the intended current release through the normal release mechanism;
10. repeat Ready, launch, local-data and smoke checks;
11. record every production SHA/deployment transition.

If the available deployment tooling cannot safely exercise this scenario without a
real outage risk, mark the rehearsal **BLOCKED** and record the exact blocker. Do not
replace the rehearsal with a prose claim that rollback 'should work'.

## Minimum smoke checks after each transition

- [ ] canonical production URL launches;
- [ ] Today renders;
- [ ] primary navigation works;
- [ ] Settings opens;
- [ ] Settings → Data remains reachable;
- [ ] build identity matches the deployment being tested;
- [ ] installed PWA fully closes and reopens;
- [ ] pre-existing local test history remains present;
- [ ] no instruction or recovery step cleared site data;
- [ ] no active Journey was interrupted by the rehearsal.

If the rehearsed release affects Journey or offline boot, add the bounded smoke checks
from the runbook rather than inventing GPS points or fitness truth.

## Evidence record

```text
ROLLBACK REHEARSAL
status: NOT RUN / PASS / PASS WITH ACCEPTED LIMITATION / FAIL / BLOCKED
date/time:
human reviewer:

starting main SHA:
starting production deployment:
starting production Ready:
starting app version:
starting channel:
starting build fingerprint:

known-good target SHA:
why target is known-good:
rollback mechanism used:
rollback authorised by:

rollback deployment:
rollback Ready at:
rollback app version:
rollback build fingerprint:
rollback smoke checks:
local test data preserved: yes/no
installed PWA reopened: yes/no
issues/limitations:

return-to-current SHA:
return deployment:
return Ready at:
return build fingerprint:
return smoke checks:
local test data preserved after return: yes/no

site/browser storage cleared at any point: MUST BE NO
force-push used: MUST BE NO
production user-data recovery required: yes/no
screenshots/logs/links:
notes:
```

## Pass condition

M10 is PASS only when:

1. the release was deliberately moved to a recorded known-good target through an
   authorised normal release/deployment mechanism;
2. production reached Ready and the expected build identity was visible;
3. the installed PWA reopened successfully;
4. representative local test data survived;
5. the intended release was restored and reverified;
6. neither site-data deletion nor force-push was used;
7. the completed evidence record is committed or otherwise retained with the launch
   evidence.

A Vercel button existing, a successful historical deployment, or a dry reading of the
runbook is not a rehearsal.

## Failure / stop rules

Stop and record FAIL/BLOCKED rather than improvising if:

- the known-good target cannot be established;
- production does not reach Ready;
- the installed PWA cannot reopen on the expected build;
- local test data disappears or changes unexpectedly;
- the only proposed recovery is to clear browser/site data;
- an active Journey or other consequential user state would be put at risk;
- the deployment action available is not understood well enough to reverse safely.

Rollback is not data recovery. If persisted data has already been destroyed or changed
irreversibly, follow a specific data-recovery incident plan rather than treating a
client redeploy as sufficient.
