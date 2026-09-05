# Journey Home central stack v1

Base: `cca5493cdf5b1541b2141d70a58ec12bb05046f7`

This is a private-beta visual refinement requested from real Android acceptance.

## Intent

Journey Home should feel like a primary destination rather than a small dashboard. The three launch families are therefore presented as one centred vertical path:

1. Walk / Run
2. Cycle
3. Swim

The activity-family architecture is unchanged. Walk and Run remain distinct recorded activity types behind their shared family door. Cycle and Swim retain their existing launch behaviour. No fitness truth, Journey persistence, reward state, GPS behaviour, or mascot identity is changed.

## Presentation contract

- Journey heading/invitation is centred.
- Launch choices are one vertical column at every supported width.
- The column is centred and capped at 34rem so it does not become an over-wide desktop list.
- Each activity remains a large touch target with its existing art, label and explanatory note.
- Existing hover/press treatment remains intact.
- Adventure Map, recent history, privacy note and active-Journey continuation are unchanged.

## Human gate

Do not merge on CI alone. Check a real-phone Vercel preview in both light and dark themes at minimum, confirming the three launch choices read clearly, remain easy to tap, do not overflow, and the rest of Journey Home has not regressed.
