import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import pngToIco from 'png-to-ico';
import type { Plugin } from 'vite';

/**
 * The landing page's favicon and wordmark, from the same PNG the desktop app and the admin
 * panel already use.
 *
 * There is a single source - `apps/client/assets/images/desktop_icon.png`. Generating instead
 * of committing a copy keeps one truth: changing the icon in the client updates the landing
 * page's favicon and wordmark on the next build.
 */

const siteDirectory = path.dirname(fileURLToPath(import.meta.url));

export const KERES_ICON_SOURCE = path.resolve(
  siteDirectory,
  '..',
  'client',
  'assets',
  'images',
  'desktop_icon.png',
);

const LOGO_SIZE = 128;

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
      output.data[target] = Math.round(red / alpha);
      output.data[target + 1] = Math.round(green / alpha);
      output.data[target + 2] = Math.round(blue / alpha);
      output.data[target + 3] = Math.round((alpha / samples) * 255);
    }
  }

  return PNG.sync.write(output);
}

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

export const KERES_LOGO_MODULE_ID = 'virtual:keres-logo';
const RESOLVED_LOGO_MODULE_ID = `\0${KERES_LOGO_MODULE_ID}`;
const DEV_LOGO_URL = '/keres-logo.png';

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
