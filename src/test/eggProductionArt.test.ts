import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  EGG_CANVAS,
  EGG_FRACTURE_LAYER_COUNT,
  EGG_MASTER_BLOCK,
  EGG_SHELL_PATH,
  EGG_STAGES,
  EGG_STAGE_INTENT,
  EGG_VIEW_BOX,
  eggFractureBlock,
  eggMasterSvg,
  eggStageAssetPath,
  eggStageSvg,
} from '../art/egg/eggMaster';
import { MAX_CRACK_STAGE } from '../domain/game/egg';
import {
  EGG_STAGE_ART,
  eggStageArt,
  hasCompleteEggStageArt,
} from '../ui/eggStageArt';

/**
 * PREMIUM EGG PRODUCTION ART - THE GUARD (#134).
 *
 * This suite exists because the thing that keeps going wrong with this asset is not
 * that somebody draws a bad egg. It is that the six stages stop being the same egg -
 * a silhouette moves two pixels, a light source swings round, a "fix" to stage 4
 * never reaches stage 2 - and the set silently becomes six pictures of six objects
 * again. Every test below is aimed at that failure, not at whether the artwork is
 * beautiful. Beauty is the human gate; these are the things a human reviewer cannot
 * reliably see and should not have to.
 *
 * The second thing it guards is the species. Issue #134's privacy clause is absolute:
 * nothing before the hatch may disclose which animal is inside, through markup, an
 * identifier, a filename or a shape. A generated file is exactly where that leaks,
 * because nobody reads generated files.
 *
 * NOT tested here, and deliberately: that the egg looks premium, that the cracks feel
 * cumulative to a person, that stage 5 reads as about to open. A green run is not
 * visual approval - see `skills/ninfit-visual-asset-pipeline`.
 */

const ASSET_DIR = join('public', 'egg');
const REVIEW_DIR = join('docs', 'brand', 'reference', 'egg');

const stageFile = (stage: number) => join(ASSET_DIR, `egg-stage-${stage}-v1.svg`);
const stageText = (stage: number) => readFileSync(stageFile(stage), 'utf8');

const occurrences = (haystack: string, needle: string) =>
  haystack.split(needle).length - 1;

describe('the premium egg production set', () => {
  it('ships exactly the six stages the domain can ask for, and nothing else', () => {
    expect(EGG_STAGES).toEqual([0, 1, 2, 3, 4, 5]);
    // The art layer's stage vocabulary IS the domain's crack-stage range. If
    // MAX_CRACK_STAGE ever moves, this fails rather than quietly shipping a set that
    // cannot answer the top stage.
    expect(EGG_STAGES[EGG_STAGES.length - 1]).toBe(MAX_CRACK_STAGE);
    expect(EGG_STAGE_INTENT).toHaveLength(EGG_STAGES.length);
    expect(EGG_FRACTURE_LAYER_COUNT).toBe(MAX_CRACK_STAGE);

    const files = readdirSync(ASSET_DIR, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort();

    expect(files).toEqual([
      'egg-stage-0-v1.svg',
      'egg-stage-1-v1.svg',
      'egg-stage-2-v1.svg',
      'egg-stage-3-v1.svg',
      'egg-stage-4-v1.svg',
      'egg-stage-5-v1.svg',
    ]);
  });

  it('is exactly what the canonical master generates, byte for byte', () => {
    /*
     * THE LOAD-BEARING TEST.
     *
     * Everything else in this file describes a property the artwork must have. This
     * one makes the committed files and the master the same object: a hand-edited
     * SVG, a half-applied change, or a stage regenerated from a modified master
     * while its five siblings were not, all fail here. It is also what makes
     * `scripts/build-egg-art.ts` a convenience rather than a step somebody has to
     * remember to run.
     */
    for (const stage of EGG_STAGES) {
      expect(stageText(stage), `stage ${stage} has drifted from the master`).toBe(
        eggStageSvg(stage),
      );
    }
  });

  it('is deterministic - same input, same bytes, every time and everywhere', () => {
    for (const stage of EGG_STAGES) {
      expect(eggStageSvg(stage)).toBe(eggStageSvg(stage));
    }

    // And structurally so: nothing in the master may consult a clock, a random
    // source or the environment, which is what would make the guard above flaky
    // rather than meaningful.
    const source = readFileSync(join('src', 'art', 'egg', 'eggMaster.ts'), 'utf8');
    expect(source).not.toMatch(/Math\.random|Date\.now|new Date|process\.env|crypto\./);
  });

  it('clamps out-of-range stages the same way EggArt does', () => {
    // A malformed caller must never be able to produce a partial or unknown state.
    expect(eggStageSvg(-3)).toBe(eggStageSvg(0));
    expect(eggStageSvg(99)).toBe(eggStageSvg(5));
    expect(eggStageSvg(Number.NaN)).toBe(eggStageSvg(0));
    expect(eggStageSvg(3.9)).toBe(eggStageSvg(3));
    expect(eggMasterSvg()).toBe(eggStageSvg(0));
  });
});

describe('one master, six derived stages', () => {
  it('emits the identical master block in every stage', () => {
    // Not "a similar egg" and not "the same to the eye": the same string. Shell,
    // pearl depth, iridescence, gold inlay and the warm inner light are one block,
    // and a stage either contains it unmodified or fails.
    for (const stage of EGG_STAGES) {
      expect(stageText(stage), `stage ${stage} does not carry the master`).toContain(
        EGG_MASTER_BLOCK,
      );
    }
  });

  it('never redraws the silhouette, and never lets a stage draw outside it', () => {
    const counts = EGG_STAGES.map((stage) => occurrences(stageText(stage), EGG_SHELL_PATH));

    // Identical in all six: the clip path, the filled shell and its edge line. A
    // seventh occurrence would be a stage quietly restating the outline.
    expect(new Set(counts).size, `shell path counts differ: ${counts.join(',')}`).toBe(1);
    expect(counts[0]).toBeGreaterThanOrEqual(3);

    for (const stage of EGG_STAGES) {
      // The structural half of the same promise: fractures are clipped to the shell,
      // so a wrong coordinate produces a wrong crack, never a different silhouette.
      expect(stageText(stage)).toContain(
        '<g data-egg-layer="fracture" clip-path="url(#eggShell)"',
      );
    }
  });

  it('keeps the same camera, scale and canvas across the set', () => {
    for (const stage of EGG_STAGES) {
      const svg = stageText(stage);
      expect(svg).toContain(`viewBox="${EGG_VIEW_BOX}"`);
      expect(svg).toContain(`width="${EGG_CANVAS.width}" height="${EGG_CANVAS.height}"`);
      expect(svg).toContain('preserveAspectRatio="xMidYMid meet"');
      // No stage may transform the whole drawing into a different framing.
      expect(svg).not.toMatch(/<svg[^>]*transform=/);
    }
  });

  it('shares EggArt’s viewBox exactly, so the eventual swap shifts no layout', () => {
    const eggArt = readFileSync(
      join('src', 'ui', 'components', 'EggArt.tsx'),
      'utf8',
    );
    expect(eggArt).toContain(`viewBox="${EGG_VIEW_BOX}"`);
  });

  it('carries the same lighting in every stage', () => {
    // The gradients ARE the lighting. They live in the shared defs, so "same light
    // at every stage" is the same fact as "same master block" - stated separately
    // because it is the property a reviewer would otherwise have to eyeball.
    for (const stage of EGG_STAGES) {
      const svg = stageText(stage);
      for (const id of ['eggPearl', 'eggSheenCool', 'eggSheenWarm', 'eggInner']) {
        expect(svg, `stage ${stage} is missing ${id}`).toContain(`id="${id}"`);
      }
    }
  });
});

describe('crack stages are cumulative', () => {
  it('adds fracture layers and never removes or redraws one', () => {
    for (const stage of EGG_STAGES) {
      const svg = stageText(stage);
      for (let layer = 1; layer <= MAX_CRACK_STAGE; layer += 1) {
        const marker = `<g data-egg-fracture="${layer}">`;
        if (layer <= stage) {
          expect(svg, `stage ${stage} is missing layer ${layer}`).toContain(marker);
        } else {
          expect(svg, `stage ${stage} shows a future layer ${layer}`).not.toContain(marker);
        }
      }
    }
  });

  it('contains the previous stage’s fractures verbatim, not a redrawing of them', () => {
    /*
     * The difference between "cumulative" and "six pictures in which the cracks
     * happen to grow". Stage n's fracture content must START with stage n-1's,
     * character for character - so a crack that exists at stage 2 is the same crack,
     * in the same place, at stage 5.
     */
    for (let stage = 1; stage <= MAX_CRACK_STAGE; stage += 1) {
      const previous = eggFractureBlock(stage - 1);
      const current = eggFractureBlock(stage);

      if (stage === 1) {
        // Stage 0's block is the empty self-closing group; there is nothing to
        // contain, so the meaningful assertion is that stage 1 introduces exactly
        // one layer.
        expect(previous).toContain('<g data-egg-layer="fracture" clip-path="url(#eggShell)" />');
      } else {
        const inherited = previous
          .replace('  <g data-egg-layer="fracture" clip-path="url(#eggShell)">\n', '')
          .replace('\n  </g>', '');
        expect(current, `stage ${stage} redrew stage ${stage - 1}`).toContain(inherited);
      }

      expect(current.length).toBeGreaterThan(previous.length);
    }
  });

  it('leaves stage 0 pristine - no fracture, no bloom', () => {
    const svg = stageText(0);
    expect(svg).toContain('<g data-egg-layer="fracture" clip-path="url(#eggShell)" />');
    expect(svg).toContain('data-egg-layer="bloom" opacity="0"');
    expect(svg).not.toContain('data-egg-fracture');
  });

  it('never dims the escaping light as the shell breaks further', () => {
    // Monotonic, like the domain's crack stage. A stage that got calmer as it
    // cracked would be telling the user the opposite of what is happening.
    const bloom = EGG_STAGES.map((stage) => {
      const match = /data-egg-layer="bloom" opacity="([\d.]+)"/.exec(stageText(stage));
      expect(match, `stage ${stage} has no bloom layer`).not.toBeNull();
      return Number(match?.[1]);
    });

    for (let index = 1; index < bloom.length; index += 1) {
      expect(bloom[index]).toBeGreaterThan(bloom[index - 1] ?? -1);
    }
  });
});

describe('nothing about the species can escape before the hatch', () => {
  /*
   * The five path families, plus the universal guide. None of these words, and no
   * anatomy vocabulary, may appear anywhere in a pre-hatch asset - not in markup, not
   * in an id, not in a filename, not in a comment. The egg is the same object for
   * everybody until it opens, and this is the test that keeps it that way when
   * somebody later adds "just one more" stage.
   */
  const FORBIDDEN = [
    'tortoise', 'bear', 'fox', 'otter', 'wolf', 'opal',
    'mascot', 'companion', 'species', 'family', 'starter',
    'beak', 'paw', 'claw', 'fur', 'feather', 'scale', 'snout', 'tail', 'whisker',
    'eye', 'ear', 'nose', 'creature', 'animal', 'silhouette',
  ];

  it('contains no species or anatomy vocabulary in any stage', () => {
    // Whole words only. `linearGradient` contains "ear" and that is not a leak; a
    // substring match here would either fail on honest markup or force the artwork
    // to avoid ordinary SVG vocabulary, and a guard nobody can satisfy gets deleted.
    for (const stage of EGG_STAGES) {
      const svg = stageText(stage).toLowerCase();
      for (const word of FORBIDDEN) {
        expect(
          new RegExp(`\\b${word}s?\\b`).test(svg),
          `stage ${stage} contains "${word}"`,
        ).toBe(false);
      }
    }
  });

  it('keeps the species out of the asset URL as well as the markup', () => {
    for (const stage of EGG_STAGES) {
      const path = eggStageAssetPath(stage);
      expect(path).toBe(`/egg/egg-stage-${stage}-v1.svg`);
      // The one leak vector that survives every DOM precaution: a request for
      // /mascots/<family>/... discloses the answer before the reveal does.
      expect(path).not.toContain('/mascots/');
      for (const word of FORBIDDEN) {
        expect(new RegExp(`\\b${word}s?\\b`).test(path.toLowerCase())).toBe(false);
      }
    }
  });

  it('carries no readable text, title, description or metadata', () => {
    // Any of these is a place a species name can end up, and the last three are
    // exactly what an export tool adds without being asked.
    for (const stage of EGG_STAGES) {
      const svg = stageText(stage);
      expect(svg).not.toMatch(/<text[\s>]/i);
      expect(svg).not.toMatch(/<title[\s>]/i);
      expect(svg).not.toMatch(/<desc[\s>]/i);
      expect(svg).not.toMatch(/<metadata[\s>]/i);
      expect(svg).not.toMatch(/aria-label=/i);
      expect(svg).toContain('aria-hidden="true"');
      expect(svg).toContain('role="presentation"');
    }
  });

  it('references nothing outside itself and executes nothing', () => {
    for (const stage of EGG_STAGES) {
      const svg = stageText(stage);
      // An external reference is a second request, and a second request is a second
      // chance to disclose something. A script in a decorative asset is simply not
      // something this project ships.
      expect(svg).not.toMatch(/<image[\s>]/i);
      expect(svg).not.toMatch(/<script/i);
      expect(svg).not.toMatch(/xlink:href|href=|url\(http|@import|<use[\s>]/i);
      expect(svg).not.toMatch(/on[a-z]+=/i);
    }
  });

  it('varies by nothing about the user', () => {
    const source = readFileSync(join('src', 'art', 'egg', 'eggMaster.ts'), 'utf8');
    // The signature is number in, string out. No path, no family, no profile - so
    // there is no input from which a species could be derived even by accident.
    expect(source).not.toMatch(/\bpathId\b|\bdata-path\b|MascotFamily|familyId/);
    expect(eggStageSvg(2)).toBe(eggStageSvg(2));
  });
});

describe('the set is safe to load on a phone', () => {
  it('stays inside the per-stage and whole-set payload budgets', () => {
    /*
     * 90 KB per stage and 450 KB for the set - tighter than the 250 KB background
     * allowance on purpose, because all six stages load during ONE questionnaire on
     * mobile data, whereas only one background is on screen at a time.
     */
    let total = 0;
    for (const stage of EGG_STAGES) {
      const bytes = statSync(stageFile(stage)).size;
      expect(bytes, `stage ${stage} is empty`).toBeGreaterThan(1024);
      expect(bytes, `stage ${stage} is over budget`).toBeLessThanOrEqual(90 * 1024);
      total += bytes;
    }
    expect(total).toBeLessThanOrEqual(450 * 1024);
  });

  it('is transparent rather than sitting on a baked background', () => {
    // A filled canvas would paste the light theme's page colour into the dark theme.
    for (const stage of EGG_STAGES) {
      const svg = stageText(stage);
      expect(svg).not.toMatch(/<rect[^>]*width="100%"/i);
      expect(svg).not.toMatch(/<svg[^>]*style="[^"]*background/i);
    }
  });

  it('animates nothing, so reduced motion has nothing to switch off', () => {
    // The stages are stills. Motion belongs to the ceremony in egg.css, which
    // already answers `prefers-reduced-motion`; an asset that animated itself would
    // be a second opinion about that and could not be reduced.
    for (const stage of EGG_STAGES) {
      const svg = stageText(stage);
      expect(svg).not.toMatch(/<animate|<set[\s>]|animation:|@keyframes/i);
    }
  });
});

describe('the assets reach the runtime through one boundary', () => {
  /*
   * `skills/ninfit-visual-asset-pipeline`: generated artwork is source material until
   * a human has approved it, and only approved artwork is wired in. Human visual
   * approval was given for PR #195, so these tests changed from "nothing is wired in"
   * to "exactly one thing is". What they still forbid is the failure the pipeline
   * actually warns about: image URLs scattered through screen components.
   */
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return entry.isFile() && /\.tsx?$/.test(entry.name) ? [full] : [];
    });

  const strip = (source: string) =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  const runtime = walk('src').filter(
    (file) => !file.startsWith(join('src', 'test')) && !file.startsWith(join('src', 'art')),
  );

  it('keeps the art SOURCE out of the application entirely', () => {
    /*
     * The generator's master is build-time material. The runtime consumes the six
     * committed files, never the module that produced them - which is what keeps the
     * geometry, the palette and the fracture layers out of the shipped bundle.
     *
     * Comments are stripped first: a doc comment that tells the next reader where the
     * artwork came from is documentation, and a guard that punished it would teach
     * people to stop writing it.
     */
    const consumers = runtime.filter((file) =>
      strip(readFileSync(file, 'utf8')).includes('art/egg/eggMaster'),
    );
    expect(consumers, `imported by: ${consumers.join(', ')}`).toEqual([]);
  });

  it('names an egg asset in exactly one place, the registry', () => {
    const namers = runtime.filter((file) => strip(readFileSync(file, 'utf8')).includes('/egg/'));
    expect(namers).toEqual([join('src', 'ui', 'eggStageArt.ts')]);

    // And not in CSS either: a `url()` in the stylesheet would be a second registry
    // with no fallback and no test.
    const styles = readFileSync(join('src', 'styles', 'components', 'egg.css'), 'utf8');
    expect(styles).not.toContain('/egg/');
    expect(styles).not.toMatch(/url\(/);
  });

  it('declares the whole reviewed set and nothing that is not on disk', () => {
    expect(Object.keys(EGG_STAGE_ART).map(Number).sort()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(hasCompleteEggStageArt()).toBe(true);

    for (const stage of EGG_STAGES) {
      const art = eggStageArt(stage);
      expect(art?.src).toBe(eggStageAssetPath(stage));
      // A registry entry pointing at a file that is not shipped is a 404 in the one
      // moment the product exists for.
      expect(existsSync(join('public', art?.src.replace(/^\//, '') ?? ''))).toBe(true);
    }
  });

  it('resolves stages through the registry rather than learning a filename', () => {
    const eggArt = readFileSync(join('src', 'ui', 'components', 'EggArt.tsx'), 'utf8');
    expect(eggArt).toContain("from '../eggStageArt'");
    expect(eggArt).toContain('eggStageArt(stage)');
    expect(eggArt).toContain('src={art.src}');
    // The failure the pipeline skill names by name.
    expect(eggArt).not.toContain('/egg/');
    expect(eggArt).not.toMatch(/\.svg['"`]/);
  });

  it('keeps the code drawing as the media-failure fallback, not as the presentation', () => {
    /*
     * `docs/CURRENT_STATE` requires that a failed asset still leaves the authoritative
     * hatched companion reachable. The drawing is how that requirement is met, so it
     * stays - demoted, never deleted. Deleting it would turn a 404 into a blank square
     * in the middle of the hatch.
     */
    const eggArt = readFileSync(join('src', 'ui', 'components', 'EggArt.tsx'), 'utf8');
    expect(eggArt).toContain('className="egg__shell"');
    expect((eggArt.match(/data-egg-stage="/g) ?? []).length).toBe(5);
    expect(eggArt).toContain('onError={() => setArtFailed(true)}');
    expect(eggArt).toContain('if (!artFailed && hasCompleteEggStageArt())');
  });

  it('changes the artwork and not the crack-stage contract', () => {
    const eggArt = readFileSync(join('src', 'ui', 'components', 'EggArt.tsx'), 'utf8');
    // Same props, same clamp, same 0-5 range the domain produces.
    expect(eggArt).toContain('crackStage = 0');
    expect(eggArt).toContain('Math.floor(crackStage)');
    expect(MAX_CRACK_STAGE).toBe(5);
  });
});

describe('the review material a human is asked to sign off', () => {
  it('ships a contact sheet covering both themes and both real display sizes', () => {
    const sheet = readFileSync(
      join(REVIEW_DIR, 'egg-stage-contact-sheet-v1.html'),
      'utf8',
    );

    for (const stage of EGG_STAGES) {
      expect(sheet).toContain(`egg-stage-${stage}-v1.svg`);
    }
    expect(sheet).toContain('light surface');
    expect(sheet).toContain('dark surface');
    // The two sizes the egg is actually shown at: the onboarding header, and the
    // ceremony on the narrowest supported viewport. A set reviewed only at 168px
    // has not been reviewed.
    expect(sheet).toContain('68px');
    expect(sheet).toContain('201px');
    expect(existsSync(join(REVIEW_DIR, 'egg-stage-contact-sheet-v1.png'))).toBe(true);
  });

  it('keeps the review sheet out of the shipped application', () => {
    expect(existsSync(join('public', 'egg', 'egg-stage-contact-sheet-v1.html'))).toBe(false);
  });
});
