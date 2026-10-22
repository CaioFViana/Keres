import { Elysia } from 'elysia';
import { existsSync, readFileSync } from 'fs';
import { desktopIconPath } from '@/config/resourceRoot';
import { isApiOrLegacyApiPath } from '@/api';
import { deliverDistFile } from '@/services/static-delivery/distStaticDelivery';
import {
  HOSTED_CLIENT_PATH_PREFIX,
  hostedClientRelativePath,
  isHostedClientPath,
  isShowcasePath,
  resolveHostedClientFile,
  SHOWCASE_PATH_PREFIX,
} from '@/services/static-delivery/hostedClient';
import {
  hostedClientDelivery,
  hostedClientDeliveryInput,
} from '@/services/static-delivery/hostedClientDelivery';
import { sendStaticDelivery } from '@/services/static-delivery/staticDelivery';
import {
  applyAdminUiSecurityHeaders,
  applyClientAppIsolationHeaders,
} from '@/services/static-delivery/uiSecurityHeaders';
import { showcaseSettingsService } from '@/services/showcase/ShowcaseSettingsService';
import type { WebSurface, WebSurfaces } from './webSurfaces';

type Reply = { status?: number | string; headers: Record<string, string | number> };
type Served = Uint8Array | string | Response | { message: string };

const NOT_FOUND = { message: 'Not found' };

function notFound(set: Reply): { message: string } {
  set.status = 404;
  return NOT_FOUND;
}

function redirect(set: Reply, location: string): void {
  set.status = 302;
  set.headers.location = location;
}

/** An HTML entry page, with the headers every co-hosted page carries. */
function servePage(set: Reply, surface: WebSurface): string {
  applyAdminUiSecurityHeaders(set);
  set.headers['content-type'] = 'text/html; charset=utf-8';
  // Node/Vitest has no `Bun.file`; the HTML is tiny so a sync read is fine.
  return readFileSync(surface.indexPath, 'utf8');
}

/**
 * The admin panel: a file of its build, or - for a route of the panel that is not a file (say,
 * /admin/users, which React Router resolves in the browser) - the same index.html. Without that
 * fallback an F5 on /admin/users would give a 404.
 *
 * Shared by `/admin` and `/admin/*`: the router sees them as two paths, and only one of them used to be
 * registered, so `/admin` fell to the catch-all and was sent to the root while `/admin/` opened the panel.
 */
async function serveAdminUi(
  admin: WebSurface,
  set: Reply,
  request: Request,
  requestPath: string,
): Promise<Served> {
  // Do not let the removed `/admin/api/*` contract become a 200 with index.html.
  if (requestPath === '/admin/api' || requestPath.startsWith('/admin/api/')) {
    return notFound(set);
  }
  if (!admin.available) {
    set.status = 404;
    return { message: "Admin UI not built. Run 'bun run build' in apps/api first." };
  }
  applyAdminUiSecurityHeaders(set);
  // A file of the build (compressed and cacheable, see `StaticDelivery`)...
  const file = await deliverDistFile(admin.distPath, requestPath.slice('/admin'.length), request);
  if (file) return sendStaticDelivery(set, file);
  // ...otherwise, the SPA fallback.
  return servePage(set, admin);
}

/**
 * The hosted client: its entry page and everything it loads, all under `/client`. The entry is what the
 * administrator can switch off (`isHostedClientEnabled`); the assets it asks for are served regardless,
 * as they always were - without the entry nobody asks for them, and a database query per asset would be
 * a poor trade.
 */
async function serveHostedClient(
  client: WebSurface,
  set: Reply,
  request: Request,
): Promise<Served> {
  if (!client.available) {
    return notFound(set);
  }
  const resolved = resolveHostedClientFile(
    client.distPath,
    hostedClientRelativePath(new URL(request.url).pathname),
  );
  if (!resolved) {
    return notFound(set);
  }
  // The same default as the root had: on while the database is starting up or is down.
  if (resolved.html && !(await showcaseSettingsService.isHostedClientEnabled().catch(() => true))) {
    return notFound(set);
  }
  const delivery = await hostedClientDelivery.deliver({
    ...hostedClientDeliveryInput(client.distPath, resolved.filePath, resolved.html),
    request: {
      acceptEncoding: request.headers.get('accept-encoding'),
      ifNoneMatch: request.headers.get('if-none-match'),
    },
  });
  applyClientAppIsolationHeaders(set);
  return sendStaticDelivery(set, delivery);
}

/**
 * The static files of a bundle whose pages live elsewhere, under the prefix Vite built them for. The
 * showcase and the landing page are served that way: mounting their files directly at `/` would make
 * them shadow the API routes, so the pages are served at `/showcase` and `/`, and only what the pages
 * load comes from here.
 */
function prefixedStatics(surface: WebSurface, prefix: string) {
  return async ({
    set,
    request,
    path: requestPath,
  }: {
    set: Reply;
    request: Request;
    path: string;
  }) => {
    const file = surface.available
      ? await deliverDistFile(surface.distPath, requestPath.slice(prefix.length), request)
      : null;
    if (!file) {
      return notFound(set);
    }
    return sendStaticDelivery(set, file);
  };
}

/** The landing page for one of its own paths (`/terms`, `/privacy`): only while the landing is built and switched on. */
async function serveLandingDocument(landing: WebSurface, set: Reply): Promise<Served> {
  const settings = await showcaseSettingsService.getOrCreate().catch(() => null);
  if (landing.available && (settings?.isLandingEnabled ?? false)) {
    return servePage(set, landing);
  }
  return notFound(set);
}

/**
 * What answers before the API's routes: the root, the hosted client and the favicon.
 *
 * The root resolves in order: the landing page when the administrator enabled it, the hosted client at
 * /client, the showcase, and finally the API docs. Each step needs both its build and its switch - an
 * enabled page whose bundle was never built falls through to the next, so the root always answers with
 * something useful. It has never depended on the database: while it is starting up or is down, the
 * defaults (landing off, client on) apply rather than trading a useful page for a 503.
 */
export function webEntryRoutes(surfaces: WebSurfaces) {
  const { admin, showcase, landing, client } = surfaces;
  /** Fallback before any build exists - the same PNG desktop uses, not copied into the apps. */
  const desktopIconFilePath = desktopIconPath();

  return (
    new Elysia()
      .get(
        '/',
        async ({ set }) => {
          const settings = await showcaseSettingsService.getOrCreate().catch(() => null);
          const landingEnabled = settings?.isLandingEnabled ?? false;
          const hostedClientEnabled = settings?.isHostedClientEnabled ?? true;
          if (landing.available && landingEnabled) {
            return servePage(set, landing);
          }
          if (client.available && hostedClientEnabled) {
            return redirect(set, `${HOSTED_CLIENT_PATH_PREFIX}/`);
          }
          if (showcase.available && (await showcaseSettingsService.isEnabled())) {
            return redirect(set, SHOWCASE_PATH_PREFIX);
          }
          return redirect(set, '/api/swagger');
        },
        {
          detail: {
            summary: 'Origin root (landing, hosted client, showcase or Swagger)',
            description:
              'Serves the landing page when enabled, else redirects to the hosted web client at /client, the showcase, or the API docs.',
            tags: ['Client'],
          },
        },
      )
      // `/client` and `/client/` are one path to the router, so there is no redirect between them: it
      // would answer itself forever. The entry is the same either way.
      .get('/client', ({ set, request }) => serveHostedClient(client, set, request), {
        detail: { summary: 'Hosted Keres client (entry)', tags: ['Client'] },
      })
      .get('/client/*', ({ set, request }) => serveHostedClient(client, set, request), {
        detail: {
          summary: 'Hosted Keres client',
          description:
            'Serves the web export of apps/client built for /client (KERES_WEB_BASE_URL), with COOP/COEP so expo-sqlite can use SharedArrayBuffer. A path with no file falls back to the entry page.',
          tags: ['Client'],
        },
      })
      // The landing's own pages - the server's terms and its privacy policy. They are the landing's single page, which
      // reads its path and shows the document; with no landing there is no such page, so they answer 404 instead of
      // sending the visitor somewhere that does not say what they asked for.
      .get('/terms', ({ set }) => serveLandingDocument(landing, set), {
        detail: {
          summary: 'Terms of service page of the landing',
          description:
            'The landing page, opened on the terms. 404 while the landing is off or not built.',
          tags: ['Client'],
        },
      })
      .get('/privacy', ({ set }) => serveLandingDocument(landing, set), {
        detail: {
          summary: 'Privacy policy page of the landing',
          description:
            'The landing page, opened on the privacy policy. 404 while the landing is off or not built.',
          tags: ['Client'],
        },
      })
      .get(
        '/favicon.ico',
        ({ set }) => {
          // The panel, the public site and the landing page generate the same .ico, from the same
          // PNG - any one works. Looking in all keeps the tab from having no icon on a server that
          // only built one of them; the client's PNG is the last resort, for when no build exists yet.
          const generatedIcoPath = [admin, showcase, landing]
            .map((surface) => surface.faviconPath)
            .find((candidate) => existsSync(candidate));
          const filePath = generatedIcoPath ?? desktopIconFilePath;
          if (!existsSync(filePath)) {
            return notFound(set);
          }
          set.headers['content-type'] = generatedIcoPath ? 'image/x-icon' : 'image/png';
          set.headers['cache-control'] = 'public, max-age=86400';
          // `readFileSync` instead of `Bun.file`: this route is hit by the Node/Vitest suite
          // (`kerescheck.test.ts`) as well as Bun in production. The file is a few KB.
          return new Uint8Array(readFileSync(filePath));
        },
        {
          detail: {
            summary: 'Favicon',
            description:
              'Serves the ICO generated at web build time from apps/client desktop_icon.png (same source as apps/desktop).',
            tags: ['Admin'],
          },
        },
      )
  );
}

/**
 * What answers after the API's routes: the panel, the showcase's pages and files, the landing page's
 * files and the fallback to the root. Registered last so none of it can shadow an API route.
 */
export function webPageRoutes(surfaces: WebSurfaces) {
  const { admin, showcase, landing, client } = surfaces;

  const serveShowcase = async ({ set }: { set: Reply }) => {
    if (!showcase.available || !(await showcaseSettingsService.isEnabled())) {
      return notFound(set);
    }
    return servePage(set, showcase);
  };

  return (
    new Elysia()
      .onAfterHandle(({ request, set }) => {
        const pathname = new URL(request.url).pathname;
        if (isHostedClientPath(pathname)) {
          applyClientAppIsolationHeaders(set);
          return;
        }
        if (
          pathname.startsWith('/admin') ||
          isShowcasePath(pathname) ||
          pathname.startsWith('/_showcase') ||
          pathname.startsWith('/_landing')
        ) {
          applyAdminUiSecurityHeaders(set);
        }
      })
      // No compatibility shim: before the panel fallback could return its HTML, the old
      // administrative endpoints receive the same JSON 404 as any removed API route.
      .all('/admin/api', ({ set }) => notFound(set))
      .all('/admin/api/*', ({ set }) => notFound(set))
      .get(
        '/admin',
        ({ set, request, path: requestPath }) => serveAdminUi(admin, set, request, requestPath),
        {
          detail: {
            summary: 'Admin panel (single-page app, entry without the slash)',
            tags: ['Admin'],
          },
        },
      )
      .get(
        '/admin/*',
        ({ set, request, path: requestPath }) => serveAdminUi(admin, set, request, requestPath),
        {
          detail: {
            summary: 'Admin panel (single-page app)',
            description: 'Serves the built apps/web SPA and its client-side routes.',
            tags: ['Admin'],
          },
        },
      )
      .get('/app', ({ set }) => redirect(set, '/'), {
        detail: {
          summary: 'Legacy hosted-client path',
          description:
            'The web client used to live at /app, and then at the root; it is under /client now.',
          tags: ['Client'],
        },
      })
      .get('/app/*', ({ set }) => redirect(set, '/'), {
        detail: { summary: 'Legacy hosted-client path', tags: ['Client'] },
      })
      .get('/showcase', serveShowcase, {
        detail: {
          summary: 'Public showcase',
          description: 'Lists stories published on this server.',
          tags: ['Showcase'],
        },
      })
      .get('/showcase/*', serveShowcase, {
        detail: { summary: 'Public showcase (SPA fallback)', tags: ['Showcase'] },
      })
      // Their pages are served at the root and at /showcase; only what they load comes from here.
      .get('/_showcase/*', prefixedStatics(showcase, '/_showcase'), {
        detail: { summary: 'Showcase static files', tags: ['Showcase'] },
      })
      .get('/_landing/*', prefixedStatics(landing, '/_landing'), {
        detail: { summary: 'Landing page static files', tags: ['Client'] },
      })
      // A path nobody answers - an old bookmark, a stale reload - goes back to the root, which sends it
      // on. The API, /showcase, /client and /_landing were already registered above.
      .get(
        '/*',
        ({ set, path: requestPath }) => {
          if (isApiOrLegacyApiPath(requestPath) || !client.available) {
            return notFound(set);
          }
          return redirect(set, '/');
        },
        {
          detail: {
            summary: 'Fallback to the root',
            description: 'Unknown non-API paths redirect to /.',
            tags: ['Client'],
          },
        },
      )
  );
}
