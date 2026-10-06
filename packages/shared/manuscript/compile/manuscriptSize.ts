import { MAX_MANUSCRIPT_BYTES, type ManuscriptFormat } from './manuscriptContracts';

/*
 * How big a manuscript will be, said BEFORE it is compiled. The file's real size is only known once it
 * exists, and by then the work (and, for a publication, the upload) is done and thrown away if it is too
 * large. So the size is estimated from what is already known: the bytes of the text, and the exact bytes
 * of every image, which are fixed before compiling starts. Every ratio below is deliberately on the
 * generous side - an estimate that says "fits" must be right; one that says "tight" may be early - and
 * the test compiles real output in every format to hold them to it.
 */

/** A manuscript file, or the self-contained online reader page. */
export type SizedFormat = ManuscriptFormat | 'reader';

export type ManuscriptSizeInput = {
  format: SizedFormat;
  /** UTF-8 bytes of everything that is text: scene prose, titles, synopses. */
  textBytes: number;
  /** The exact byte size of each image that goes in (page art, covers), as it will be embedded. */
  imageBytes?: readonly number[];
};

/** Past this share of the limit the person is told it is getting close, before it is refused. */
export const MANUSCRIPT_SIZE_NEAR_RATIO = 0.8;

/** Each image costs a little beyond its bytes (a manifest entry, a drawing command, a data-URI prefix). */
const PER_IMAGE_OVERHEAD_BYTES = 1024;

/**
 * Text and fixed overhead of each format. Prose deflates to about four tenths; the factors assume
 * worse (a zip's XML wrapping is counted in), and PDF is counted with fonts embedded, the larger case.
 */
const TEXT_MODEL: Record<SizedFormat, { factor: number; fixed: number }> = {
  md: { factor: 1.1, fixed: 2_000 },
  txt: { factor: 1.05, fixed: 1_000 },
  fountain: { factor: 1.1, fixed: 2_000 },
  html: { factor: 1.15, fixed: 6_000 },
  reader: { factor: 1.2, fixed: 60_000 },
  docx: { factor: 0.6, fixed: 30_000 },
  epub: { factor: 0.55, fixed: 20_000 },
  pdf: { factor: 0.6, fixed: 320_000 },
  'screenplay-pdf': { factor: 0.6, fixed: 20_000 },
};

/** Formats that carry an image as text inside the file, so it grows by a third (base64). */
const IMAGES_AS_BASE64: ReadonlySet<SizedFormat> = new Set(['html', 'reader']);

/** Formats that cannot hold an image at all: they drop it, and it costs nothing. */
const IMAGELESS: ReadonlySet<SizedFormat> = new Set(['md', 'txt', 'fountain', 'screenplay-pdf']);

/** Bytes of a string as UTF-8, counted without building the encoded array. */
export function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      // A surrogate pair is one four-byte character.
      bytes += 4;
      index += 1;
    } else bytes += 3;
  }
  return bytes;
}

/** An estimate of the finished file's size, never lower than the real thing for ordinary prose. */
export function estimateManuscriptBytes({
  format,
  textBytes,
  imageBytes = [],
}: ManuscriptSizeInput): number {
  const { factor, fixed } = TEXT_MODEL[format];
  const images = IMAGELESS.has(format)
    ? 0
    : imageBytes.reduce((sum, bytes) => {
        const embedded = IMAGES_AS_BASE64.has(format) ? Math.ceil((bytes * 4) / 3) : bytes;
        return sum + embedded + PER_IMAGE_OVERHEAD_BYTES;
      }, 0);
  return Math.ceil(textBytes * factor + fixed + images);
}

export type ManuscriptSizeStatus = 'ok' | 'near' | 'over';

export type ManuscriptSizeAssessment = {
  bytes: number;
  limit: number;
  /** `bytes / limit`; above 1 the file would be refused. */
  ratio: number;
  /** How many bytes are left before the limit (negative once over it). */
  remaining: number;
  status: ManuscriptSizeStatus;
};

export function assessManuscriptSize(
  bytes: number,
  limit: number = MAX_MANUSCRIPT_BYTES,
): ManuscriptSizeAssessment {
  const ratio = bytes / limit;
  return {
    bytes,
    limit,
    ratio,
    remaining: limit - bytes,
    status: ratio > 1 ? 'over' : ratio >= MANUSCRIPT_SIZE_NEAR_RATIO ? 'near' : 'ok',
  };
}

/** The size of a whole manuscript, estimated and judged against the limit in one step. */
export function manuscriptSizeAssessment(input: ManuscriptSizeInput): ManuscriptSizeAssessment {
  return assessManuscriptSize(estimateManuscriptBytes(input));
}

/**
 * Stops a writer that has already passed the limit, instead of letting it finish a file that will be
 * thrown away. The message is the one every compiler gives, so callers translate it the same way.
 */
export function assertWithinManuscriptLimit(
  bytesSoFar: number,
  limit: number = MAX_MANUSCRIPT_BYTES,
): void {
  if (bytesSoFar > limit) {
    throw new Error(`Manuscript exceeds the ${limit}-byte limit (more than ${bytesSoFar} bytes).`);
  }
}
