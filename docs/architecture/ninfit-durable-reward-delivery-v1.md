# NinFit Durable Reward Delivery v1

**Status:** Architecture specification — authored, not implemented. No runtime, test or schema file has been changed.
**Scope:** How a granted reward reaches the user exactly once, across reloads, navigation, and screens that were not mounted when it was earned.
**Repository:** `krisninnis/ninfit`
**Product:** NinFit
**Version:** v1
**Written against:** `origin/main` at `2a2799ccc2f5785deeb92f33b57ffc8af02bbf6a` (PR #60)
**Last updated:** 27 August 2026

---

## 1. Purpose and status

This document is the durable contract for **reward delivery** — the layer between a
reward being granted and the user being told about it.

It exists because that layer currently does not exist. Granting is sound and has been
sound since Phase 8.1. What is missing is any record that a granted reward has been
*shown*, and the absence is not theoretical: it has been reproduced in a browser
against this exact commit.

`docs/product/ninfit-reward-presentation-v1.md` remains the contract for **how** an
acknowledgement looks, reads and behaves. Nothing in it is superseded here. This
document specifies **which** events reach it and **when** they stop reaching it.

### Decision labels

Following the reference shape of the reward presentation spec:

- **LOCKED** — decided; changing it needs a new version of this document.
- **DIRECTION** — the intended shape; implementation may refine the detail.
- **OPEN** — genuinely undecided; listed in section 21 and needing a human answer.

---

## 2. Problem statement

Five independent `useGame()` instances each call `syncGame` during their own render.
`syncGame` derives, grants, persists, and returns the newly granted events as a
transient `granted` array. React renders parent before child, so **whichever
component renders first takes the delta and every later one receives `granted: []`**.

Only one of the five surfaces can present a reward.

The result is that a user can earn XP and a trophy, have both persisted correctly,
and be told nothing at all — because the component that could have told them was not
the one holding the array.

There is a second, independent loss in the same layer: the acknowledgement is
transient React state, so leaving Today during its dwell destroys it permanently.

Both are **delivery** failures. Reward truth, derivation, granting, idempotency and
persistence are all correct and are not changed by this specification.

---

## 3. Evidence summary

From the discovery run against `2a2799c`. Every claim below was re-checked against
current source before this document was written.

### Proven at runtime

| # | Finding | How it was proven |
|---|---|---|
| 1 | The first `syncGame` caller consumes the delta; later callers get `[]` | Three sequential syncs: first grants, second and third return `[]` |
| 2 | The parent grants during render; the child gets an empty delta | `react-dom/server` render of `<Root><Today/></Root>` using the real `useGame` |
| 3 | The same child gets the delta when nothing renders before it | Same harness, child rendered alone |
| 4 | Cold load loses the acknowledgement entirely | Browser, Today route: `xp total after load: 55`, `awardedKeys` grew by two, **`acknowledgement visible: false`** |
| 5 | A surface with no acknowledgement can eat the delta in-session | Browser: measurement added on Profile → Passport visited → Passport granted and persisted → Today showed nothing |
| 6 | Leaving Today mid-dwell loses the acknowledgement permanently | Browser: `visible before leaving: true`, `visible after returning: false` |
| 7 | The lost events survive, unread, in persisted state | `recentEvents: ["Taking It Seriously","First measurement recorded"]` after a silent grant |
| 8 | Today's normal completion path is reliable | Browser: ticking an activity rendered all four lines |
| 9 | Leaving inside the 700 ms save debounce is safe | Browser: `useToday`'s unmount flush saves; nothing grants; the acknowledgement appears on return |

### Established from source

- `src/ui/hooks/useGame.ts:47` — `useMemo(() => syncGame(repository), [repository, revision])`. `useMemo` runs **during render**, not in an effect.
- Five live `useGame()` sites: `src/App.tsx:49`, `src/ui/screens/TodayScreen.tsx:132`, `src/ui/screens/ProfileScreen.tsx:629` (`GameSection`), `src/ui/screens/ProfileScreen.tsx:738` (`SettingsSection`), `src/ui/screens/PassportScreen.tsx:20`. **Only TodayScreen renders `RewardAcknowledgement`.**
- `src/ui/hooks/useProfile.ts` contains no `useGame`, no `refresh` and no `syncGame`. Writing a measurement tells the game layer nothing.
- `src/app/game.ts:73` — `if (changed) repository.saveGameState(state)`. Writes are guarded; derivation is not. Profile renders three `deriveRewards` passes.
- `src/storage/repository.ts:445` — `getGameState()` guards with `isRecord` only. Sub-fields are unvalidated.
- `src/domain/game/rewards.ts:334` — `recentEvents` is built from `granted.reverse()`, which mutates in place. Section 12 addresses the consequences without fixing the bug.

### Not in evidence

No cross-tab invalidation exists anywhere: `grep` for `addEventListener('storage'`,
`BroadcastChannel` and `onstorage` across `src/` returns nothing.

---

## 4. Non-goals — LOCKED

This specification does **not** cover, and its implementation must not include:

- cross-tab state synchronisation of any kind (section 14 states the contract, and it is "out of scope")
- the `granted.reverse()` grant-order bug (section 12 — separate slice)
- App-level path/accent freshness after a Profile path switch (separate slice)
- reducing the five `useGame()` instances to one, or introducing a shared React provider
- a new testing dependency, renderer or DOM environment (section 18)
- any change to reward derivation, XP values, trophy rules, consistency milestones or hatch/evolution eligibility
- any change to reward wording, tier mapping, dwell duration, layout or motion
- a `RewardKind` for level-up
- PBs, sound, haptics, cinematics, Secret Prestige
- presenting rewards on any screen other than Today
- a backend, an account requirement or any network dependency

---

## 5. What "exactly once" means here — LOCKED

Applied to **acknowledgement presentation**, not to rendering internals. A component
may re-render any number of times; React may discard and rebuild a subtree. What is
guaranteed is that a granted reward is **offered to the user for its full designed
reading time exactly once**, and then never again on this device.

Three things are explicitly *not* claimed:

- that the user read it — unknowable, and designing for it would require interaction
- that it is shown exactly once **per user across tabs** — see section 14
- that it is shown at all if the user never opens Today again within the freshness horizon — see section 8

---

## 6. Acknowledgement semantics — LOCKED

**A reward becomes acknowledged when its acknowledgement batch has been mounted and
present for its full dwell, and the dwell timer has elapsed.**

Dwell is already defined by `docs/product/ninfit-reward-presentation-v1.md` §11 and
implemented as `rewardDwellMs(count)`: 2200 ms base, +600 ms per extra line, capped at
4400 ms. It is **reading time, not animation time** — started on mount, tied to no
transition, and explicitly required to survive reduced motion. That property is what
makes it the right acknowledgement trigger and it must not be weakened.

### Alternatives considered

| Semantic | Why not |
|---|---|
| **1. Component mounts** | Acknowledges before the user could plausibly read anything. A 200 ms navigation loses the reward permanently — the exact defect being fixed, moved earlier. |
| **2. Event becomes visible** | Needs `IntersectionObserver` or an animation/transition hook. Couples correctness to layout and motion, and reduced-motion users would be acknowledged differently. Forbidden by the presentation contract. |
| **3. Dwell starts** | Identical to (1) in every failure case. |
| **4. Dwell completes** | **Chosen.** The product has already decided how long a batch needs to be readable. Leaving early leaves it pending; a crash leaves it pending; completing it retires it. |
| **5. Explicit dismissal** | Requires interaction for every routine activity tick. Turns a calm in-flow strip into something to deal with, and edges towards a dialog. Rejected by the presentation contract. |
| **6. After navigation away** | Acknowledges the case the user demonstrably did *not* see. Backwards. |
| **7. After crash/reload during presentation** | Same. A crash is the strongest possible evidence the moment was not delivered. |

### What the chosen rule buys

- Left mid-dwell → still pending → shown again next time Today is opened.
- Reload mid-dwell → still pending → shown after the reload.
- Never mounted → still pending.
- Dwell completed → gone, permanently.
- No interaction is ever required. Nothing blocks navigation. Nothing is modal.
- Correctness is independent of CSS, transitions, `prefers-reduced-motion` and frame rate.

### The replay bound

A user who opens Today and leaves within the dwell every single time would see the
same batch each visit. The freshness horizon (section 8) bounds this absolutely, and
the behaviour self-corrects the first time they linger. Presenting an un-read
acknowledgement again is more honest than discarding it, so no additional attempt
counter is specified — that would be persisted state serving a case the horizon
already closes.

---

## 7. Chosen architecture — LOCKED

**A persisted pending-delivery queue inside `GameState`, appended by the existing
grant path and drained by the presenter on dwell completion.**

```
fitness truth                    (repository — unchanged)
  ↓
deriveRewards                    (src/domain/game/rewards.ts — unchanged)
  ↓
grantRewards                     (idempotent by awardedKeys — unchanged)
  ↓
persisted reward state           (xp, skills, trophies, awardedKeys, recentEvents — unchanged)
  ↓
persisted pending delivery       (NEW — GameState.pendingRewardDeliveries)
  ↓
acknowledgement presentation     (RewardAcknowledgement — reads the queue, not `granted`)
  ↓
acknowledgement completion       (dwell elapsed → remove from the queue)
```

### The load-bearing consequence

Once delivery is durable, **it no longer matters which `useGame()` instance calls
`syncGame` first**. Every caller appends to the same persisted queue; every caller
after the first appends nothing, because granting is already idempotent. The race is
not avoided — it is made harmless.

This is why no shared React provider is needed to fix the proven defect, and why the
five-instance question is correctly a separate slice about redundant derivation and
path freshness rather than a prerequisite for correctness.

---

## 8. Freshness horizon and queue bounds — DIRECTION

An acknowledgement says *"here is what you just earned"*. A reward that has waited a
month is not something the user just earned, and presenting it as though it were
would be historical truth masquerading as a fresh moment — which the repository has
already ruled against twice, most recently in the Journey Home companion (PR #59),
where a completed Journey deliberately cannot reach a celebration because Journey
carries no trustworthy freshness identity.

**Rule:** an entry whose `awardedAt` is more than `REWARD_DELIVERY_HORIZON_DAYS` old
is **retired** — removed from the queue without being presented.

- Proposed value: **7 days**, one programme week. See section 21, OPEN-1.
- Retirement is pruning, not loss: the XP, the trophy and `awardedKeys` are untouched, and the reward remains visible in Passport and Profile. Only the *moment* is not manufactured after the fact.
- Pruning happens inside `syncGame`, which already runs on every mount, so no separate scheduler exists or is needed.

**Cap:** `MAX_PENDING_REWARD_DELIVERIES = 50`, oldest retired first. Defensive only —
the import path seals reward keys, so no realistic flow produces a burst near it. A
cap that silently discarded *undelivered* entries would recreate the bug being fixed,
so the cap is deliberately far above any batch the domain can produce (the largest
observed real batch is four).

---

## 9. Why not `recentEvents` — LOCKED

`docs/product/ninfit-reward-presentation-v1.md` §22 calls `recentEvents` *"the natural
foundation for a durable reward queue"*. That was a DIRECTION note, not a decision,
and current source does not support it.

### Established semantics of `GameState.recentEvents`

| Question | Answer, from source |
|---|---|
| History, delivery state, or both? | **History.** Typed *"Most recent first, capped. Used only to show what just happened."* (`types.ts:264`) |
| Cap | 20 (`MAX_RECENT_EVENTS`, `rewards.ts:49`) |
| Fields | Full `RewardEvent`: `id`, `key`, `kind`, `xp`, `skillXp`, `label`, `date?`, `awardedAt` |
| Written by | `grantRewards` only (`rewards.ts:334`), and initialised `[]` in `defaults.ts:74` |
| Read by | **Nothing.** The only other occurrence in the repository is a comment in `consistency.test.ts:367` |
| Import/export | Exported and restored verbatim as part of `game.state` |

### Why overloading it is wrong

1. **The cap is silent and would drop undelivered rewards.** A queue must never lose an entry it has not delivered; a capped history must drop its oldest. Those are opposite requirements on one array, and merging them means a burst of more than 20 grants silently discards rewards nobody has seen — the exact class of failure this document exists to close.
2. **The orderings are opposite.** History is newest-first so a future "what happened lately" view reads correctly. Delivery must be oldest-first so events are presented in the order they happened. Section 12 shows this collision has already caused one live bug.
3. **The lifecycles are opposite.** A history entry is retained; a delivered entry is removed. One array cannot do both without a discriminator, which is a second field on a structure that already has a stated single purpose.
4. **Import must treat them differently.** History should restore; pending delivery must not (section 13). One field cannot have two import rules.
5. **`ninfit-mascot-system` requires the separation**: *"Permanent appearance/progression and temporary condition must remain mechanically separate."* A delivery ticket is a temporary condition.

**Decision: two structures. `recentEvents` is not read, not written, not moved and not
re-purposed by this work.** Its unread status remains a recorded deferred issue.

---

## 10. Alternatives compared

Evaluated against the criteria in the brief. **F** is chosen.

| | A. Extend `recentEvents` | B. Separate persisted queue | C. Last-delivered pointer | D. Shared provider only | E. Single owner + in-memory | **F. Single grant path + durable queue** |
|---|---|---|---|---|---|---|
| Cold load | Works, but cap can drop | Works | Breaks — see below | Works | Works | **Works** |
| Today not mounted | Works | Works | Works | Works | **Fails** — nothing holds it | **Works** |
| Navigate mid-dwell | Works | Works | Partly | **Fails** | **Fails** | **Works** |
| Exactly-once | Yes | Yes | No — cannot express out-of-order | Per-session only | Per-session only | **Yes** |
| Crash / reload | Survives | Survives | Survives | **Lost** | **Lost** | **Survives** |
| Ordering | **Conflicts** (newest-first) | Explicit | Undefined | N/A | N/A | **Explicit, oldest-first** |
| Growth / capping | **Silent loss at cap** | Bounded | Trivial | N/A | N/A | **Bounded, horizon + cap** |
| Schema impact | None (field exists) | Additive optional | Additive optional | None | None | **Additive optional** |
| Migration | None | Absent → `[]` | Absent → null, ambiguous | None | None | **Absent → `[]`** |
| Import/export | **Cannot differ from history** | Own rule | Referent may not exist | N/A | N/A | **Own rule (cleared)** |
| `recentEvents` compat | **Destroys its purpose** | Untouched | Depends on it | Untouched | Untouched | **Untouched** |
| Multi-tab | Benign | Benign | **Regresses** — pointer clobber | Unchanged | Unchanged | **Benign (removals commute)** |
| Complexity | Low | Low | Low | Medium | Medium | **Low** |
| Testability | Medium | High | Low | Low | Low | **High (pure policy)** |
| Domain↔presentation coupling | Same risk | Same risk | Same risk | High | High | **Contained — queue is data, policy is pure** |
| Turns history into delivery state? | **Yes** | No | **Yes** | No | No | **No** |
| Can replay old events? | Yes, uncapped | Bounded by horizon | **Yes — pointer resets replay everything** | No | No | **No — horizon + cleared on import** |

### Why each rejected option was rejected

**A — extend `recentEvents`.** Section 9. It is history; the cap silently loses
undelivered rewards; the orderings and import rules conflict.

**B — a separate ledger keyed alongside `GameState`.** Functionally equivalent to F,
but it introduces a **new storage key** outside `GameState`, which means a second
thing export must learn about, a second thing import must clear, a second thing that
can be corrupt independently, and a second thing that can disagree with `awardedKeys`.
F puts the queue inside `GameState`, where export, import, quarantine and the write
guard already handle it for free. **B is F with more moving parts.**

**C — a single last-delivered / last-acknowledged pointer.** Rejected on evidence, not
taste. A pointer must point into something; the only ordered structure available is
`recentEvents`, which is capped at 20 and rolls. Once it rolls past the pointer, the
pointer is dangling and the only safe interpretations are "show nothing" (loses
rewards) or "show everything" (replays history). It also cannot express partial
delivery — three of four events shown — which the dwell semantics make possible on a
reload. And on import the pointer's referent may simply not exist.

**D — a shared React provider only.** Makes all five instances agree on one `granted`
array. That fixes findings 1–5 and does nothing at all for finding 6: the array is
still transient React state, so navigating mid-dwell still destroys it, and a reload
still destroys it. It fixes the symptom that is easiest to see and leaves the harder
half. It is the right *later* slice for redundant derivation and path freshness — it
is not a fix for durable delivery.

**E — single sync owner + transient in-memory delivery.** Same fatal property as D,
plus it requires the delivery holder to outlive every screen, which is a provider by
another name.

**G — better minimal alternative.** One was considered and rejected: **derive
pending delivery from `awardedKeys` against a persisted `lastAcknowledgedKey` set**,
storing no events at all. It is smaller, but it forces the presenter to *re-derive*
what a reward was — its label, its XP, its kind — from `deriveRewards` at presentation
time. That puts reward eligibility logic downstream of the grant, which is precisely
the layering inversion `ninfit-fitness-truth` forbids: *"Do not reverse this
pipeline."* The presenter must never be able to manufacture a reward. Storing the
granted event verbatim is what guarantees it cannot.

---

## 11. Data model — DIRECTION

### The new field

```ts
// src/domain/game/types.ts

export interface GameState {
  // ... existing fields unchanged ...

  /**
   * Rewards granted but not yet shown to the user. OLDEST FIRST — this is a delivery
   * queue, not a history, and the order is the order things happened.
   *
   * Absent on saves written before durable delivery existed; absent and empty both
   * mean "nothing to present", and nothing may read a difference into them.
   *
   * NOT `recentEvents`. That is capped history, newest-first, and dropping its oldest
   * entry is correct. Dropping an entry from THIS array before it has been presented
   * is the bug this field exists to prevent.
   */
  pendingRewardDeliveries?: RewardEvent[];
}
```

**The element type is `RewardEvent`, unchanged and unwrapped.** No wrapper, no
`queuedAt`, no `seen` flag, no `attempts` counter:

- `queuedAt` would duplicate `awardedAt`, which is set at grant time and is what the horizon must measure from anyway.
- A `seen` boolean would make the queue grow forever and turn it into a second history — the thing section 9 rejects. Presence in the array *is* "unseen"; removal *is* "seen".
- An attempts counter serves a case the horizon already closes (section 6).

### Constants

```ts
export const MAX_PENDING_REWARD_DELIVERIES = 50;
export const REWARD_DELIVERY_HORIZON_DAYS = 7;   // OPEN-1
```

### Conceptual operations

Names are DIRECTION; the shapes are LOCKED. All live in the app layer
(`src/app/game.ts`), all take a `Repository`, none is a React hook.

```ts
/** Oldest first, horizon-filtered. Pure read; writes nothing. */
pendingRewardDeliveries(repository: Repository, now?: ISODateTime): RewardEvent[]

/**
 * Remove the named events from the queue and persist.
 * MUST re-read current game state and write back only this field — see section 14.
 * Removal is idempotent: acknowledging an id twice is a no-op, never an error.
 */
acknowledgeRewardDeliveries(repository: Repository, ids: readonly string[]): void
```

And one pure policy function in the domain, so the rule is testable without a
renderer — following the pattern PR #58 established with
`companionReactionPresentationForLifetime`:

```ts
/** Which pending entries are still deliverable, and which have aged out. */
export function partitionPendingDeliveries(
  pending: readonly RewardEvent[],
  now: ISODateTime,
  horizonDays: number,
  cap: number,
): { deliverable: RewardEvent[]; retired: RewardEvent[] }
```

### Enqueue rules — LOCKED

1. `grantRewards` appends newly granted events to the queue **in derivation order**, from a copy that is not the array used to build `recentEvents` (section 12).
2. Enqueue is deduplicated by `RewardEvent.key`. A key already pending, or already in `awardedKeys` before this grant, is never appended. Granting is already idempotent, so this is defence in depth rather than the primary guarantee.
3. Nothing else in the codebase may append to the queue. The presenter may only remove.

---

## 12. Ordering semantics — LOCKED

The brief asks five questions. Answers, from source:

**Does durable delivery preserve domain grant order?** Yes — it must. The queue is
appended in `deriveRewards` order, which the domain documents as deterministic and
already tests.

**Is ordering part of queue semantics?** Yes. Oldest-first is a contract of the field,
stated in its own doc comment, and asserted by a test.

**Can a future ordering bug corrupt delivery?** Yes, and one exists today.
`rewards.ts:334` builds `recentEvents` from `granted.reverse()` — an **in-place
mutation** — and then returns that same mutated array. Measured:

```
DERIVED : ["first_measurement","trophy:taking_it_seriously"]
GRANTED : ["trophy:taking_it_seriously","first_measurement"]
```

**This is not fixed here** — it is its own slice, as instructed. But it dictates one
non-negotiable implementation rule: **the queue must be appended from a copy taken
before any reversal**, so that slice 1 is correct whether or not the ordering bug has
been fixed yet, and so that fixing it later cannot silently reorder delivery. A test
must pin this.

**Do event IDs give deterministic order when timestamps collide?** **No.** Every event
in one grant batch shares a single `timestamp` (`options.now ?? nowTimestamp()`), so
`awardedAt` cannot order within a batch. `newId` is a UUID and is not lexically
ordered. **Array position is the only order of record**, which is why the field's
ordering is part of its contract rather than something a consumer may re-derive by
sorting.

**Do newest-first history and oldest-first delivery need separate representations?**
**Yes** — and the bug above is the proof. One array serving both orderings is exactly
what let a mutation for one purpose corrupt the other.

---

## 13. Import and export — LOCKED

Governing principle, from the brief and consistent with the repository's existing
posture: *historical or imported truth must not masquerade as a fresh earned moment.*

| Question | Rule |
|---|---|
| Is pending delivery state exported? | **Yes**, verbatim, as part of `game.state`. No change to `buildBackup` — it already exports whole `GameState`, and making export lossy to serve an import rule would be the wrong end to fix. |
| Is it restored? | **No.** `resolveGameState` sets the queue to `[]` on **every** import path. |
| Can importing an old backup replay rewards? | **No.** Cleared on import; and pre-game-layer backups already get fresh state plus `sealRewardKeys`, so nothing is derivable to grant. |
| Does a replacement import clear current pending acknowledgements? | **Yes.** Import is a replacement of the whole game state; a queue belonging to the replaced state does not survive it. |
| Same-version backups | Cleared, as above. |
| Older-version backups | Cleared, as above. |
| Is imported reward history ever presented as new? | **Never.** |

**Why cleared rather than restored.** Restoring a queue would mean the moment a user
finishes a restore, they are shown a run of "here is what you just earned" for work
done on another device, at another time, possibly months ago. Nothing is lost by
clearing: XP, level, skills, trophies, `awardedKeys` and `recentEvents` all restore
exactly as they do today. Only the un-shown ticket is dropped, and a ticket is a
statement about *this device's* delivery, not about the user's history.

**Schema impact of exporting a new field:** none. The repository has ruled twice that
purely additive optional fields do not bump a version — `metricSamples`
(*"purely additive and older documents remain valid v1 documents"*) and the whole
`game` block (*"It is OPTIONAL, which is also why no new version number was
invented"*). This field follows that precedent exactly.

---

## 14. Multi-tab scope — LOCKED

**Cross-tab exactly-once is explicitly OUT OF SCOPE, now and for this specification.**
Cross-tab freshness is a separate, already-recorded defect.

The honest contract:

| Question | Answer |
|---|---|
| Can two tabs present the same unread reward? | **Yes.** Both read the same persisted queue and neither is told the other exists. |
| Should acknowledgement in one tab suppress it in another? | Ideally yes; **not guaranteed**. A tab already holding the batch will finish presenting it. |
| Is cross-tab exactly-once required now? | **No.** Later, if and when cross-tab invalidation is built as its own slice. |
| Does `localStorage` create a race even without a storage listener? | **Yes** — both tabs read-modify-write the same key. |

### Making the race benign — LOCKED

The race is unavoidable without cross-tab invalidation, so the design must guarantee
its worst outcome is harmless. Two rules do that:

1. **Acknowledgement is removal-only.** It never adds, never reorders, never rewrites an entry. Removals commute and are idempotent, so two tabs removing overlapping sets converge on the same result in any order. **A stale tab cannot resurrect an acknowledged reward, and cannot lose an unacknowledged one.**
2. **Acknowledgement re-reads current persisted state and writes back only the queue field.** It must never write a whole `GameState` from a snapshot the tab has been holding, or it would clobber XP and trophies earned in the other tab.

With those, the worst multi-tab outcome is **the same reward shown twice**. Never a
duplicate grant (`awardedKeys` already prevents that), never a lost reward, never
corrupted state.

---

## 15. Failure, corruption and crash behaviour — LOCKED

**Crash or reload mid-presentation.** The batch is still in the queue, because
acknowledgement only happens on dwell completion. It is presented again. This is the
designed behaviour, not a fallback.

**Malformed queue data.** `getGameState()` guards only with `isRecord`, so a malformed
`pendingRewardDeliveries` reaches the app layer intact. Rules:

1. A non-array, or an array containing entries missing `id`, `key`, `label` or a finite `xp`, is treated as **empty for presentation**. The user sees nothing rather than something wrong.
2. **The stored bytes are not deleted or rewritten by the read path.** `docs/DECISIONS.md` locks *"Corrupt stored values are quarantined, never deleted, and the condition is surfaced rather than hidden."* Quarantining the entire `ft:v1:game` key over a bad delivery ticket would cost the user their XP and trophies, which is a far worse outcome than showing nothing — so the remedy is scoped: the malformed value survives untouched until the next legitimate write of game state replaces it with a valid array.
3. The condition is reported through the repository's existing issues channel, so it is surfaced rather than hidden. See section 21, OPEN-3 — this scopes a LOCKED decision and should be confirmed by a human.

**A reward granted while Today is already mounted.** Today's existing
`saveIndicator === 'saved'` effect calls `game.refresh()`, `syncGame` re-runs and
enqueues, and the presenter picks the batch up on the next render. **The same code
path as every other case** — there is no special-casing of the live screen, which is
what makes the design testable.

**Storage write failure during acknowledgement.** The write propagates as it does
everywhere else (`localStorageAdapter` deliberately does not swallow
`QuotaExceededError`). The queue entry remains, so the reward is presented again
rather than being silently dropped. Failing towards re-presentation is correct here.

---

## 16. Ownership — LOCKED

| # | Question | Answer |
|---|---|---|
| 1 | Who owns reward derivation? | `deriveRewards`, `src/domain/game/rewards.ts`. Unchanged. |
| 2 | Who owns grant persistence? | `syncGame`, `src/app/game.ts`. Unchanged in principle; extended to enqueue and prune. |
| 3 | Who owns pending delivery state? | The domain type declares it; **`src/app/game.ts` is the only module that writes it**. |
| 4 | Who reads it? | The presenter on Today, through the app-layer read. Nothing else. |
| 5 | Who marks it acknowledged? | The presenter, on dwell completion, through the app-layer removal. |
| 6 | Can arbitrary screens call `syncGame`? | Yes — and after this change that is **safe**, merely wasteful. Reducing it is a separate slice. |
| 7 | Does `useGame` remain reader and grant trigger? | Yes, in slices 1–3. Changing it is the separate freshness slice. |
| 8 | Is a shared provider needed in this slice? | **No**, and section 7 explains why not. |
| 9 | How does this avoid five hooks racing? | It does not avoid the race. It makes the race harmless, which is a stronger property than winning it. |
| 10 | Reward earned while Today is mounted? | Section 15. Same path, no special case. |

### `GameHook.granted` — DIRECTION

`granted` currently feeds three consumers on Today: `RewardAcknowledgement`, the
companion moment identity (`companionMomentKey`), and `todayCompanionContext`'s
`grantedKinds`. **All three have the same defect** — on a cold load the companion never
celebrates a trophy either, for exactly the reason the acknowledgement never appears.

All three must move to the pending batch, and must use the **same** batch so they
cannot disagree. Once they have, `granted` should be removed from the `GameHook`
surface so no future screen can mistake it for a delivery channel again.

**This changes an existing guard.** `src/test/companionMomentLifetime.test.ts:92`
asserts the literal source line `const companionMomentKey = game.granted.map((event)
=> event.id).join('|')`. That assertion must be updated to the new source. It is being
**re-pointed at the new wiring, not weakened** — the property it protects (an opaque
batch identity derived only from event ids, never from reward kinds or XP) is
preserved exactly and must remain asserted.

---

## 17. Presentation contract — LOCKED

Everything in `docs/product/ninfit-reward-presentation-v1.md` still holds and is
unchanged: in the normal flow, never a modal, no forced focus, nothing blocking,
nothing obscured, calm by default, `RewardEvent.label` verbatim, tier mapping owned by
presentation, dwell per §11, legible for the full dwell under reduced motion.

What changes is only **where the events come from**:

```
before:  RewardAcknowledgement({ granted: game.granted })
after:   RewardAcknowledgement({ granted: pendingRewardDeliveries(repository) })
         └─ on dwell completion → acknowledgeRewardDeliveries(repository, batchIds)
```

Additional constraints this document adds:

- **Acknowledgement must never be derived from an animation, transition or frame event.** The dwell timer is a `setTimeout` started on mount and is the only trigger.
- **Reduced motion must not change which rewards are acknowledged, or when.** Correctness is identical with motion collapsed.
- **The presenter may not filter, merge, re-order across batches, or drop entries.** Ordering within a batch stays the existing tier-then-domain-order rule.
- **The presenter may never re-derive reward eligibility.** It renders stored events and removes them. It has no access to `deriveRewards`.
- **A pending count must never be surfaced as a badge, meter, ring or "you have N waiting".** `docs/DECISIONS.md` locks *"No daily completion score, ring, percentage or 'complete your day'"*, and a pending-reward counter is that in another costume.
- **Nothing may expire visibly.** The horizon is silent pruning; it must never be shown as something the user is about to lose. *"broken-streak pressure, or anything the user could feel they are about to lose"* is a hard no.

---

## 18. Test plan — DIRECTION

Every item the brief requires. **No new dependency is proposed**; section 18.3
explains what that costs and why the cost is acceptable.

### 18.1 In-repo, pure, no new dependency

| # | Test | Layer |
|---|---|---|
| 1 | Cold load with pending reward-worthy truth: sync enqueues rather than dropping | app |
| 2 | App-before-Today: two sequential syncs; the first enqueues, the second adds nothing, the queue still holds the batch | app |
| 3 | Profile-earned first measurement: writing a measurement then syncing enqueues `first_measurement` | app |
| 4 | Today activity completion: the normal path enqueues the same batch it grants | app |
| 7 | Acknowledging a batch removes exactly those ids and a later sync does not re-add them | app |
| 8 | Two pending rewards preserve derivation order, oldest first | domain |
| 9 | Duplicate sync does not duplicate queue entries (dedup by `key`) | app |
| 10 | A save with no `pendingRewardDeliveries` field reads as an empty queue and is not treated differently from `[]` | app |
| 11 | Import of a pre-game-layer backup leaves the queue empty | io |
| 12 | Import of a same-version backup carrying a non-empty queue clears it | io |
| 13 | Cap: entries beyond `MAX_PENDING_REWARD_DELIVERIES` retire oldest-first | domain |
| 14 | Malformed queue data presents as empty, does not throw, and does not destroy XP or trophies | app |
| 17 | The queue is appended from derivation order, unaffected by the `recentEvents` reversal | domain |
| 18 | No reward is presented from imported historical truth | io |
| — | Horizon: `partitionPendingDeliveries` retires entries past the horizon and keeps the rest | domain |
| — | Round trip: export carries the queue; import clears it | io |

### 18.2 Policy extracted so the timing rule is testable without a renderer

Items **5** (navigate away during dwell), **6** (reload during pending
acknowledgement) and **15** (reduced motion) depend on `useEffect`, timers and
unmount. **No test in this repository renders a component**, and `react-dom/server` —
which the discovery used successfully for render-phase proofs — does not run effects.

Rather than adopt a renderer, follow the pattern PR #58 already established for
exactly this problem: **make the policy pure and keep the timer thin.**

- A pure function answers *"given a batch and elapsed dwell, is it acknowledged?"* and is unit-tested directly, including the reduced-motion case (which is simply "the answer does not depend on motion").
- The remaining untested surface is a `setTimeout` and one call — small enough to be held by source-boundary guards (`the acknowledgement call happens in the dwell timeout, not on mount, not in a transition handler`) plus browser verification per `skills/ninfit-ui-verification/SKILL.md`.

This is a deliberate trade, not an oversight: the alternative is a new dependency that
`docs/CURRENT_STATE.md` explicitly says must not be added until discovery proves what
must be exercised. Discovery has now proved that the *policy* is what must be
exercised, and the policy can be pure.

### 18.3 Browser verification, not automated

| # | Scenario | How |
|---|---|---|
| 5 | Navigate away during dwell, return: acknowledgement is shown again | Browser, per `ninfit-ui-verification` |
| 6 | Reload during pending acknowledgement: shown after reload | Browser |
| 15 | Reduced motion: identical acknowledgement behaviour, full dwell | Browser, motion on and off |
| 16 | Today not mounted when the grant happens: shown on first visit | Browser |
| 19 | Multi-tab: the same reward may appear in both tabs; neither is lost; neither is double-granted | Browser, two tabs |

A one-off Playwright harness **outside the repository** is sufficient for all five and
was already proven viable during discovery. Such harnesses are not committed.

### 18.4 Guards

- No source under `src/domain` or `src/app` may import the presenter.
- The presenter may not import `deriveRewards`, `grantRewards` or `syncGame`.
- Acknowledgement must not appear in a transition, animation or `requestAnimationFrame` handler.
- No pending count is rendered anywhere.

---

## 19. Implementation phasing — DIRECTION

| Slice | Branch prefix | Content | Boundary |
|---|---|---|---|
| **1** | `phase8-2/` | The queue: type, constants, enqueue in `grantRewards`, prune and read in `syncGame`, pure `partitionPendingDeliveries`, defensive normalisation, import clearing. Pure and app tests. | `src/domain/game/**`, `src/app/game.ts`, `src/io/importJson.ts`, `src/test/**` |
| **2** | `phase8-2/` | Wiring: `RewardAcknowledgement` reads the queue and acknowledges on dwell completion; Today's companion moment and `grantedKinds` read the **same** batch; `granted` removed from `GameHook`. | `src/ui/**`, `src/test/**` |
| **3** | `test/` | Guard tests and browser verification of slices 1–2. | `src/test/**` |

**Slice 1 is shippable alone but must not be described as a fix.** It writes state that
nothing reads yet; the defect is closed only when slice 2 lands. They should be two
commits, reviewed together.

Deliberately **not** bundled, each its own later slice, none a prerequisite:

- the `granted.reverse()` grant-order fix (section 12 makes slice 1 immune to it)
- App-level path/accent freshness after a Profile path switch
- reducing five `useGame()` instances to one shared provider
- any cross-tab synchronisation
- any test-framework or renderer change
- any visual change to the acknowledgement

---

## 20. Acceptance criteria — LOCKED

1. A reward granted while Today is not mounted is presented on the next Today visit within the horizon.
2. A reward granted on a cold load, before Today renders, is presented on that same load.
3. Leaving Today during the dwell leaves the reward pending; it is presented again on return.
4. A reload during the dwell leaves the reward pending; it is presented after the reload.
5. A batch whose dwell completes is never presented again on that device.
6. No reward is ever presented twice after a completed dwell, and no granted reward is silently dropped.
7. No reward is granted more than once — `awardedKeys` idempotency is unchanged and still asserted.
8. Import never presents a restored reward as newly earned, on any import path.
9. Absent and empty `pendingRewardDeliveries` behave identically.
10. Malformed queue data presents nothing, throws nothing, destroys no XP or trophy, and is surfaced.
11. Delivery order is derivation order, oldest first, and is unaffected by the `recentEvents` reversal.
12. Reduced motion changes neither which rewards are acknowledged nor when.
13. Acknowledgement is triggered only by the dwell timer — never by a transition, animation or visibility event.
14. Nothing modal, nothing blocking, no forced focus, no pending count, no expiry shown to the user.
15. Today's companion moment and the acknowledgement consume the same batch and cannot disagree.
16. No new dependency in `package.json`; `SCHEMA_VERSION` and `GAME_SCHEMA_VERSION` unchanged.
17. Full suite green with additions only. No existing assertion weakened; the one re-pointed guard (section 16) still asserts the same property.
18. Typecheck, build and `git diff --check` clean.

---

## 21. Open questions — needing a human answer

**OPEN-1 — the freshness horizon value.** 7 days is proposed as one programme week.
`RETURNING_AFTER_DAYS` is 4, which is the companion's threshold for greeting a return,
and there is an argument for aligning them. There is also an argument for no horizon
at all, on the grounds that the user earned it and should always be told. The
horizon's existence is LOCKED (section 8); **the number is not.**

**OPEN-2 — should a retired reward be acknowledged silently, or noted somewhere?**
Currently: silently, with the XP and trophy already visible in Passport and Profile.
The alternative — a quiet "while you were away" summary — is a real product feature
with real tone risk (`"Never summarise absence as a failure count"`) and is deliberately
not proposed here.

**OPEN-3 — corruption remedy scope.** Section 15 scopes the LOCKED
quarantine-never-delete rule so that a malformed delivery ticket does not cost the user
their XP. That is an interpretation of a locked decision and should be confirmed rather
than assumed.

**OPEN-4 — does this need a `docs/DECISIONS.md` entry, and when?** The acknowledgement
semantic in section 6 is a durable product decision and will likely deserve one. Per
the brief this slice does not edit `DECISIONS.md`, and per the delivery loop a decision
is recorded once it is settled and implemented. **Recommendation: add the entry with
slice 2, not before.** Flagged rather than actioned.

---

## 22. Security and privacy

No new category of data is stored. A `RewardEvent` carries `id`, `key`, `kind`, `xp`,
`skillXp`, `label`, an optional programme `date` and `awardedAt` — the same shape
already persisted in `recentEvents` today, in the same storage key, on the same
device.

- **No health data enters the queue.** A reward key names a programme fact (`activity:2026-08-13:{id}`), never a measurement, symptom, weight or note.
- **Local-first is unchanged.** No account, no network, no server-side dedup. Delivery state never leaves the device except inside a backup the user explicitly exports.
- **Nothing is shared.** Trophy visibility rules are untouched; the queue is not a sharing surface and must not become one.
- **The queue is bounded**, so it cannot grow into an unbounded log of user behaviour in local storage.

---

## 23. Rollback and compatibility

- **Rollback of slice 2** returns the presenter to `game.granted`. The queue keeps filling and draining nothing; no data is corrupted, and the pre-existing defect simply returns.
- **Rollback of slice 1** leaves `pendingRewardDeliveries` in saves written while it was live. Because the field is optional and unread by the old code, an older build ignores it entirely — one of the reasons an additive optional field was chosen over a new key or a version bump.
- **Forward compatibility.** A backup written by a build with the field imports cleanly into a build without it: `game.state` is validated as `isRecord` and restored verbatim, and the extra field is inert.
- **No migration is required in either direction.** No data is rewritten, moved or renamed.

---

## 24. Files likely touched by implementation — DIRECTION

**Slice 1**

```
src/domain/game/types.ts        the field, the constants
src/domain/game/rewards.ts      enqueue in grantRewards; partitionPendingDeliveries
src/domain/game/defaults.ts     default for new state
src/app/game.ts                 prune in syncGame; read and acknowledge operations
src/io/importJson.ts            clear the queue in resolveGameState
src/test/**                     new tests
```

**Slice 2**

```
src/ui/components/RewardAcknowledgement.tsx   source of events; acknowledge on dwell completion
src/ui/screens/TodayScreen.tsx                pass the pending batch; companion reads the same batch
src/ui/hooks/useGame.ts                       remove `granted` from the hook surface
src/test/companionMomentLifetime.test.ts      re-point the wiring guard (section 16)
src/test/**                                   new tests
```

## 25. Files explicitly forbidden — LOCKED

```
src/domain/dailyLog.ts  src/domain/weeklyPlan.ts  src/domain/measurement.ts
src/domain/today.ts     src/domain/journey*.ts                    fitness and Journey truth
src/domain/game/xp.ts   src/domain/game/trophies.ts
src/domain/game/consistency.ts                                    reward values and rules
src/domain/schema.ts    src/storage/repository.ts                 no version bump, no new key
src/io/exportJson.ts                                              export already carries it
package.json  package-lock.json                                   no new dependency
docs/ROADMAP.md  docs/DECISIONS.md                                see OPEN-4
.gitattributes
```

If implementation finds that any of these genuinely must change, **stop and report**
rather than widening the boundary.

---

## 26. Deferred issues

Recorded so they survive a change of thread. None is authorised by this document.

| Issue | Detail |
|---|---|
| **`granted.reverse()` grant order** | `rewards.ts:334` mutates the returned array in place, so `GrantResult.granted` is delivered in reverse derivation order. Visible today: `first_programme_day`, which the domain deliberately `unshift`s to the front, renders last. Its own slice. Section 12 makes this specification immune to it either way. |
| **App path/accent freshness** | After a Profile path switch, `data-path` on `.app` stays stale for the whole session and resolves only on reload. Proven in a browser. Its own slice. |
| **Five `useGame()` instances** | Now a performance and freshness question rather than a correctness one: 2–3 `deriveRewards` passes per render pass, 3 on Profile. Its own slice. |
| **Cross-tab invalidation** | No `storage` listener or `BroadcastChannel` exists. Section 14 states the contract; building it is out of scope. |
| **`recentEvents` still unread** | Unchanged by this work, and deliberately so. It remains history with no reader. |
| **`docs/CURRENT_STATE.md` says four `useGame` sites** | There are five. One-line docs correction. |
| **Corrupt whole-`GameState` behaviour** | If the entire `ft:v1:game` value is unreadable it is quarantined and a fresh state is created, whose empty `awardedKeys` would let the next sync re-grant everything. Pre-existing, not introduced here, and not addressed by this document. |
| **Level-up has no `RewardKind`** | Unchanged. A level-up cannot be delivered because it is not a discrete event. |

---

## 27. Stop point

```
READY FOR HUMAN SPEC REVIEW
```
