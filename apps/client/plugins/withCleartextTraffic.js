const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Lets the Android app speak plain `http` - the app's own rule decides where.
 *
 * A Keres Server on the home network answers on `http://192.168.x.x:port`. Android 9+ refuses every
 * cleartext request unless the manifest allows it, and the default template allows it in debug builds
 * only: a release APK (what people install) got "network error" for an address the same app reached from a
 * dev build. The OS cannot say "private addresses only", so the restriction lives where it can:
 * `isAllowedServerUrl` accepts `http` for loopback and private-network hosts and `https` for the rest, and
 * every server address is checked against it before it is saved.
 */
module.exports = function withCleartextTraffic(config) {
  return withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0];
    if (application) application.$['android:usesCleartextTraffic'] = 'true';
    return mod;
  });
};
