import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { brotliCompress, constants, gzip } from 'node:zlib';

const brotliAsync = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

export type ContentEncoding = 'br' | 'gzip';

/**
 * Text and binary formats that shrink; not the ones already compressed (PNG, JPEG, WOFF/WOFF2), where
 * a second pass costs CPU for nothing.
 */
const COMPRESSIBLE =
  /^(text\/|application\/(javascript|json|wasm|xml)|image\/(svg\+xml|x-icon|vnd\.microsoft\.icon)|font\/(ttf|otf))|\+xml/i;

export function isCompressibleContentType(contentType: string): boolean {
  return COMPRESSIBLE.test(contentType);
}

/**
 * The encoding to answer with, from the request's `Accept-Encoding`: brotli when the browser takes it
 * at least as gladly as gzip, gzip when it takes that, and `null` for neither (the bytes go as they are).
 * Browsers only offer `br` on a secure origin, so a server on plain HTTP in a home network is answered
 * in gzip - both have to work.
 */
export function negotiateContentEncoding(
  header: string | null | undefined,
): ContentEncoding | null {
  if (!header) return null;
  const weights = new Map<string, number>();
  for (const part of header.split(',')) {
    const [name, ...parameters] = part.trim().split(';');
    const quality = parameters.map((parameter) => parameter.trim()).find((p) => p.startsWith('q='));
    const weight = quality === undefined ? 1 : Number(quality.slice(2));
    weights.set(name.trim().toLowerCase(), Number.isNaN(weight) ? 0 : weight);
  }
  const any = weights.get('*') ?? 0;
  const weightOf = (encoding: string) => weights.get(encoding) ?? any;
  const brotli = weightOf('br');
  const gzipWeight = Math.max(weightOf('gzip'), weights.get('x-gzip') ?? 0);
  if (brotli > 0 && brotli >= gzipWeight) return 'br';
  return gzipWeight > 0 ? 'gzip' : null;
}

/** Whether `If-None-Match` names this entity tag (`*`, a list, and weak validators all count). */
export function matchesEntityTag(ifNoneMatch: string | null | undefined, etag: string): boolean {
  if (!ifNoneMatch) return false;
  return ifNoneMatch
    .split(',')
    .map((candidate) => candidate.trim().replace(/^W\//, ''))
    .some((candidate) => candidate === '*' || candidate === etag);
}

export interface StaticDeliveryInput {
  /** What identifies the file (its path): the cache lives under it. */
  key: string;
  /** What changes when the file does (modification time and size): a new version drops what was cached. */
  version: string;
  contentType: string;
  cacheControl: string;
  /** The bytes as they are on disk, read only when needed. */
  load: () => Uint8Array;
  request: { acceptEncoding?: string | null; ifNoneMatch?: string | null };
}

export interface StaticDeliveryResult {
  status: 200 | 304;
  headers: Record<string, string>;
  /** `null` for a 304. */
  body: Uint8Array | null;
}

interface Entry {
  version: string;
  hash: string;
  size: number;
  /** One compression per encoding, shared by every request that arrives while it runs. */
  variants: Map<ContentEncoding, Promise<Uint8Array | null>>;
}

/**
 * Answers static files with what a browser can reuse: the best compression it accepts, an `ETag` it
 * can come back with (a `304` costs no body), and the `Cache-Control` the caller says is right for
 * the file.
 *
 * Compression is done here, once per file and encoding, and kept in memory: Elysia and Bun serve
 * bytes as they are and compress nothing themselves. It runs on the zlib thread pool, so a ten
 * megabyte bundle does not stop the server answering anyone else. Brotli at quality 9 gets within 10%
 * of the best a build step could do in about a second per file (quality 11 takes twenty).
 */
export class StaticDelivery {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly options: {
      minBytes?: number;
      brotliQuality?: number;
      gzipLevel?: number;
    } = {},
  ) {}

  private get minBytes(): number {
    return this.options.minBytes ?? 512;
  }

  private entryFor(input: Pick<StaticDeliveryInput, 'key' | 'version' | 'load'>): Entry {
    const cached = this.entries.get(input.key);
    if (cached && cached.version === input.version) return cached;
    const raw = input.load();
    const entry: Entry = {
      version: input.version,
      hash: createHash('sha1').update(raw).digest('base64url'),
      size: raw.length,
      variants: new Map(),
    };
    this.entries.set(input.key, entry);
    return entry;
  }

  private variant(
    entry: Entry,
    encoding: ContentEncoding,
    load: () => Uint8Array,
  ): Promise<Uint8Array | null> {
    let pending = entry.variants.get(encoding);
    if (!pending) {
      pending = (async () => {
        const raw = load();
        const compressed =
          encoding === 'br'
            ? await brotliAsync(raw, {
                params: {
                  [constants.BROTLI_PARAM_QUALITY]: this.options.brotliQuality ?? 9,
                  [constants.BROTLI_PARAM_SIZE_HINT]: raw.length,
                  [constants.BROTLI_PARAM_LGWIN]: 24,
                },
              })
            : await gzipAsync(raw, { level: this.options.gzipLevel ?? 9 });
        // Whatever does not come out smaller goes as it is.
        return compressed.length < raw.length ? new Uint8Array(compressed) : null;
      })();
      // A failed compression is not remembered: the next request tries again.
      pending.catch(() => entry.variants.delete(encoding));
      entry.variants.set(encoding, pending);
    }
    return pending;
  }

  async deliver(input: StaticDeliveryInput): Promise<StaticDeliveryResult> {
    const entry = this.entryFor(input);
    const compressible = isCompressibleContentType(input.contentType);
    const wanted =
      compressible && entry.size >= this.minBytes
        ? negotiateContentEncoding(input.request.acceptEncoding)
        : null;
    const compressed = wanted ? await this.variant(entry, wanted, input.load) : null;
    const encoding = compressed ? wanted : null;

    // An entity tag per representation: the brotli bytes and the gzip bytes are not the same resource.
    const etag = `"${entry.hash}${encoding ? `-${encoding}` : ''}"`;
    const headers: Record<string, string> = {
      'Content-Type': input.contentType,
      'Cache-Control': input.cacheControl,
      ETag: etag,
    };
    // Always, compressible or not: it names what the answer may depend on, and it replaces the `Vary: *`
    // the CORS plugin puts on everything - a `*` makes a browser refuse to reuse any cached copy without
    // asking, which is how a 'forever' file still costs a request on every visit.
    headers.Vary = 'Accept-Encoding';
    if (encoding) headers['Content-Encoding'] = encoding;

    if (matchesEntityTag(input.request.ifNoneMatch, etag)) {
      return { status: 304, headers, body: null };
    }
    return { status: 200, headers, body: compressed ?? input.load() };
  }

  /** Compresses ahead of the first visitor, in both encodings. */
  async warm(input: Omit<StaticDeliveryInput, 'request'>): Promise<void> {
    if (!isCompressibleContentType(input.contentType)) return;
    const entry = this.entryFor(input);
    if (entry.size < this.minBytes) return;
    await this.variant(entry, 'br', input.load);
    await this.variant(entry, 'gzip', input.load);
  }
}

/**
 * Puts a `StaticDelivery` answer on the response: its headers (lowercase, as the CORS plugin writes its
 * own - a second spelling of `Vary` would be joined to its `*` rather than replace it), its status, and
 * its body. A 304 has no body, not even an empty one: a `Response` with a null-body status refuses a string.
 */
export function sendStaticDelivery(
  set: { status?: number | string; headers: Record<string, string | number> },
  delivery: StaticDeliveryResult,
): Uint8Array | Response {
  for (const [name, value] of Object.entries(delivery.headers)) {
    set.headers[name.toLowerCase()] = value;
  }
  set.status = delivery.status;
  if (delivery.status === 304) return new Response(null, { status: 304 });
  return delivery.body ?? new Uint8Array();
}
