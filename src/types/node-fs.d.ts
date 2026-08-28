/**
 * A minimal ambient declaration for the handful of Node APIs the source guards use.
 *
 * WHY THIS EXISTS RATHER THAN @types/node:
 * The guard has to read CSS *source*, and Vite cannot provide it - `?raw` and
 * `?inline` both return empty strings for `.css` inside Vitest, because Vite's CSS
 * pipeline intercepts them (verified experimentally). Reading from the filesystem is
 * the only reliable route.
 *
 * Adding `@types/node` would mean installing a dependency, which is not approved for
 * this phase. Declaring precisely the two functions used keeps the surface tiny,
 * typed and honest, with no install and no `any`.
 */
declare module 'node:fs' {
  /**
   * `latin1` is here for the asset guards, not for text. It maps each byte to one
   * character, so a file's magic bytes can be checked as a string without pulling
   * `Buffer` - and therefore all of `@types/node` - into this project.
   */
  export function readFileSync(path: string, encoding: 'utf8' | 'latin1'): string;

  /** Used to prove a declared production asset is actually on disk. */
  export function existsSync(path: string): boolean;

  /** Only `size` is declared, because only the asset size budget is checked. */
  export function statSync(path: string): { size: number };

  export interface DirEntry {
    name: string;
    isDirectory(): boolean;
    isFile(): boolean;
  }

  export function readdirSync(
    path: string,
    options: { withFileTypes: true },
  ): DirEntry[];
}

declare module 'node:path' {
  export function join(...parts: string[]): string;
  export function relative(from: string, to: string): string;
}

declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string;
}
