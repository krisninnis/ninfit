import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/*
 * A Capacitor custom plugin is only reachable from JavaScript if the Java class was
 * handed to the Bridge builder *before* the Bridge is constructed. In Capacitor 8
 * `BridgeActivity.onCreate` ends with `this.load()`, which calls
 * `bridgeBuilder.addPlugins(initialPlugins).create()`, and the Bridge constructor
 * immediately runs `registerAllPlugins()`. So `registerPlugin(X.class)` written *after*
 * `super.onCreate(...)` mutates a plugin list that has already been consumed: the class
 * is never registered, `Bridge.callPluginMethod` answers
 * `unable to find plugin : <id>`, and every JS call to it rejects.
 *
 * That failure is invisible to a mocked React test and to `assembleDebug` - it compiles,
 * installs and launches, and only the phone shows it. A physical Samsung test of the
 * Journey permission surface hit exactly this: precise location was granted in Android
 * Settings and Start Walk still reported "NinFit could not confirm the Android
 * permissions", because `checkPermissionReadiness()` was rejecting rather than returning
 * `ready: false`.
 *
 * These assertions pin the whole JS -> native seam from the repository text, so the same
 * class of break cannot reach a phone again.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8');

const NATIVE_DIR = ['android', 'app', 'src', 'main', 'java', 'app', 'ninfit', 'mobile'];
const APP_DIR = ['src', 'app'];

const stripJavaComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const stripTsComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const mainActivity = stripJavaComments(read(...NATIVE_DIR, 'MainActivity.java'));

const nativePluginFiles = readdirSync(join(ROOT, ...NATIVE_DIR)).filter((name) => name.endsWith('.java'));

/** Java class name -> Capacitor plugin id, for every @CapacitorPlugin in the app module. */
const nativePlugins = new Map<string, string>();
for (const file of nativePluginFiles) {
  const source = stripJavaComments(read(...NATIVE_DIR, file));
  const annotation = /@CapacitorPlugin\s*\(([\s\S]*?)\)\s*public\s+class\s+(\w+)/.exec(source);
  if (annotation === null) continue;
  const [, attributes = '', className = ''] = annotation;
  const id = /name\s*=\s*"([^"]+)"/.exec(attributes)?.[1];
  expect(id, `${file} declares @CapacitorPlugin without a name`).toBeTypeOf('string');
  nativePlugins.set(className, id ?? '');
}

/** Capacitor plugin ids the shipped web app actually calls, and the sources that call them. */
const jsPluginIds = new Set<string>();
const appSources = new Map<string, string>();
for (const file of readdirSync(join(ROOT, ...APP_DIR)).filter((name) => name.endsWith('.ts'))) {
  const source = stripTsComments(read(...APP_DIR, file));
  appSources.set(file, source);
  for (const match of source.matchAll(/registerPlugin\s*(?:<[^>]*>)?\s*\(\s*'([^']+)'/g)) {
    if (match[1] !== undefined) jsPluginIds.add(match[1]);
  }
}

describe('installed Android custom plugin registration', () => {
  it('finds the native plugin classes this contract is about', () => {
    expect(nativePlugins.size).toBeGreaterThan(0);
    expect([...nativePlugins.entries()].sort()).toEqual([
      ['NinFitJourneyLocationPlugin', 'NinFitJourneyLocation'],
      ['NinFitJourneyQueuePlugin', 'NinFitJourneyQueue'],
    ]);
  });

  it('registers every custom plugin before super.onCreate, while the Bridge can still be built with it', () => {
    const superOnCreate = mainActivity.indexOf('super.onCreate(');
    expect(superOnCreate, 'MainActivity must call super.onCreate').toBeGreaterThan(-1);

    const registrations = [...mainActivity.matchAll(/registerPlugin\s*\(\s*(\w+)\.class\s*\)/g)];
    expect(registrations.length).toBe(nativePlugins.size);

    for (const registration of registrations) {
      expect(
        registration.index ?? Number.POSITIVE_INFINITY,
        `registerPlugin(${registration[1] ?? '?'}.class) runs after super.onCreate(...), so Capacitor 8 has already built the Bridge and the plugin is never registered`,
      ).toBeLessThan(superOnCreate);
    }
  });

  it('registers every native plugin class that exists, so a new one cannot be added and forgotten', () => {
    const registered = new Set(
      [...mainActivity.matchAll(/registerPlugin\s*\(\s*(\w+)\.class\s*\)/g)]
        .map((match) => match[1])
        .filter((name): name is string => name !== undefined),
    );
    for (const className of nativePlugins.keys()) {
      expect(registered.has(className), `${className} is never registered in MainActivity`).toBe(true);
    }
  });

  it('backs every plugin id the web app calls with a registered native class', () => {
    expect(jsPluginIds.size).toBeGreaterThan(0);
    const registeredIds = new Set(
      [...mainActivity.matchAll(/registerPlugin\s*\(\s*(\w+)\.class\s*\)/g)]
        .map((match) => (match[1] === undefined ? undefined : nativePlugins.get(match[1])))
        .filter((id): id is string => id !== undefined),
    );
    for (const id of jsPluginIds) {
      expect(
        registeredIds.has(id),
        `registerPlugin('${id}') has no native class registered in MainActivity; Capacitor answers "unable to find plugin : ${id}" and every call rejects`,
      ).toBe(true);
    }
  });
});

/*
 * Registration alone is not enough. A plugin can be on the Bridge and still reject every
 * call if JavaScript asks for a method the Java class does not declare - which produces
 * the same permanent, unrecoverable rejection as a missing plugin, from the same generic
 * "could not reconcile" sentence. These assertions pin the method names on both sides of
 * the seam, and the one thing the durable transport depends on: that the plugin and the
 * foreground service read and write the SAME store.
 */

const nativeSources = new Map<string, string>(
  nativePluginFiles.map((file) => [file, stripJavaComments(read(...NATIVE_DIR, file))]),
);

function pluginMethods(className: string): Set<string> {
  for (const source of nativeSources.values()) {
    if (!new RegExp(`class\\s+${className}\\b`).test(source)) continue;
    return new Set(
      [...source.matchAll(/@PluginMethod[\s\S]{0,80}?public\s+void\s+(\w+)\s*\(/g)]
        .map((match) => match[1])
        .filter((name): name is string => name !== undefined),
    );
  }
  return new Set();
}

/** Method names the web app calls on one plugin id, read from its TypeScript interface. */
function jsMethodsFor(pluginId: string): Set<string> {
  const names = new Set<string>();
  for (const [, source] of appSources) {
    const registration = new RegExp(`registerPlugin\\s*<\\s*(\\w+)\\s*>\\s*\\(\\s*'${pluginId}'`).exec(source);
    if (registration === null) continue;
    const interfaceName = registration[1];
    const declaration = new RegExp(`interface\\s+${interfaceName}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(source);
    if (declaration === null) continue;
    for (const method of (declaration[1] ?? '').matchAll(/^\s*(\w+)\s*\(/gm)) {
      if (method[1] !== undefined) names.add(method[1]);
    }
  }
  return names;
}

describe('installed Android custom plugin call surface', () => {
  it('backs every method the web app calls with a @PluginMethod of the same name', () => {
    const seams: Array<[string, string]> = [
      ['NinFitJourneyLocation', 'NinFitJourneyLocationPlugin'],
      ['NinFitJourneyQueue', 'NinFitJourneyQueuePlugin'],
    ];

    for (const [pluginId, className] of seams) {
      const wanted = jsMethodsFor(pluginId);
      expect(wanted.size, `no TypeScript interface found for ${pluginId}`).toBeGreaterThan(0);
      const declared = pluginMethods(className);
      for (const method of wanted) {
        expect(
          declared.has(method),
          `${pluginId}.${method}() is called from src/app but ${className} declares no @PluginMethod ${method}; the call rejects on the phone and CI never sees it`,
        ).toBe(true);
      }
    }
  });

  it('keeps the queue plugin and the foreground service on one durable store', () => {
    const store = read(...NATIVE_DIR, 'JourneyDurableStore.java');
    const databaseNames = [...store.matchAll(/DATABASE_NAME\s*=\s*"([^"]+)"/g)].map((match) => match[1]);
    expect(databaseNames).toEqual(['ninfit_journey_native.db']);

    // Both sides construct the same helper: the queue the WebView reads is the queue the
    // service writes. A second store class here would silently strand every fix.
    expect(nativeSources.get('NinFitJourneyQueuePlugin.java')).toContain('new JourneyDurableStore(');
    expect(nativeSources.get('JourneyForegroundLocationService.java')).toContain('new JourneyDurableStore(');
    expect(nativeSources.get('JourneyNativeCapture.java')).toContain('store.append(');
  });

  it('commits the active Journey id only once native recording is really running', () => {
    /*
     * A service that set activeJourneyId before startForeground() stayed alive after a
     * refusal, with no notification and no location updates, and JavaScript could not
     * tell it apart from a recorder waiting for a satellite. The id must be unwound on
     * failure so the state cannot exist.
     */
    const service = nativeSources.get('JourneyForegroundLocationService.java') ?? '';
    const startCapture = /private void startCapture\(String journeyId\)[\s\S]*?\n    \}/.exec(service)?.[0] ?? '';
    expect(startCapture).not.toBe('');
    expect(startCapture).toContain('activeJourneyId = null;');
    expect(startCapture).toMatch(/catch \(RuntimeException error\)[\s\S]*?throw error;/);
    expect(startCapture.indexOf('startForeground(')).toBeLessThan(startCapture.indexOf('throw error;'));
  });
});
