import { Platform } from 'react-native';

/**
 * Which build of the client is running - the one question every "does this exist here?" check is
 * really asking.
 *
 * - `native`: the mobile apps. Official app.
 * - `desktop`: the Electron shell (`apps/desktop`). Official app.
 * - `web`: a browser build with a server behind it - the client the API serves (it can only talk to
 *   that one server) or a local web build (`expo start --web`), which behaves the same for a person.
 * - `serverless-web`: the browser build on GitHub Pages. It ships without any server feature and
 *   runs entirely on the device.
 */
export type ClientFlavor = 'native' | 'desktop' | 'web' | 'serverless-web';

/** What the Electron preload exposes to the page; its presence is how the shell is told apart. */
type DesktopBridges = { keresAuth?: unknown; keresMedia?: unknown };

/**
 * A build input (`EXPO_PUBLIC_SERVERLESS=1`, inlined by Expo at export time), never a setting - so
 * screens that exist only to talk to a server are left out of the navigators altogether instead of
 * being hidden at runtime, and nothing can navigate to them.
 */
function isServerlessBuild(): boolean {
  return process.env.EXPO_PUBLIC_SERVERLESS === '1';
}

export function getClientFlavor(): ClientFlavor {
  if (isServerlessBuild()) return 'serverless-web';
  if (Platform.OS !== 'web') return 'native';
  if (typeof window !== 'undefined') {
    const bridges = window as unknown as DesktopBridges;
    if (bridges.keresAuth || bridges.keresMedia) return 'desktop';
  }
  return 'web';
}

/** Whether this build ships without any server feature (the web client published on GitHub Pages). */
export function isServerless(): boolean {
  return getClientFlavor() === 'serverless-web';
}

/** The mobile apps and the desktop shell: the builds with no browser limits at all. */
export function isOfficialApp(flavor: ClientFlavor = getClientFlavor()): boolean {
  return flavor === 'native' || flavor === 'desktop';
}

/**
 * The web client co-hosted by the API: its HTML carries `meta[name=keres-hosted]`, which is what
 * makes it keep the session in an HttpOnly cookie and talk to the server that served it, only.
 */
export function isHostedByApi(): boolean {
  if (getClientFlavor() !== 'web' || typeof document === 'undefined') return false;
  return document.querySelector('meta[name="keres-hosted"]') !== null;
}
