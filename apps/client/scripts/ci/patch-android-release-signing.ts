// Patches the release build's signing config in the Expo-prebuild-generated
// android/app/build.gradle. Expo's own template ships `release { signingConfig
// signingConfigs.debug }` by default (see the "Caution!" comment the template itself leaves in
// place) - fine for `expo run:android`, never fine for anything actually distributed. This
// rewires the release build type to a real `release` signingConfig, backed by a keystore and
// passwords supplied via Gradle properties (never hardcoded here) - see
// .github/workflows/release.yml's "mobile-android" job for how those properties get populated
// from GitHub secrets at build time.
//
// Must run from apps/client, AFTER `expo prebuild --platform android` (the file doesn't exist
// before that) and BEFORE `./gradlew bundleRelease`/`assembleRelease`.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const gradlePath = join(process.cwd(), 'android', 'app', 'build.gradle');
let contents = readFileSync(gradlePath, 'utf8');

const debugSigningConfigBlock = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }`;

if (!contents.includes(debugSigningConfigBlock)) {
  console.error(
    'patch-android-release-signing: expected signingConfigs block not found in android/app/build.gradle - ' +
      'the Expo prebuild template must have changed shape. Update this script to match before continuing ' +
      '(do NOT skip this check - it exists specifically so a release build never silently ships debug-signed).',
  );
  process.exit(1);
}

const patchedSigningConfigBlock = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            if (project.hasProperty('RELEASE_STORE_FILE')) {
                storeFile file(RELEASE_STORE_FILE)
                storePassword RELEASE_STORE_PASSWORD
                keyAlias RELEASE_KEY_ALIAS
                keyPassword RELEASE_KEY_PASSWORD
            }
        }
    }`;

contents = contents.replace(debugSigningConfigBlock, patchedSigningConfigBlock);

const releaseUsesDebugSigning = `        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`;

if (!contents.includes(releaseUsesDebugSigning)) {
  console.error(
    'patch-android-release-signing: expected release buildType block not found in android/app/build.gradle - ' +
      'the Expo prebuild template must have changed shape. Update this script to match before continuing.',
  );
  process.exit(1);
}

contents = contents.replace(
  releaseUsesDebugSigning,
  `        release {
            signingConfig signingConfigs.release`,
);

writeFileSync(gradlePath, contents);
console.log(
  'Patched android/app/build.gradle: release builds now sign with signingConfigs.release.',
);
