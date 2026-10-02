import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

/**
 * Makes `assets/images/desktop_icon_512.png` from `desktop_icon.png`.
 *
 * The original is 1024 px and 865 KB: it is what electron-builder turns into the app's icon, and what the
 * admin panel and the site generate their favicon from. The settings screen draws it at 256 px at most,
 * so on the web it downloaded 865 KB to show a quarter of its pixels. 512 px covers a 2x screen; the
 * file is a third of the size.
 *
 *   bun scripts/make-brand-icon.ts
 *
 * Block averaging with premultiplied alpha - the same downscale as the panel's and the site's favicons: without
 * it the colour of fully transparent pixels (anything, in a PNG) bleeds into the artwork's edge as a dark halo.
 */
const SIZE = 512;
const imagesDirectory = join(
  resolve(dirname(fileURLToPath(import.meta.url)), '..'),
  'assets',
  'images',
);

export function downscaleSquarePng(source: Buffer, size: number): Buffer {
  const image = PNG.sync.read(source);
  if (image.width === size && image.height === size) return source;
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
      if (alpha === 0) continue; // the buffer starts transparent black
      output.data[target] = Math.round(red / alpha);
      output.data[target + 1] = Math.round(green / alpha);
      output.data[target + 2] = Math.round(blue / alpha);
      output.data[target + 3] = Math.round((alpha / samples) * 255);
    }
  }
  return PNG.sync.write(output, { deflateLevel: 9 });
}

if (import.meta.main) {
  const target = join(imagesDirectory, `desktop_icon_${SIZE}.png`);
  const result = downscaleSquarePng(readFileSync(join(imagesDirectory, 'desktop_icon.png')), SIZE);
  writeFileSync(target, result);
  console.log(`[brand-icon] ${target}: ${(result.length / 1024).toFixed(0)} KB`);
}
