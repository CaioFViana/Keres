import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

const ROBOTO = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  'packages',
  'shared',
  'test',
  'fixtures',
  'fonts',
  'Roboto-Regular.ttf',
);

const ENV_KEY = 'KERES_RESOURCE_ROOT';
const previous = process.env[ENV_KEY];
let roots: string[] = [];

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots = [];
  if (previous === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = previous;
});

async function freshLoader() {
  vi.resetModules();
  const { publicationPdfFontMatrices } = await import('../../src/services/publicationPdfFonts');
  return publicationPdfFontMatrices as () => Promise<
    { regular: Uint8Array; italic: Uint8Array } | undefined
  >;
}

function rootWithFonts(): string {
  const root = mkdtempSync(join(tmpdir(), 'keres-fonts-'));
  roots.push(root);
  const dir = join(root, 'assets', 'fonts');
  mkdirSync(dir, { recursive: true });
  copyFileSync(ROBOTO, join(dir, 'NotoSerif-Variable.ttf'));
  copyFileSync(ROBOTO, join(dir, 'NotoSerif-Italic-Variable.ttf'));
  return root;
}

describe('publicationPdfFontMatrices', () => {
  it('reads both serif matrices from the resource root', async () => {
    process.env[ENV_KEY] = rootWithFonts();
    const publicationPdfFontMatrices = await freshLoader();

    const matrices = await publicationPdfFontMatrices();

    expect(matrices?.regular.length).toBeGreaterThan(0);
    expect(matrices?.italic.length).toBeGreaterThan(0);
  });

  it('resolves to undefined when the image carries no fonts, instead of throwing', async () => {
    process.env[ENV_KEY] = mkdtempSync(join(tmpdir(), 'keres-nofonts-'));
    roots.push(process.env[ENV_KEY] as string);
    const publicationPdfFontMatrices = await freshLoader();

    await expect(publicationPdfFontMatrices()).resolves.toBeUndefined();
  });
});
