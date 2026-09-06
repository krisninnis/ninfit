# NinFit — first real walk acceptance card

**Build:** `review/gps-walk-milestone-v1`
**Use it outdoors, on the phone, one hand.** Roughly 15 minutes. Around the block is enough.

Everything below is a *check*, not a task. If something is wrong, screenshot it and keep walking — the walk is more useful finished than abandoned.

---

## BEFORE YOU LEAVE

1. Open the deployed NinFit URL in the phone browser. **It must be `https://`.** Location does not work on a plain `http://` address or an IP.
2. Go to **Journey** (bottom nav).
3. Tap the **Walk / Run** tile.
4. On the companion screen, choose **Walk**, then **Start Walk**.
5. Allow location when the phone asks. Choose **"While using the app"** / **"Allow"** — not "Only this time" if you are offered a choice, and not "Precise location: off".

**You should now see:** the live Journey screen. Title *Walk*. A chip top-right reading **GPS connecting**, then **GPS live** within a few seconds outdoors. A big `0.00 km`. **Pause** and **Finish** at the bottom.

- If it says **Location permission needed**: tap Pause, then Resume, and allow location.
- If it stays **GPS connecting** for more than about a minute outdoors: screenshot it and note whether the phone's own maps app can find you.
- **Do not** start a second Walk. Journey Home will show *Continue Journey* instead of the tiles — that is correct.

---

## DURING THE WALK

**Keep the screen on and NinFit in front.** The app asks the phone to stay awake; if the screen locks anyway, the walk still records but the map will show an honest gap where nothing was watched.

Watch for:

- **Distance climbs** as you walk. It may sit at `0.00` for the first 20–30 m — that is the recorder refusing a poor first fix, not a fault.
- **Active time** counts up every second.
- The chip stays **GPS live**. Dropping to **GPS searching** near buildings is normal; it should come back.
- **No sudden jump** — a walk around the block should not gain 200 m in one step.
- **Pause** and **Finish** stay visible at the bottom without scrolling.

Do **not** switch apps, lock the phone, or reload — unless you are deliberately testing recovery, in which case do **one** of them, once, and note where you were.

---

## FINISH

Tap **Finish** — the green button, bottom right. Only that button ends the walk.

**You should land on a result screen:**

```
Walk complete
Sunday 6 September · 14:02–14:19

ROUTE
[ map of the shape you walked ]
Private on this device

DISTANCE 1.24 km    ACTIVE TIME 16:32
AVERAGE PACE 13:20 per km

PERSONAL RESULT
First recorded effort

COMMUNITY RESULT
No community route yet
```

---

## AFTER THE WALK — the six things to check

| # | Check | What right looks like |
|---|---|---|
| 1 | **Route shape** | The line follows roughly where you walked. Corners in the right places. A break where GPS dropped is correct — an invented straight line across ground you did not walk is not. |
| 2 | **Distance** | Within roughly 10% of what you'd guess. `—` and *No distance recorded* is honest, not broken — but tell me if you see it. |
| 3 | **Duration** | Matches the walk. *Active time* excludes any pause. |
| 4 | **Pace** | Plausible. A comfortable walk is roughly 11:00–15:00 per km. Under 100 m it correctly shows `—`. |
| 5 | **Personal result** | *First recorded effort* on the first walk. On a second, similar walk it becomes a rank — "2nd fastest of 2 comparable Walks". It must never call a first walk a personal best. |
| 6 | **Community result** | *No community route yet*. This is correct and expected. Anything claiming a rank against other people is a bug — there are no other people yet. |

Then:

7. **Tap View Journey.** The saved record shows the same route, same distance, same time.
8. **Go to Journey.** The walk appears once under *Recent Journeys* — **once**, not twice.
9. **Close the browser tab completely, reopen the URL, go to Journey.** The walk is still there, with the same numbers and the same route.

---

## OPTIONAL — only if the walk went well

**Recovery test.** Mid-walk, reload the page once. It should come straight back to the live Walk screen, still recording, with the distance you already had. Nothing should be lost and no second walk should appear.

**Second walk.** A similar-length walk on another day is what turns *First recorded effort* into a real comparison. It has to be within about 20% of the same distance to be ranked against the first.

---

## SCREENSHOT IF YOU SEE ANY OF THIS

- The route map is blank, or draws a line through somewhere you did not go.
- Distance is wildly wrong, or jumps.
- Two entries in Recent Journeys for one walk.
- Anything claiming a personal best on your first walk.
- Any ranking against other people.
- Anything cut off at the edge of the screen, or a **Finish** button you have to scroll to reach.
- Any error message, or a screen that goes blank.
- The result screen showing different numbers after you reopen it.

Note the **time** and roughly **where you were** for anything GPS-related — it makes the recorded points readable afterwards.

---

## KNOWN AND EXPECTED — not bugs

- The map background may be slow, or briefly show an *imagery unavailable* note on a weak connection. The route line and all the numbers are independent of it.
- No reward, XP, badge or trophy for finishing. Journeys do not grant anything yet.
- Nothing is shared anywhere. Every Journey is private to this phone.
- No watch or Fitbit data. Nothing is connected — Settings → Connected devices says so.
