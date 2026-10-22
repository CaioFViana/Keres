import { existsSync } from 'fs';
import * as path from 'path';
import {
  adminDistPath,
  clientDistPath,
  landingDistPath,
  showcaseDistPath,
  WEB_BUNDLES,
  type WebBundleName,
} from '@/config/resourceRoot';
import { logger } from '@/utils/logger';

/**
 * A web bundle the API hands out, resolved once at boot.
 *
 * The bundles are builds of other apps (`WEB_BUNDLES` says which); one that does not exist yet - dev
 * without a build, an API running on its own - does not take the server down: only its own surface is
 * unavailable, and `available` is how every route asks.
 */
export interface WebSurface {
  name: WebBundleName;
  distPath: string;
  indexPath: string;
  /** The .ico the bundle's Vite build generated from `desktop_icon.png` (png-to-ico); the client has none. */
  faviconPath: string;
  available: boolean;
}

export type WebSurfaces = Record<WebBundleName, WebSurface>;

/** Read through `resourceRoot`'s own exports, so a test that swaps one of them swaps the surface. */
const RESOLVERS: Record<WebBundleName, () => string> = {
  admin: adminDistPath,
  showcase: showcaseDistPath,
  landing: landingDistPath,
  client: clientDistPath,
};

function surfaceOf(name: WebBundleName): WebSurface {
  const distPath = RESOLVERS[name]();
  const indexPath = path.join(distPath, 'index.html');
  return {
    name,
    distPath,
    indexPath,
    faviconPath: path.join(distPath, 'favicon.ico'),
    available: existsSync(indexPath),
  };
}

export function loadWebSurfaces(): WebSurfaces {
  return {
    admin: surfaceOf('admin'),
    showcase: surfaceOf('showcase'),
    landing: surfaceOf('landing'),
    client: surfaceOf('client'),
  };
}

/** What a missing bundle takes with it, for the boot warning. The landing page is opt-in: silent when absent. */
const WHAT_IS_LOST: Record<Exclude<WebBundleName, 'landing'>, string> = {
  admin: '/admin will 404',
  showcase: 'the public site will be unavailable',
  client: '/client will not serve the web app',
};

export function warnAboutMissingSurfaces(surfaces: WebSurfaces): void {
  for (const name of Object.keys(WHAT_IS_LOST) as Array<keyof typeof WHAT_IS_LOST>) {
    if (!surfaces[name].available) {
      logger.warn(
        `${name} bundle not built - ${WHAT_IS_LOST[name]}. Run 'bun run ${WEB_BUNDLES[name].buildScript}' to enable it.`,
      );
    }
  }
}
