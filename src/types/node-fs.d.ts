/**
 * A minimal ambient declaration for the two Node APIs the CSS integrity guard uses.
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
  export function readFileSync(path: string, encoding: 'utf8'): string;

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
