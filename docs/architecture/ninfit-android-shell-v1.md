# NinFit Installed Android Shell v1

**Status:** Capacitor 8 Android project generated and configured. **Never compiled** — see §6.
**Application id:** `app.ninfit.mobile` (permanent — see §2).
**Provider decision:** `docs/architecture/journey-native-provider-selection-v1.md`.

## 1. What this slice is

The smallest honest step from "NinFit is a web app" to "NinFit is an app you install":
Capacitor 8, the Android platform project, and the configuration decisions that project
forces. It adds no location capability, asks for no new permission, and changes no
runtime behaviour of the web application.

The background-location provider, the foreground service, its permissions and the bridge
that satisfies `NativeJourneyLocationBridge` are the **next** slice. Splitting them means
the first Android build to run on the Samsung proves one thing — that the existing UI
installs and runs unchanged — instead of failing for one of six possible reasons.

## 2. Application id

`app.ninfit.mobile`, chosen deliberately on 2026-09-08 and permanent from here.

It appears in four files that must agree: `capacitor.config.ts`, `android/app/build.gradle`
(`applicationId` and `namespace`) and `android/app/src/main/res/values/strings.xml`.
`src/test/androidShellContract.test.ts` pins all four. It cannot be changed once a Play
listing exists or a background-location licence key has been issued against it.

## 3. Web-layer configuration

- `webDir: 'dist'` — the shell ships the same Vite build as the web app. There is no
  separate mobile bundle and no second product.
- `androidScheme: 'https'` — the WebView origin must be a secure context. Geolocation,
  the Screen Wake Lock API and service workers all refuse to run outside one, and all
  three are load-bearing for Journey recording.
- `allowMixedContent: false` — a shell that tolerated a broken certificate chain would be
  weaker than the browser the same code already runs in.

`base: './'` in `vite.config.ts` was already correct for this, and hash routing needs no
change.

## 4. Backup posture

`android:allowBackup="false"`, `android:fullBackupContent="false"`, and a
`data_extraction_rules.xml` that excludes `domain="root"` from **both** `cloud-backup` and
`device-transfer`.

Every Journey, including its precise route, lives in this WebView's local storage. Android
Auto Backup would copy that to the user's Google Drive with no NinFit consent step and no
way for the product to state what left the device — which contradicts the local-first
contract and the no-route-upload rule. `allowBackup` alone does not cover the Android 12+
device-to-device transfer path, which is why the extraction rules are there too.

This does not weaken NinFit's own backup: Settings still exports and restores a file the
user chose to create. What it removes is the automatic invisible copy. **The cost is
real and must be said in beta comms:** a phone-to-phone migration will not carry Journey
history, so a beta user changing device must export first. Reversing this is a product and
privacy decision, not a configuration tweak.

## 5. Repository policy touched

`.gitattributes` gained the exception its own comment reserved: `*.bat`/`*.cmd` are
`eol=crlf`, and `*.jar`, `*.keystore`, `*.jks` are `binary`. The Android shell brings the
repository's first Windows batch file (`gradlew.bat`, executed by `cmd.exe`) and its first
JAR (`gradle/wrapper/gradle-wrapper.jar`, which a text conversion would corrupt beyond
recovery). `android/gradlew` is tracked mode `100755`.

The Capacitor template's `com.getcapacitor.myapp` example tests were deleted rather than
kept: the instrumented one asserts the package name is `com.getcapacitor.app`, so it was
boilerplate that would fail if it were ever run.

## 6. What has NOT been proven

**The Android project has never been compiled.** The cloud container has Java 21 and
Gradle but no Android SDK, and its egress policy blocks `dl.google.com`,
`repo1.maven.org` and `services.gradle.org`, so no Gradle build or SDK install is possible
there. Nothing in this slice is evidence that the app builds, installs or launches.

The first Gradle build is a human step, in Android Studio on the Windows machine:

```powershell
cd C:\Users\thoma\fitness-tracker
npm install
npm run build
npx cap sync android
npx cap open android
```

Then Build → Make Project, and Run on the Samsung with USB debugging on. What that proves,
and all it proves, is §1: the existing UI installs and runs unchanged.

## 7. Verification held by tests

`src/test/androidShellContract.test.ts` pins the application id across all four files, the
`dist`/`https`/no-mixed-content web configuration, both backup exclusions, the Capacitor 8
version line, and — deliberately — that the manifest still requests **only** `INTERNET`.
That last one is the guard that makes the next slice honest: a location or foreground
service permission cannot appear without the code that justifies it and a test that says so.

## 8. Non-goals

NinFit launcher icon and splash art (the Capacitor defaults are in place and are a separate
art slice), release signing and a keystore, Play listing metadata, iOS, and any location
capability whatsoever.
