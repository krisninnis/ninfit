import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/*
 * The installed Android shell has decisions in it that no JavaScript test would
 * otherwise ever look at: an application id that a Play listing and a location licence
 * are both bound to, and a backup posture that decides whether precise Journey routes
 * are copied to Google Drive. Those live in XML and Gradle files that nothing in this
 * repository imports, which is exactly why they need pinning here - a silent revert
 * during a `cap sync` or a template regeneration would otherwise reach a phone.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8');

/** XML/TS comments necessarily quote the wording a negative assertion forbids. */
const stripXmlComments = (source: string) => source.replace(/<!--[\s\S]*?-->/g, '');
const stripTsComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const capacitorConfig = read('capacitor.config.ts');
const manifest = read('android', 'app', 'src', 'main', 'AndroidManifest.xml');
const extractionRules = read('android', 'app', 'src', 'main', 'res', 'xml', 'data_extraction_rules.xml');
const appGradle = read('android', 'app', 'build.gradle');
const strings = read('android', 'app', 'src', 'main', 'res', 'values', 'strings.xml');
const packageJson = JSON.parse(read('package.json')) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

describe('installed Android shell identity', () => {
  it('carries the one permanent application id, in every place that has to agree', () => {
    expect(stripTsComments(capacitorConfig)).toContain("appId: 'app.ninfit.mobile'");
    expect(appGradle).toContain('applicationId "app.ninfit.mobile"');
    expect(appGradle).toContain('namespace = "app.ninfit.mobile"');
    expect(strings).toContain('<string name="package_name">app.ninfit.mobile</string>');
  });

  it('ships the same built web app rather than a second product', () => {
    const config = stripTsComments(capacitorConfig);
    expect(config).toContain("webDir: 'dist'");
    expect(config).toContain("appName: 'NinFit'");
    expect(strings).toContain('<string name="app_name">NinFit</string>');
  });

  it('keeps the WebView on a secure origin and refuses mixed content', () => {
    const config = stripTsComments(capacitorConfig);
    // Geolocation, Screen Wake Lock and service workers all require a secure context.
    expect(config).toContain("androidScheme: 'https'");
    expect(config).toContain('allowMixedContent: false');
    expect(config).not.toContain("androidScheme: 'http'");
    expect(stripXmlComments(manifest)).not.toContain('android:usesCleartextTraffic="true"');
  });
});

describe('installed Android shell privacy posture', () => {
  it('refuses both automatic backup transports, so route history leaves only by export', () => {
    const declared = stripXmlComments(manifest);
    expect(declared).toContain('android:allowBackup="false"');
    expect(declared).not.toContain('android:allowBackup="true"');
    expect(declared).toContain('android:fullBackupContent="false"');
    expect(declared).toContain('android:dataExtractionRules="@xml/data_extraction_rules"');

    // allowBackup alone does not cover Android 12+ device-to-device transfer.
    const rules = stripXmlComments(extractionRules);
    expect(rules).toMatch(/<cloud-backup>\s*<exclude domain="root"\s*\/>\s*<\/cloud-backup>/);
    expect(rules).toMatch(/<device-transfer>\s*<exclude domain="root"\s*\/>\s*<\/device-transfer>/);
  });

  it('asks for no permission the shell does not yet need', () => {
    const permissions = [...stripXmlComments(manifest).matchAll(/<uses-permission android:name="([^"]+)"/g)]
      .map((match) => match[1]);
    // Background location, the foreground service and its notification arrive with the
    // provider slice, together with the code that justifies asking for them.
    expect(permissions).toEqual(['android.permission.INTERNET']);
  });
});

describe('installed Android shell dependencies', () => {
  it('pins the Capacitor 8 line across core, platform and CLI', () => {
    expect(packageJson.dependencies['@capacitor/core']).toMatch(/^\^8\./);
    expect(packageJson.dependencies['@capacitor/android']).toMatch(/^\^8\./);
    expect(packageJson.devDependencies['@capacitor/cli']).toMatch(/^\^8\./);
  });
});
