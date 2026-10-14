/**
 * Compresses the static files of the web bundles the API serves (the admin panel, the showcase, the hosted client and
 * the landing page), once, at build time:
 *
 *   bun apps/api/scripts/precompress-dist.ts [--encodings=br,gzip] [--quality=11] <folder>...
 *
 * For each file that compresses, it writes `<file>.br` and `<file>.gz` beside it, and one `precompressed.json` at the
 * root of the folder with the hash of each file's bytes (see `src/services/precompressedAssets.ts`). The server then
 * answers from those copies: it spends no CPU compressing at boot, and keeps no compressed copy of every file in memory.
 *
 * What it leaves alone: HTML (the hosted client rewrites its entry page at request time, and pages are small), files
 * under 1 KB, formats that are compressed already, and any encoding that does not come out smaller than the file.
 * Running it again starts from nothing: copies and the manifest from an earlier run are removed first.
 *
 * Brotli at quality 11 is slow (the server uses 9 on the fly); a build is where that cost belongs.
 */
import { readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { hostedClientMimeType } from '../src/services/hostedClient';
import {
  PRECOMPRESSED_MANIFEST,
  PRECOMPRESSED_SUFFIX,
  type PrecompressedManifest,
} from '../src/services/precompressedAssets';
import {
  type ContentEncoding,
  contentHash,
  isCompressibleContentType,
} from '../src/services/staticDelivery';

const MIN_BYTES = 1024;
const COPY_SUFFIXES = Object.values(PRECOMPRESSED_SUFFIX);

export interface PrecompressOptions {
  encodings?: ContentEncoding[];
  brotliQuality?: number;
}

export interface PrecompressResult {
  /** Files that got at least one compressed copy. */
  files: number;
  rawBytes: number;
  brotliBytes: number;
  gzipBytes: number;
}

function listFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}

function isCopy(filePath: string): boolean {
  return COPY_SUFFIXES.some((suffix) => filePath.endsWith(suffix));
}

export function precompressDirectory(
  directory: string,
  options: PrecompressOptions = {},
): PrecompressResult {
  const encodings = options.encodings ?? ['br', 'gzip'];
  const quality = options.brotliQuality ?? 11;
  const root = path.resolve(directory);

  // A run starts from nothing: copies made earlier may belong to files that have changed since.
  for (const file of listFiles(root)) {
    if (isCopy(file) || path.basename(file) === PRECOMPRESSED_MANIFEST) {
      rmSync(file);
    }
  }

  const manifest: PrecompressedManifest = { version: 1, files: {} };
  const result: PrecompressResult = { files: 0, rawBytes: 0, brotliBytes: 0, gzipBytes: 0 };

  for (const file of listFiles(root).sort()) {
    const contentType = hostedClientMimeType(file);
    if (
      path.extname(file).toLowerCase() === '.html' ||
      !isCompressibleContentType(contentType) ||
      statSync(file).size < MIN_BYTES
    ) {
      continue;
    }
    const raw = new Uint8Array(readFileSync(file));
    const made: ContentEncoding[] = [];
    for (const encoding of encodings) {
      const compressed =
        encoding === 'br'
          ? brotliCompressSync(raw, {
              params: {
                [constants.BROTLI_PARAM_QUALITY]: quality,
                [constants.BROTLI_PARAM_SIZE_HINT]: raw.length,
                [constants.BROTLI_PARAM_LGWIN]: 24,
              },
            })
          : gzipSync(raw, { level: 9 });
      // Whatever does not come out smaller is served as it is.
      if (compressed.length >= raw.length) continue;
      writeFileSync(`${file}${PRECOMPRESSED_SUFFIX[encoding]}`, compressed);
      made.push(encoding);
      if (encoding === 'br') result.brotliBytes += compressed.length;
      else result.gzipBytes += compressed.length;
    }
    if (made.length === 0) continue;
    manifest.files[path.relative(root, file).split(path.sep).join('/')] = {
      hash: contentHash(raw),
      encodings: made,
    };
    result.files += 1;
    result.rawBytes += raw.length;
  }

  writeFileSync(path.join(root, PRECOMPRESSED_MANIFEST), `${JSON.stringify(manifest)}\n`);
  return result;
}

function megabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function main(argv: string[]): void {
  const encodingsArgument = argv.find((argument) => argument.startsWith('--encodings='));
  const qualityArgument = argv.find((argument) => argument.startsWith('--quality='));
  const folders = argv.filter((argument) => !argument.startsWith('--'));
  if (folders.length === 0) {
    console.error('usage: precompress-dist.ts [--encodings=br,gzip] [--quality=11] <folder>...');
    process.exit(1);
  }
  const encodings = encodingsArgument
    ?.slice('--encodings='.length)
    .split(',')
    .filter((value): value is ContentEncoding => value === 'br' || value === 'gzip');
  if (encodingsArgument && (!encodings || encodings.length === 0)) {
    console.error('--encodings takes br, gzip or both, separated by a comma.');
    process.exit(1);
  }
  const brotliQuality = qualityArgument ? Number(qualityArgument.slice('--quality='.length)) : 11;
  if (!Number.isInteger(brotliQuality) || brotliQuality < 0 || brotliQuality > 11) {
    console.error('--quality is a whole number from 0 to 11.');
    process.exit(1);
  }
  for (const folder of folders) {
    const started = Date.now();
    const result = precompressDirectory(folder, { encodings, brotliQuality });
    console.log(
      `${folder}: ${result.files} file(s), ${megabytes(result.rawBytes)} -> br ${megabytes(result.brotliBytes)}, gzip ${megabytes(result.gzipBytes)} (${((Date.now() - started) / 1000).toFixed(1)} s)`,
    );
  }
}

// Runs only when it is the script being executed, so a test can import `precompressDirectory` without side effects.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
