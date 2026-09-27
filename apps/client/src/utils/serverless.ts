/**
 * Whether this build ships without any server feature: the web client published on GitHub Pages,
 * which runs entirely on the device. A build input (`EXPO_PUBLIC_SERVERLESS=1`, inlined by Expo at
 * export time), never a setting - so screens that exist only to talk to a server are left out of the
 * navigators altogether instead of being hidden at runtime, and nothing can navigate to them.
 */
export function isServerless(): boolean {
  return process.env.EXPO_PUBLIC_SERVERLESS === '1';
}
