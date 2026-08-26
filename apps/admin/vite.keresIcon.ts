import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import pngToIco from 'png-to-ico';
import type { Plugin } from 'vite';

/**
 * The Keres icon, for both web apps in this project.
 *
 * There is a single source - `apps/client/assets/images/desktop_icon.png`, the same one
 * electron-builder converts into the desktop app's icon. Nothing is copied into `apps/admin`: the
 * panel already generated its `favicon.ico` from it at build time, and the public site does the
 * same, plus a scaled-down version for the wordmark in the header and the footer.
 *
 * Generating instead of committing a copy keeps one truth: changing the icon artwork in the
 * client updates the site's favicon and wordmark on the next build, with nobody having to
 * remember to regenerate any file.
 */

const adminDirectory = path.dirname(fileURLToPath(import.meta.url));

export const KERES_ICON_SOURCE = path.resolve(
  adminDirectory,
  '..',
  'client',
  'assets',
  'images',
  'desktop_icon.png',
);

/**
 * Side of the wordmark used on the pages. The original is 1024px and almost 900 KB - weight that
 * does not pay off for a logo drawn at 28px in the header. 128px covers high-density screens (4x
 * in the header, almost 6x in the footer) for a fraction of the bytes.
 */
const LOGO_SIZE = 128;

/** The canonical list of avatar icons, shared with the app and the API. */
const AVATAR_ICON_NAMES_SOURCE = path.resolve(
  adminDirectory,
  '..',
  '..',
  'packages',
  'shared',
  'metadata',
  'avatarIcons.json',
);

/**
 * Downscales a square PNG by block averaging.
 *
 * The average is computed with premultiplied alpha: without that, the colour of fully transparent
 * pixels (which in a PNG can be anything, black included) enters the sum and leaves a dark halo
 * around the artwork's edge - very visible on a cut-out logo like this one.
 */
function downscaleSquarePng(source: Buffer, size: number): Buffer {
  const image = PNG.sync.read(source);
  if (image.width === size && image.height === size) {
    return source;
  }

  const output = new PNG({ width: size, height: size });
  const blockX = image.width / size;
  const blockY = image.height / size;

  for (let y = 0; y < size; y++) {
    const fromY = Math.floor(y * blockY);
    const toY = Math.min(image.height, Math.ceil((y + 1) * blockY));

    for (let x = 0; x < size; x++) {
      const fromX = Math.floor(x * blockX);
      const toX = Math.min(image.width, Math.ceil((x + 1) * blockX));

      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 0;
      let samples = 0;

      for (let sourceY = fromY; sourceY < toY; sourceY++) {
        for (let sourceX = fromX; sourceX < toX; sourceX++) {
          const index = (image.width * sourceY + sourceX) << 2;
          const pixelAlpha = image.data[index + 3] / 255;
          red += image.data[index] * pixelAlpha;
          green += image.data[index + 1] * pixelAlpha;
          blue += image.data[index + 2] * pixelAlpha;
          alpha += pixelAlpha;
          samples += 1;
        }
      }

      const target = (size * y + x) << 2;
      if (alpha === 0) {
        output.data[target] = 0;
        output.data[target + 1] = 0;
        output.data[target + 2] = 0;
        output.data[target + 3] = 0;
        continue;
      }
      // Undoes the premultiplication: colour goes back to being colour, and alpha becomes the average
      // of the samples.
      output.data[target] = Math.round(red / alpha);
      output.data[target + 1] = Math.round(green / alpha);
      output.data[target + 2] = Math.round(blue / alpha);
      output.data[target + 3] = Math.round((alpha / samples) * 255);
    }
  }

  return PNG.sync.write(output);
}

/**
 * Builds a multi-size `favicon.ico` (16/24/32/48/64) from the desktop PNG, the same idea as
 * electron-builder converting that file to .ico.
 *
 * `devUrls` are the paths the development server has to answer - the panel runs under `/admin/`,
 * the site at the root, and each asks for the favicon under its own prefix.
 */
export function keresFavicon(devUrls: string[] = ['/favicon.ico']): Plugin {
  let icoPromise: Promise<Buffer> | null = null;
  const ico = () => {
    icoPromise ??= pngToIco(KERES_ICON_SOURCE);
    return icoPromise;
  };

  return {
    name: 'keres-favicon',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0];
        if (!url || !devUrls.includes(url)) {
          next();
          return;
        }
        ico()
          .then((buffer) => {
            res.setHeader('Content-Type', 'image/x-icon');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.end(buffer);
          })
          .catch(next);
      });
    },
    async generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'favicon.ico', source: await ico() });
    },
  };
}

/** The virtual module with the avatar icons' artwork. */
export const KERES_AVATAR_ICONS_MODULE_ID = 'virtual:keres-avatar-icons';
const RESOLVED_AVATAR_ICONS_MODULE_ID = `\0${KERES_AVATAR_ICONS_MODULE_ID}`;

/**
 * The inner content of the Ionicons SVGs, only for the icons a person can choose as an avatar
 * (`AVATAR_ICON_OPTIONS`).
 *
 * Cut out at build time instead of shipping the whole Ionicons font: 28 drawings against 1357
 * glyphs, a few KB against ~380 KB. The outer `<svg>` is discarded because the component builds
 * its own, with the size and colour it needs.
 */
async function buildAvatarIconPaths(): Promise<Record<string, string>> {
  const { readFile } = await import('node:fs/promises');
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  // Resolved through the main entry point rather than `ionicons/package.json`: the package declares
  // `exports` and does not expose its package.json as a subpath. `dist/index.js` -> `dist/svg`.
  const iconDirectory = path.join(path.dirname(require.resolve('ionicons')), 'svg');

  // Read from the `.json` rather than imported from `@keres/shared`: this file runs in Node, which
  // does not load that package's `.ts` files (it is consumed as source, by bundlers).
  const iconNames: string[] = JSON.parse(await readFile(AVATAR_ICON_NAMES_SOURCE, 'utf8'));

  const entries = await Promise.all(
    iconNames.map(async (name) => {
      const markup = await readFile(path.join(iconDirectory, `${name}.svg`), 'utf8');
      const inner = markup.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
      return [name, inner.trim()] as const;
    }),
  );
  return Object.fromEntries(entries);
}

/**
 * Publishes the avatar icons as `virtual:keres-avatar-icons`.
 *
 * The SVGs come from the `ionicons` package, which is the same source of artwork that the app's
 * `@expo/vector-icons` bundles as a font - so the avatar on the site is the same drawing the
 * person picked in the application, not an approximation.
 */
export function keresAvatarIcons(): Plugin {
  let iconsPromise: Promise<Record<string, string>> | null = null;

  return {
    name: 'keres-avatar-icons',
    resolveId(id) {
      return id === KERES_AVATAR_ICONS_MODULE_ID ? RESOLVED_AVATAR_ICONS_MODULE_ID : null;
    },
    async load(id) {
      if (id !== RESOLVED_AVATAR_ICONS_MODULE_ID) {
        return null;
      }
      iconsPromise ??= buildAvatarIconPaths();
      return `export default ${JSON.stringify(await iconsPromise)};`;
    },
  };
}

/** The virtual module the pages import to get the wordmark's URL. */
export const KERES_LOGO_MODULE_ID = 'virtual:keres-logo';
const RESOLVED_LOGO_MODULE_ID = `\0${KERES_LOGO_MODULE_ID}`;
/** Path served in development, where no asset is emitted. */
const DEV_LOGO_URL = '/keres-logo.png';

/**
 * Publishes the scaled-down wordmark as `virtual:keres-logo`, whose default export is the image's URL.
 *
 * A virtual module rather than a directly imported file because the image does not exist on disk
 * inside `apps/admin` - it is derived from the client's icon at build time.
 */
export function keresLogo(): Plugin {
  let logoPromise: Promise<Buffer> | null = null;
  const logo = async () => {
    logoPromise ??= (async () => {
      const { readFile } = await import('node:fs/promises');
      return downscaleSquarePng(await readFile(KERES_ICON_SOURCE), LOGO_SIZE);
    })();
    return logoPromise;
  };

  let isServing = false;

  return {
    name: 'keres-logo',
    configResolved(config) {
      isServing = config.command === 'serve';
    },
    resolveId(id) {
      return id === KERES_LOGO_MODULE_ID ? RESOLVED_LOGO_MODULE_ID : null;
    },
    async load(id) {
      if (id !== RESOLVED_LOGO_MODULE_ID) {
        return null;
      }
      if (isServing) {
        return `export default ${JSON.stringify(DEV_LOGO_URL)};`;
      }
      const referenceId = this.emitFile({
        type: 'asset',
        name: 'keres-logo.png',
        source: await logo(),
      });
      // Vite rewrites this into the final URL with the app's `base` already applied.
      return `export default import.meta.ROLLUP_FILE_URL_${referenceId};`;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== DEV_LOGO_URL) {
          next();
          return;
        }
        logo()
          .then((buffer) => {
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.end(buffer);
          })
          .catch(next);
      });
    },
  };
}
