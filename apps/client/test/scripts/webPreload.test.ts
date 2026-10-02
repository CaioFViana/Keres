/**
 * @jest-environment node
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  applyCanvasKitPreload,
  exportBasePath,
  findCanvasKitWasm,
  injectCanvasKitPreload,
} from '../../scripts/lib/webPreload';

const WASM = 'canvaskit.d614134b66b587cafc440b5d8d238717.wasm';

const htmlFor = (base: string) =>
  `<html><head><title>Keres</title></head><body><script src="${base}/_expo/static/js/web/index-cd2f273f.js" defer></script></body></html>`;

function makeExport() {
  const directory = mkdtempSync(join(tmpdir(), 'keres-export-'));
  const wasmDirectory = join(
    directory,
    'assets',
    '__node_modules',
    'canvaskit-wasm',
    'bin',
    'full',
  );
  mkdirSync(wasmDirectory, { recursive: true });
  writeFileSync(join(wasmDirectory, WASM), 'wasm');
  return directory;
}

describe('findCanvasKitWasm', () => {
  it('finds the hashed file the export made, as a path from the site root', () => {
    expect(findCanvasKitWasm(makeExport())).toBe(
      `/assets/__node_modules/canvaskit-wasm/bin/full/${WASM}`,
    );
  });

  it('finds nothing in an export without it', () => {
    expect(findCanvasKitWasm(mkdtempSync(join(tmpdir(), 'keres-empty-')))).toBeNull();
  });
});

describe('exportBasePath', () => {
  it.each([
    ['', ''],
    ['/client', '/client'],
    ['/Keres/client', '/Keres/client'],
  ])('reads the prefix %j from where the export put it', (base, expected) => {
    expect(exportBasePath(htmlFor(base))).toBe(expected);
  });

  it('says so when the page has no entry script', () => {
    expect(exportBasePath('<html><head></head></html>')).toBeNull();
  });
});

describe('injectCanvasKitPreload', () => {
  it('asks for the file with the page, the way CanvasKit fetches it', () => {
    const html = injectCanvasKitPreload(
      '<html><head></head><body></body></html>',
      '/client/a.wasm',
    );

    expect(html).toContain(
      '<link rel="preload" href="/client/a.wasm" as="fetch" type="application/wasm" crossorigin="anonymous">',
    );
    expect(html.indexOf('rel="preload"')).toBeLessThan(html.indexOf('</head>'));
  });

  it('does nothing twice', () => {
    const once = injectCanvasKitPreload('<head></head>', '/a.wasm');

    expect(injectCanvasKitPreload(once, '/a.wasm')).toBe(once);
  });
});

describe('applyCanvasKitPreload', () => {
  it.each(['', '/client', '/Keres/client'])(
    'points at the URL the app will ask for under the prefix %j',
    (base) => {
      const result = applyCanvasKitPreload(htmlFor(base), makeExport());

      expect(result.wasmUrl).toBe(`${base}/assets/__node_modules/canvaskit-wasm/bin/full/${WASM}`);
      expect(result.html).toContain(`href="${result.wasmUrl}"`);
    },
  );

  it('leaves the page alone when there is nothing to point at', () => {
    const html = htmlFor('/client');

    expect(applyCanvasKitPreload(html, mkdtempSync(join(tmpdir(), 'keres-empty-')))).toEqual({
      html,
      wasmUrl: null,
    });
  });
});
