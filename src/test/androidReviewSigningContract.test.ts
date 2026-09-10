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
  const verifyStep = () =>
    workflow.slice(
      stepIndex('Verify the APK carries the NinFit review signing identity'),
      stepIndex('Remove the review keystore from the runner'),
    );

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

  /*
   * Run #239 (run id 34462019970) built and signed the APK correctly and then failed
   * here, reporting an empty subject and an empty digest. Three things made a silent
   * read indistinguishable from a healthy one: the tool was run without `2>&1`, so
   * anything it wrote to stderr was discarded; the parser matched one exact label; and
   * nothing was echoed, so the log could not say which had happened. A local harness
   * that ran this step's own script against jarsigner-signed fixtures then found a
   * fourth: `tr -d '[:space:]'` folded keytool's whole report onto a single line, so the
   * anchored `^SHA256:` match could never fire. The assertions below pin the shape of
   * the fix rather than any one tool's wording.
   */
  it('reads the certificate by hashing DER bytes, not by parsing a printed fingerprint', () => {
    const verify = verifyStep();
    expect(verify).toContain('openssl pkcs7 -inform DER');
    expect(verify).toContain('-outform DER');
    expect(verify).toContain('sha256sum "$work/signer.der"');
  });

  it('cross-checks that reading against independent tools and requires agreement', () => {
    const verify = verifyStep();
    expect(verify).toContain('keytool -printcert -jarfile');
    expect(verify).toContain('apksigner');
    expect(verify).toContain('readings disagree');
    // One tool agreeing with itself is what the previous revision effectively relied on.
    expect(verify).toContain('[ "$readings" -lt 2 ]');
  });

  it('captures stderr from every tool reading', () => {
    const verify = verifyStep();
    for (const invocation of ['keytool -printcert -jarfile "$apk"', 'verify --print-certs -v "$apk"']) {
      const at = verify.indexOf(invocation);
      expect(at, `missing invocation: ${invocation}`).toBeGreaterThan(-1);
      expect(verify.slice(at, at + invocation.length + 12)).toContain('2>&1');
    }
  });

  it('echoes the raw tool output, so a failed read says what it saw', () => {
    const verify = verifyStep();
    expect(verify).toContain('--- keytool -printcert -jarfile ---');
    expect(verify).toContain('--- apksigner verify --print-certs -v ---');
    expect(verify).toContain('printf \'%s\\n\' "$keytool_out"');
    expect(verify).toContain('printf \'%s\\n\' "$apksigner_out"');
  });

  it('does not depend on one exact printed label', () => {
    const verify = verifyStep();
    // The literal that run #239 failed on. Matching must stay case- and spacing-tolerant.
    expect(verify).not.toContain('Signer #1 certificate SHA-256 digest:');
    expect(verify).not.toContain('Signer #1 certificate DN:');
    expect(verify).toContain("grep -iE 'signer.*sha-?256.*digest'");
    expect(verify).toContain("sed -n 's/^SHA256://Ip'");
  });

  it('never strips newlines before an anchored line match', () => {
    const verify = verifyStep();
    // `tr -d '[:space:]'` deletes newlines too, folding a multi-line report into one
    // line where `^SHA256:` can never match. Blanks must be removed line by line.
    const keytoolParse = verify.slice(verify.indexOf('keytool_sha='), verify.indexOf('# ---- Reading 3'));
    expect(keytoolParse).not.toContain("tr -d '[:space:]'");
    expect(keytoolParse).toContain("sed 's/[[:blank:]]//g'");
  });

  it('compares fingerprints on normalised hex, so colons and case cannot cause a mismatch', () => {
    const verify = verifyStep();
    expect(verify).toContain("tr -cd '0-9A-Fa-f'");
    expect(verify).toContain("tr 'A-Z' 'a-z'");
    expect(verify).toContain('[ "$observed" != "$expected" ]');
  });

  it('rejects a fingerprint that is not a full SHA-256, rather than comparing a fragment', () => {
    expect(verifyStep()).toContain('[ "${#value}" -ne 64 ]');
  });

  it('detects the generic debug identity however a tool renders the subject', () => {
    const verify = verifyStep();
    // openssl 3 prints "CN = Android Debug"; keytool prints "CN=Android Debug".
    expect(verify).toContain('*cn=androiddebug*');
    expect(verify).toMatch(/subjects=.*tr -d '\[:space:\]'/s);
  });

  it('fails closed on every unreadable or unexpected outcome', () => {
    const verify = verifyStep();
    for (const failure of [
      'No APK at',
      'Expected exactly one v1 signature block',
      'Expected exactly one signing certificate',
      'malformed SHA-256 fingerprint',
      'readings disagree',
      'at least 2 independent readings are required',
      'generic Android debug identity',
      'Expected exactly one signer',
      'does not match the pinned NinFit review identity',
    ]) {
      expect(verify, `no fail-closed path for: ${failure}`).toContain(failure);
    }
    // Every one of those paths must actually stop the job.
    expect((verify.match(/exit 1/g) ?? []).length).toBeGreaterThanOrEqual(9);
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
