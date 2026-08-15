import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Reading and parsing the CSS *source* for the integrity guard and the theme
 * contract tests.
 *
 * Source, not build output: the guard must fail on a bad token in a file a person
 * wrote, before a bundler has had a chance to drop or rewrite anything.
 *
 * Everything here is deterministic - files are sorted, and nothing depends on
 * traversal order.
 */

const STYLES_DIR = fileURLToPath(new URL('../styles', import.meta.url));

export interface CssFile {
  /** Path relative to src/styles, e.g. "tokens/semantic.css". */
  name: string;
  /** Original text, comments intact. */
  raw: string;
  /** Comments removed, so a commented-out token is neither declared nor used. */
  code: string;
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function walk(dir: string, base: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(full, base));
    else if (entry.isFile() && entry.name.endsWith('.css')) found.push(full);
  }
  return found;
}

export function readStyleFiles(): CssFile[] {
  return walk(STYLES_DIR, STYLES_DIR)
    .map((full) => {
      const raw = readFileSync(full, 'utf8');
      return {
        name: relative(STYLES_DIR, full).replace(/\\/g, '/'),
        raw,
        code: stripComments(raw),
      };
    })
    .sort((a, b) => (a.name < b.name ? -1 : 1));
}

export interface TokenReference {
  token: string;
  file: string;
}

/**
 * Custom properties DECLARED, i.e. appearing in property position.
 *
 * The trailing colon is what distinguishes a declaration from a reference: a
 * `var()` reference never has one.
 */
export function collectDeclarations(files: readonly CssFile[]): TokenReference[] {
  const found: TokenReference[] = [];
  for (const file of files) {
    for (const match of file.code.matchAll(/(^|[;{}\s])(--[\w-]+)\s*:/g)) {
      const token = match[2];
      if (token !== undefined) found.push({ token, file: file.name });
    }
  }
  return found;
}

/**
 * Custom properties REFERENCED.
 *
 * Only the first argument of `var()` is captured, so a literal fallback such as
 * `var(--x, 12px)` contributes `--x` and nothing else. A nested fallback like
 * `var(--a, var(--b))` yields both, because the global regex matches each `var(`.
 */
export function collectUsages(files: readonly CssFile[]): TokenReference[] {
  const found: TokenReference[] = [];
  for (const file of files) {
    for (const match of file.code.matchAll(/var\(\s*(--[\w-]+)/g)) {
      const token = match[1];
      if (token !== undefined) found.push({ token, file: file.name });
    }
  }
  return found;
}

/**
 * The body of every block whose selector matches, with braces balanced.
 *
 * A regex cannot do this safely once at-rules nest, so this counts braces. Used to
 * compare the token set of one themed block against another.
 */
export function blockBodies(css: string, selector: RegExp): string[] {
  const bodies: string[] = [];
  const source = stripComments(css);
  const finder = new RegExp(selector.source, selector.flags.includes('g') ? selector.flags : `${selector.flags}g`);

  for (const match of source.matchAll(finder)) {
    const open = source.indexOf('{', match.index + match[0].length - 1);
    if (open === -1) continue;

    let depth = 0;
    for (let index = open; index < source.length; index += 1) {
      if (source[index] === '{') depth += 1;
      else if (source[index] === '}') {
        depth -= 1;
        if (depth === 0) {
          bodies.push(source.slice(open + 1, index));
          break;
        }
      }
    }
  }
  return bodies;
}

/**
 * Bodies of "leaf" blocks - those containing no nested block of their own.
 *
 * Needed because an `@layer` wrapper is itself a block, so a naive scan reports the
 * three sibling `:root` blocks inside one layer as a single block and every themed
 * token as a triplicate. A leaf block is the smallest unit where "declared twice"
 * actually means something.
 */
export function leafBlockBodies(css: string): string[] {
  const bodies: string[] = [];
  for (const match of stripComments(css).matchAll(/\{([^{}]*)\}/g)) {
    const body = match[1];
    if (body !== undefined) bodies.push(body);
  }
  return bodies;
}

export interface LeafRule {
  /** The selector text, whitespace-collapsed. */
  selector: string;
  body: string;
}

/**
 * Every rule that contains no nested rule of its own, with its selector.
 *
 * Needed because looking a rule up by a bare regex conflates `.a { }` with
 * `.a--modifier { }` and `.parent .a { }`, and silently returns whichever came
 * first. Matching the selector exactly is the only reliable way to assert on one
 * specific rule, and a media query simply yields a second entry with the same
 * selector rather than shadowing the first.
 */
export function leafRules(css: string): LeafRule[] {
  const rules: LeafRule[] = [];
  const source = stripComments(css);

  for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = (match[1] ?? '').trim().replace(/\s+/g, ' ');
    const body = match[2] ?? '';
    // An at-rule preamble such as `@media (...)` is a wrapper, not a rule.
    if (selector === '' || selector.startsWith('@')) continue;
    rules.push({ selector, body });
  }
  return rules;
}

/**
 * All declarations in a block, including ordinary CSS properties.
 *
 * `declarationsIn` deliberately sees only custom properties, because that is what
 * the token guard needs. This sees everything, which is what the layout and state
 * assertions need.
 */
export function propertiesIn(body: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const match of body.matchAll(/(^|[;{])\s*([a-zA-Z-][\w-]*)\s*:([^;}]*)/g)) {
    const property = match[2];
    const value = match[3];
    if (property !== undefined && value !== undefined) found.set(property, value.trim());
  }
  return found;
}

/**
 * The declarations of the FIRST rule with this exact selector.
 *
 * "First" rather than merged, because a base rule and its media-query override are
 * two different questions: this answers "what does it do by default", which is what
 * a layout or touch-target assertion is usually asking.
 *
 * Exact-match, because `.checkin__row` must not silently pick up
 * `.checkin__row--wide` or `.plan .checkin__row`.
 */
export function baseRule(css: string, selector: string): Map<string, string> {
  const first = leafRules(css).find((rule) => rule.selector === selector);
  if (first === undefined) throw new Error(`no rule found for "${selector}"`);
  return propertiesIn(first.body);
}

/** The custom properties declared directly in a block body. */
export function tokensDeclaredIn(body: string): Set<string> {
  const tokens = new Set<string>();
  for (const match of body.matchAll(/(^|[;{}\s])(--[\w-]+)\s*:/g)) {
    const token = match[2];
    if (token !== undefined) tokens.add(token);
  }
  return tokens;
}

/** Custom properties declared in a block, with their raw values. */
export function declarationsIn(body: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const match of body.matchAll(/(^|[;{}\s])(--[\w-]+)\s*:([^;}]*)/g)) {
    const token = match[2];
    const value = match[3];
    if (token !== undefined && value !== undefined) found.set(token, value.trim());
  }
  return found;
}

/**
 * Follows a `var()` chain until it reaches a literal.
 *
 * Only the FIRST argument is followed. A fallback is not resolved, on purpose: the
 * tests want to know the value a correctly configured app actually renders, and a
 * fallback is by definition the value it renders when something is wrong.
 *
 * Returns undefined if the chain dead-ends or loops, so a caller cannot silently
 * assert against a half-resolved string.
 */
export function resolveValue(
  value: string,
  scopes: ReadonlyArray<Map<string, string>>,
  depth = 0,
): string | undefined {
  if (depth > 10) return undefined;

  const reference = /^var\(\s*(--[\w-]+)/.exec(value.trim());
  if (reference === null) return value.trim();

  const token = reference[1];
  if (token === undefined) return undefined;

  for (const scope of scopes) {
    const next = scope.get(token);
    if (next !== undefined) return resolveValue(next, scopes, depth + 1);
  }
  return undefined;
}
