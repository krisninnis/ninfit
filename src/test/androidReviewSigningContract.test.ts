import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

/*
 * GitHub-hosted runners generate a fresh `debug.keystore` per job, so two Verification
 * Gate runs of the same commit produced APKs signed by two different identities. Android
 * refuses to update a package whose signer changed, which the physical Samsung reported
 * as "App not installed as package conflicts with an existing package" - and the install
 * it refused to replace holds a deliberately stranded real-world Journey kept as a
 * recovery case.
 *
 * The fix lives entirely in a YAML workflow and a Gradle script that nothing in this
 * repository imports, which is exactly why it is pinned here. A future `cap sync`, a
 * workflow tidy-up, or a well-meant "the signing block looks unused" edit would otherwise
 * silently return the published acceptance APK to ephemeral debug signing, and nothing
 * would notice until a phone refused the next install.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8');

/** The dedicated NinFit REVIEW/TEST certificate. Not the production/release identity. */
const REVIEW_CERT_SHA256 =
  'BD:3F:0C:72:A4:A3:92:CD:FE:24:C3:E6:40:46:F3:40:6B:BC:1F:3C:32:7C:73:CE:C7:B8:D9:F9:84:78:B4:D2';

const workflow = read('.github', 'workflows', 'verification.yml');
const signingGradle = read('android', 'app', 'ninfit-review-signing.gradle');
const appGradle = read('android', 'app', 'build.gradle');
const gitignore = read('.gitignore');

/** Gradle/YAML comments necessarily quote the wording a negative assertion forbids. */
const stripGradleComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const stripYamlComments = (source: string) =>
  source
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');

const workflowBody = stripYamlComments(workflow);
const gradleBody = stripGradleComments(signingGradle);

const stepIndex = (name: string) => {
  const at = workflow.indexOf(`- name: ${name}`);
  expect(at, `workflow step "${name}" is missing`).toBeGreaterThan(-1);
  return at;
};

describe('Verification Gate review signing inputs', () => {
  it('rebuilds the keystore from the repository secret rather than from a committed file', () => {
    expect(workflowBody).toContain('NINFIT_REVIEW_KEYSTORE_BASE64: ${{ secrets.NINFIT_REVIEW_KEYSTORE_BASE64 }}');
    expect(workflowBody).toContain('NINFIT_REVIEW_KEY_ALIAS: ${{ secrets.NINFIT_REVIEW_KEY_ALIAS }}');
    expect(workflowBody).toContain('NINFIT_REVIEW_STORE_PASSWORD: ${{ secrets.NINFIT_REVIEW_STORE_PASSWORD }}');
    expect(workflowBody).toContain('NINFIT_REVIEW_KEY_PASSWORD: ${{ secrets.NINFIT_REVIEW_KEY_PASSWORD }}');
    expect(workflowBody).toContain('base64 -d');
  });

  it('writes the keystore only to runner-local temporary storage', () => {
    expect(workflowBody).toContain('keystore_dir="$RUNNER_TEMP/ninfit-review-signing"');
    expect(workflowBody).toContain('rm -rf "$RUNNER_TEMP/ninfit-review-signing"');
    // Anywhere under the checkout could be committed, uploaded or cached by a later step.
    expect(workflowBody).not.toMatch(/review\.jks[^\n]*(GITHUB_WORKSPACE|\.\/android|android\/app)/);
  });

  it('passes secrets through step environments, never interpolated into a shell script', () => {
    // `${{ secrets.X }}` inside a `run:` body is substituted into the script text itself,
    // where a stray `set -x`, an error trace or an unquoted expansion can print it.
    const runBodies = workflow.split(/\n {6}- name: /).filter((step) => /\n {8}run: \|/.test(step));
    for (const step of runBodies) {
      const script = step.slice(step.indexOf('run: |'));
      expect(script).not.toMatch(/\$\{\{\s*secrets\./);
    }
  });

  it('never echoes or inspects a secret value', () => {
    expect(workflowBody).not.toMatch(/echo[^\n]*\$NINFIT_REVIEW_(KEYSTORE_BASE64|STORE_PASSWORD|KEY_PASSWORD|KEY_ALIAS)\b/);
    expect(workflowBody).not.toMatch(/cat[^\n]*review\.jks/);
    expect(workflowBody).not.toContain('set -x');
  });
});

describe('Verification Gate fail-closed signing contract', () => {
  it('stops a trusted, artifact-producing build when the signing secrets are unavailable', () => {
    const materialise = workflow.slice(stepIndex('Materialise the NinFit review signing keystore'));
    expect(materialise).toContain('::error::Review signing secrets unavailable');
    expect(materialise).toContain('exit 1');
    expect(materialise).toContain('NINFIT_REVIEW_KEYSTORE_BASE64:-');
  });

  it('requires review signing from Gradle for exactly the builds whose APK is published', () => {
    expect(workflowBody).toContain('NINFIT_REVIEW_SIGNING_REQUIRED: ${{ env.NINFIT_TRUSTED_BUILD }}');
    expect(workflowBody).toContain(
      "NINFIT_TRUSTED_BUILD: ${{ github.event_name == 'push' || github.event.pull_request.head.repo.full_name == github.repository }}",
    );
  });

  it('publishes an APK only from a build that could read the review identity', () => {
    const publish = workflow.slice(stepIndex('Publish NinFit Android debug APK'));
    expect(publish).toContain("if: env.NINFIT_TRUSTED_BUILD == 'true'");
    // Requirement 11: the artifact itself must survive every edit to this workflow.
    expect(publish).toContain('android/app/build/outputs/apk/debug/app-debug.apk');
    expect(publish).toContain('if-no-files-found: error');
  });
});

describe('Verification Gate certificate proof', () => {
  it('pins the review certificate fingerprint in the workflow', () => {
    expect(workflow).toContain(`NINFIT_REVIEW_CERT_SHA256: '${REVIEW_CERT_SHA256}'`);
  });

  it('proves the built APK carries that certificate, after the build and before publication', () => {
    const compile = stepIndex('Compile Android debug app');
    const verify = stepIndex('Verify the APK carries the NinFit review signing identity');
    const publish = stepIndex('Publish NinFit Android debug APK');
    expect(verify).toBeGreaterThan(compile);
    expect(publish).toBeGreaterThan(verify);
  });

  it('fails closed on a mismatch, an unreadable certificate, or the generic debug identity', () => {
    const verify = workflow.slice(
      stepIndex('Verify the APK carries the NinFit review signing identity'),
      stepIndex('Remove the review keystore from the runner'),
    );
    expect(verify).toContain('apksigner');
    expect(verify).toContain('keytool -printcert -jarfile');
    expect(verify).toContain('[ "$observed" != "$expected" ]');
    expect(verify).toContain('Could not read a signing certificate');
    expect(verify).toContain("*'CN=Android Debug'*");
    // One signer: a second, unexpected signer must not pass because signer #1 matched.
    expect(verify).toContain('[ "$signer_count" != "1" ]');
    expect(verify.match(/exit 1/g) ?? []).toHaveLength(5);
  });
});

describe('Android review signing configuration', () => {
  it('is applied from the app build file, after the regenerated Capacitor script', () => {
    expect(appGradle).toContain("apply from: 'ninfit-review-signing.gradle'");
    expect(appGradle.indexOf("apply from: 'ninfit-review-signing.gradle'")).toBeGreaterThan(
      appGradle.indexOf("apply from: 'capacitor.build.gradle'"),
    );
  });

  it('signs the debug build type with the dedicated review identity', () => {
    expect(gradleBody).toContain('signingConfig signingConfigs.ninfitReview');
    expect(gradleBody).toMatch(/buildTypes\s*\{\s*debug\s*\{/);
    expect(gradleBody).toContain('enableV1Signing = true');
    expect(gradleBody).toContain('enableV2Signing = true');
    expect(gradleBody).toContain('enableV3Signing = true');
  });

  it('refuses to degrade to the local debug key when signing is required', () => {
    expect(gradleBody).toContain('NINFIT_REVIEW_SIGNING_REQUIRED');
    expect(gradleBody).toContain('throw new GradleException(');
    expect(gradleBody).toContain('Refusing to fall back to the Android default debug key');
  });

  it('reads every signing input from the environment, never from the repository', () => {
    expect(gradleBody).toContain("System.getenv('NINFIT_REVIEW_STORE_FILE')");
    expect(gradleBody).toContain("System.getenv('NINFIT_REVIEW_KEY_ALIAS')");
    expect(gradleBody).toContain("System.getenv('NINFIT_REVIEW_STORE_PASSWORD')");
    expect(gradleBody).toContain("System.getenv('NINFIT_REVIEW_KEY_PASSWORD')");
    expect(gradleBody).not.toMatch(/keystore\.properties|signing\.properties/);
    expect(gradleBody).not.toMatch(/storePassword\s+['"]/);
    expect(gradleBody).not.toMatch(/keyPassword\s+['"]/);
    expect(gradleBody).not.toMatch(/keyAlias\s+['"]/);
  });

  it('leaves production/release signing untouched', () => {
    expect(gradleBody).not.toContain('release');
    const releaseBlock = appGradle.slice(appGradle.indexOf('release {'), appGradle.indexOf('release {') + 200);
    expect(releaseBlock).not.toContain('signingConfig');
  });

  it('does not weaken the shell contracts the Journey depends on', () => {
    // The signing script must configure signing and nothing else.
    expect(gradleBody).not.toMatch(/allowBackup|usesCleartextTraffic|uses-permission|minifyEnabled|minSdkVersion/);
  });
});

describe('signing material stays out of the repository', () => {
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);

  it('tracks no keystore, certificate or private key file', () => {
    const secretish = tracked.filter((path) => /\.(jks|keystore|p12|pfx|pem|pk8|der|key|bks)$/i.test(path));
    expect(secretish).toEqual([]);
  });

  it('ignores keystore shapes so one cannot be added by accident', () => {
    for (const pattern of ['*.jks', '*.keystore', '*.p12', 'keystore.properties']) {
      expect(gitignore).toContain(pattern);
    }
  });
});
