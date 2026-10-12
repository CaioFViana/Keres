/**
 * The Android release patchwork: `expo prebuild` recreates `android/` fresh from
 * `app.json` on every release build, so whatever the store demands that prebuild
 * does not emit (a Play-style versionCode, a signing config fed by CI secrets) is
 * stamped afterwards, by the release workflow only. CI never touches it.
 */

export const ANDROID_PACKAGE = 'me.keres.client';
export const ANDROID_BUILD_GRADLE = 'apps/client/android/app/build.gradle';

/**
 * A Play versionCode from the tag: MAJOR·1.000.000 + MINOR·1.000 + PATCH. Plain
 * arithmetic, so any newer tag is always a bigger number - which is the only
 * thing the Play Console demands. Pre-releases are refused: a `-dev1` tag would
 * otherwise stamp the same code as its release and collide on upload.
 */
export function versionCodeFor(version: string): number {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    throw new Error(
      `Android versionCode needs a plain MAJOR.MINOR.PATCH version, got ${JSON.stringify(version)}.`,
    );
  }
  const code = Number(match[1]) * 1_000_000 + Number(match[2]) * 1_000 + Number(match[3]);
  if (code <= 0 || code > 2_100_000_000) {
    throw new Error(`Android versionCode ${code} is out of the Play range for ${version}.`);
  }
  return code;
}

/**
 * Stamps `versionCode`/`versionName` into the `defaultConfig` that `expo prebuild`
 * emitted. Fails loudly when the package is not ours or the anchors are gone, so
 * a template change breaks the release instead of shipping a store reject.
 */
export function patchGradleVersion(source: string, version: string): string {
  if (!source.includes(ANDROID_PACKAGE)) {
    throw new Error(
      `Expected the Android package ${ANDROID_PACKAGE} in ${ANDROID_BUILD_GRADLE}; refusing to stamp a foreign project.`,
    );
  }
  if (!/versionCode \d+/.test(source) || !/versionName "[^"]*"/.test(source)) {
    throw new Error(
      `Could not find versionCode/versionName in ${ANDROID_BUILD_GRADLE}; the Expo template moved them.`,
    );
  }
  return source
    .replace(/versionCode \d+/, `versionCode ${versionCodeFor(version)}`)
    .replace(/versionName "[^"]*"/, `versionName "${version}"`);
}

const SIGNING_MARKER = 'scripts/ci/patch-android-release-signing.ts';

/**
 * A `signingConfigs.release` fed by the workflow's `-PRELEASE_*` Gradle properties
 * (keystore decoded from secrets), wired into `buildTypes.release`. Appended as a
 * second `android {}` block - Gradle merges them - so Expo template drift cannot
 * break the match: the only anchor is the marker comment, which also makes the
 * patch idempotent. Every property read is guarded, so a local build without the
 * secrets keeps assembling debug exactly as before.
 */
export function applySigningPatch(source: string): string {
  if (source.includes(SIGNING_MARKER)) return source;
  return (
    `${source.replace(/\s*$/, '')}\n\n` +
    `// Added by ${SIGNING_MARKER} (release workflow): the release keystore arrives\n` +
    `// as -PRELEASE_* project properties; without them this block is inert.\n` +
    `android {\n` +
    `    signingConfigs {\n` +
    `        release {\n` +
    `            if (project.hasProperty('RELEASE_STORE_FILE')) {\n` +
    `                storeFile file(String.valueOf(project.property('RELEASE_STORE_FILE')))\n` +
    `                storePassword String.valueOf(project.property('RELEASE_STORE_PASSWORD'))\n` +
    `                keyAlias String.valueOf(project.property('RELEASE_KEY_ALIAS'))\n` +
    `                keyPassword String.valueOf(project.property('RELEASE_KEY_PASSWORD'))\n` +
    `            }\n` +
    `        }\n` +
    `    }\n` +
    `    buildTypes {\n` +
    `        release {\n` +
    `            if (project.hasProperty('RELEASE_STORE_FILE')) {\n` +
    `                signingConfig signingConfigs.release\n` +
    `            }\n` +
    `        }\n` +
    `    }\n` +
    `}\n`
  );
}
