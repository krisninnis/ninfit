/**
 * Emit the premium egg production set from the canonical master.
 *
 *   node scripts/build-egg-art.ts
 *
 * Deliberately OUTSIDE `src`, so `tsconfig.json` (which includes `src` and
 * `vite.config.ts`) never compiles it and Vite never bundles it. Node 22.18+/24 strip
 * the annotations natively, which is why the import below carries an explicit `.ts`
 * extension - that is the runtime's rule, not the bundler's.
 *
 * The script is a convenience, not the contract. `src/test/eggProductionArt.test.ts`
 * regenerates the same strings in memory and compares them to what is committed, so a
 * hand-edited SVG fails the suite whether or not anybody remembers to run this.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import {
  EGG_STAGES,
  EGG_STAGE_INTENT,
  eggStageSvg,
} from '../src/art/egg/eggMaster.ts';

const OUT = 'public/egg';
const REVIEW = 'docs/brand/reference/egg';

mkdirSync(OUT, { recursive: true });
mkdirSync(REVIEW, { recursive: true });

for (const stage of EGG_STAGES) {
  const file = `${OUT}/egg-stage-${stage}-v1.svg`;
  writeFileSync(file, eggStageSvg(stage), 'utf8');
  console.log(`wrote ${file}`);
}

/**
 * The review sheet.
 *
 * Not a deliverable the application loads - it is the thing a human looks at to
 * decide whether the six stages are one object. It shows the set on the light and
 * dark page surfaces, at the size the ceremony actually uses and at the size the
 * onboarding header actually uses, because a crack that reads at 420px and vanishes
 * at 68px has not been reviewed until both have been seen.
 */
const cells = EGG_STAGES.map(
  (stage) => `        <figure class="cell">
          <img src="../../../../public/egg/egg-stage-${stage}-v1.svg" alt="" />
          <figcaption>${stage} &middot; ${EGG_STAGE_INTENT[stage]}</figcaption>
        </figure>`,
).join('\n');

const strip = EGG_STAGES.map(
  (stage) => `        <img class="small" src="../../../../public/egg/egg-stage-${stage}-v1.svg" alt="" />`,
).join('\n');

/**
 * The ceremony size on the narrowest supported viewport.
 *
 * `egg.css` sizes the running hatch at `min(56vmin, 420px)`, which on a 360px-wide
 * phone is 201px - not the 420px a desktop reviewer would otherwise be judging.
 */
const ceremony = EGG_STAGES.map(
  (stage) => `        <img class="ceremony" src="../../../../public/egg/egg-stage-${stage}-v1.svg" alt="" />`,
).join('\n');

const sheet = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>NinFit premium egg - stage contact sheet v1</title>
<style>
  :root { color-scheme: light; font-family: ui-sans-serif, system-ui, sans-serif; }
  body { margin: 0; }
  section { padding: 28px 32px 34px; }
  .light { background: #FAF7F2; color: #2B2B28; }
  .dark { background: #171716; color: #EDE9E1; }
  h2 { margin: 0 0 4px; font-size: 15px; font-weight: 600; letter-spacing: 0.01em; }
  p.note { margin: 0 0 20px; font-size: 12px; opacity: 0.62; }
  .row { display: flex; gap: 18px; align-items: flex-end; }
  .cell { margin: 0; flex: 1; text-align: center; }
  .cell img { width: 100%; max-width: 168px; height: auto; display: block; margin: 0 auto; }
  figcaption { margin-top: 10px; font-size: 11px; letter-spacing: 0.04em; opacity: 0.72; }
  .strip { display: flex; gap: 14px; align-items: flex-end; }
  .small { width: 68px; height: 85px; }
  .ceremony { width: 201px; height: 251px; }
</style>
</head>
<body>
  <section class="light">
    <h2>Premium egg progression &mdash; light surface</h2>
    <p class="note">One master, six derived stages. Same silhouette, camera, scale and lighting throughout.</p>
    <div class="row">
${cells}
    </div>
  </section>
  <section class="dark">
    <h2>Premium egg progression &mdash; dark surface</h2>
    <p class="note">Identical files. Nothing in the artwork is theme-conditional.</p>
    <div class="row">
${cells}
    </div>
  </section>
  <section class="dark">
    <h2>Ceremony size on a 360px viewport (201 &times; 251)</h2>
    <p class="note">min(56vmin, 420px) from egg.css, resolved for the narrowest supported width.</p>
    <div class="strip">
${ceremony}
    </div>
  </section>
  <section class="light">
    <h2>Legibility at the onboarding header size (68 &times; 85)</h2>
    <p class="note">The size the egg is actually shown at beside the questionnaire progress.</p>
    <div class="strip">
${strip}
    </div>
  </section>
</body>
</html>
`;

const sheetFile = `${REVIEW}/egg-stage-contact-sheet-v1.html`;
writeFileSync(sheetFile, sheet, 'utf8');
console.log(`wrote ${sheetFile}`);
