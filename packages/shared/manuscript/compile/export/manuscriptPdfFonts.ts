import type { PdfFont } from './manuscriptPdfLayout';

/**
 * Embedded-font support for the PDF renderer. The writer stays hand-rolled
 * (per-page release, ascii batching, arithmetic xref); fontkit is only the
 * font *toolkit*: glyph advances for layout, subsetting to the used glyphs,
 * and the codepoint data behind the ToUnicode map. It is dynamically imported
 * so it never executes at app boot - a past PDF library broke startup, and
 * this one only runs inside an export, like `pako` already does for page
 * compression.
 *
 * Matrices are TrueType bytes injected by the platform edge (bundled asset on
 * the device, fetched resources on the server); shared stays TS-pure and
 * binary-free. A variable font needs only its regular + italic files (bold
 * comes from `wght` instances, verified by probe: 400 vs 700 advances
 * differ); static fonts pass all four files. The optional CJK matrix (one
 * variable file: CJK has no italics, upright doubles for them) adds four
 * more subsets addressed as /F5../F8; without it, CJK degrades to `?`.
 */
export type PdfFontMatrices = {
  regular: Uint8Array;
  italic: Uint8Array;
  bold?: Uint8Array;
  boldItalic?: Uint8Array;
  cjk?: Uint8Array;
};

type ShapeFeatures = { liga?: boolean; clig?: boolean };

type FontkitFont = {
  unitsPerEm: number;
  layout: (
    text: string,
    features?: ShapeFeatures,
  ) => { advanceWidth: number; glyphs: FontkitGlyph[] };
  glyphForCodePoint: (codePoint: number) => FontkitGlyph;
  hasGlyphForCodePoint: (codePoint: number) => boolean;
  getGlyph: (glyphId: number) => FontkitGlyph;
  createSubset: () => FontkitSubset;
  getVariation?: (settings: Record<string, number>) => FontkitFont;
  bbox?: { minX: number; minY: number; maxX: number; maxY: number };
  ascent?: number;
  descent?: number;
  italicAngle?: number;
  capHeight?: number;
};

type FontkitGlyph = {
  id: number;
  codePoints: number[];
  advanceWidth: number;
};

type FontkitSubset = {
  includeGlyph: (id: number) => void;
  mapping: Record<number, number>;
  encodeStream: () => {
    on: (event: 'data' | 'end' | 'error', listener: (arg: never) => void) => void;
  };
};

type FaceMatrix = 'base' | 'cjk';

/**
 * Face order is load-bearing: callers address faces as /F1../F4 in this exact
 * sequence (it mirrors `FONT_KEYS` in `manuscriptPdf.ts`), CJK faces follow
 * as /F5../F8 in the same face order - so never reorder either list.
 */
const PDF_FONTS: PdfFont[] = ['times', 'times-bold', 'times-italic', 'times-bolditalic'];

function instanceOf(base: FontkitFont, weight: number): FontkitFont {
  // `getVariation` is runtime-only API (absent from the public .d.ts) and
  // exists even on static fonts, where it throws - so attempt, don't probe.
  // Statics simply use their own file (callers pass all four). Every variable
  // face goes through an instance - including weight 400: the subset encoder
  // raw-copies the base font's glyphs, and an odd-length glyph breaks
  // short-loca alignment for every glyph after it (silent cascade of blank
  // outlines). Instanced glyphs take the encoder's padded path instead - but
  // that re-encoder drops a trailing repeat count (`repairSubsetRepeatTails`
  // restores the provable shape at finish, still gated by the validator).
  if (typeof base.getVariation === 'function') {
    try {
      return base.getVariation({ wght: weight });
    } catch {
      return base;
    }
  }
  return base;
}

/** True for the scripts the CJK matrix covers (and the bundled serif does not). */
export function isCjkCodePoint(codePoint: number): boolean {
  return (
    (codePoint >= 0x3000 && codePoint <= 0x303f) || // CJK symbols and punctuation (、。々「」・ー〜…)
    (codePoint >= 0x3040 && codePoint <= 0x30ff) || // hiragana + katakana
    (codePoint >= 0x31f0 && codePoint <= 0x31ff) || // katakana phonetic extensions
    (codePoint >= 0x3400 && codePoint <= 0x4dbf) || // CJK ext A
    (codePoint >= 0x4e00 && codePoint <= 0x9fff) || // CJK unified
    (codePoint >= 0x20000 && codePoint <= 0x2ebef) || // CJK ext B..I
    (codePoint >= 0x1100 && codePoint <= 0x11ff) || // hangul jamo
    (codePoint >= 0x3130 && codePoint <= 0x318f) || // hangul compat jamo
    (codePoint >= 0xac00 && codePoint <= 0xd7af) || // hangul syllables
    (codePoint >= 0x3100 && codePoint <= 0x312f) // bopomofo
  );
}

/** Pure scan (no fontkit): does this text need the CJK pack to draw? */
export function containsCjk(text: string): boolean {
  for (const char of text) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (isCjkCodePoint(codePoint)) return true;
  }
  return false;
}

/** Scripts with no coverage in the loaded matrices, so the caller can name the missing pack. */
export type MissingScript = 'cjk' | 'other';

export type PdfEmbeddedFace = {
  font: PdfFont;
  cjk: boolean;
  /** `XXXXXX+Family` subset tag, unique per face in the file. */
  baseFontName: string;
  /** Consecutive CID runs with advances in thousandths: viewer-side positioning. */
  widthRuns: { first: number; advances: number[] }[];
  /** ToUnicode CMap body mapping every used CID back to Unicode. */
  toUnicode: string;
  descriptor: {
    bbox: [number, number, number, number];
    ascent: number;
    descent: number;
    italicAngle: number;
    capHeight: number;
  };
  subsetBytes: Uint8Array;
};

export type PdfFontPack = {
  /** Shaped advance in PDF points, memoized: books repeat words heavily. */
  measure: (text: string, font: PdfFont, size: number) => number;
  /** Record every glyph of a drawn run; idempotent across layout passes. */
  collect: (font: PdfFont, text: string) => void;
  /** Consecutive same-matrix runs for one drawn string (resource selection). */
  splitRuns: (font: PdfFont, text: string) => { cjk: boolean; text: string }[];
  /** CID for a drawn char; `?` when no loaded matrix covers it. Call after `finish`. */
  cidOf: (font: PdfFont, char: string) => number;
  /** Which loaded-missing scripts a text needs (`[]` = fully covered). */
  missingScripts: (text: string) => MissingScript[];
  /** Encode one subset per face (four base, four CJK when matrices carry them). */
  finish: () => Promise<PdfEmbeddedFace[]>;
};

function hex4(value: number): string {
  return value.toString(16).toUpperCase().padStart(4, '0');
}

function toUnicodeCMap(byCid: Map<number, number[]>): string {
  // One CID per used glyph; a ligature CID maps back to several unicodes.
  // (Ligatures are shaped off, so multis are only ever defensive.)
  const singles: [number, number][] = [];
  const multis: [number, number[]][] = [];
  for (const [cid, codePoints] of byCid) {
    if (codePoints.length === 1) singles.push([cid, codePoints[0]]);
    else multis.push([cid, codePoints]);
  }
  singles.sort((a, b) => a[1] - b[1]);
  const lines: string[] = [];
  // Consecutive single-codepoint runs share one bfrange line (cap 100, per spec).
  let run: [number, number][] = [];
  const flush = () => {
    for (let at = 0; at < run.length; at += 100) {
      const slice = run.slice(at, at + 100);
      const first = slice[0];
      const last = slice[slice.length - 1];
      lines.push(`<${hex4(first[0])}> <${hex4(last[0])}> <${hex4(first[1])}>`);
    }
    run = [];
  };
  for (const [cid, codePoint] of singles) {
    const last = run[run.length - 1];
    if (last && last[0] + 1 === cid && last[1] + 1 === codePoint) run.push([cid, codePoint]);
    else {
      flush();
      run = [[cid, codePoint]];
    }
  }
  flush();
  for (const [cid, codePoints] of multis) {
    lines.push(
      `<${hex4(cid)}> <${hex4(cid)}> [${codePoints.map((c) => `<${hex4(c)}>`).join(' ')}]`,
    );
  }
  return (
    '/CIDInit /ProcSet findresource begin\n' +
    '12 dict begin\n' +
    'begincmap\n' +
    '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n' +
    '/CMapName /Adobe-Identity-UCS def\n' +
    '/CMapType 2 def\n' +
    '1 begincodespacerange\n' +
    '<0000> <FFFF>\n' +
    'endcodespacerange\n' +
    `${lines.length} beginbfrange\n` +
    lines.map((line) => `${line}\n`).join('') +
    'endbfrange\n' +
    'endcmap\n' +
    'CMapName currentdict /CMap defineresource pop\n' +
    'end\n' +
    'end'
  );
}

type FontkitModule = {
  create: (bytes: Uint8Array) => FontkitFont;
};

/**
 * Which object the dynamic fontkit import actually hands back depends on the
 * bundler: Node/Bun/jest resolve the UMD build (`main`), whose namespace
 * carries `create` directly, while web bundlers prefer the ES build
 * (`module`), whose only export is `default`. Reading `.create` straight off
 * the namespace broke the web export (`a.create is not a function`).
 */
export function fontkitOf(loaded: unknown): FontkitModule {
  const module = loaded as { create?: unknown; default?: unknown } | null | undefined;
  const candidate = (module?.default ?? loaded) as FontkitModule;
  if (typeof candidate?.create !== 'function') {
    throw new Error('PDF font engine failed to load (fontkit.create is not available).');
  }
  return candidate;
}

type SubsetTables = {
  view: DataView;
  head: { offset: number; length: number };
  loca: { offset: number; length: number };
  glyf: { offset: number; length: number };
  maxp: { offset: number; length: number };
  /** Directory entries in file order (tag + checksum preserved on rebuild). */
  entries: { tag: string; checkSum: number; offset: number; length: number }[];
  long: boolean;
  numGlyphs: number;
};

function readSubsetTables(subsetBytes: Uint8Array): SubsetTables | null {
  if (subsetBytes.length < 12) return null;
  const view = new DataView(subsetBytes.buffer, subsetBytes.byteOffset, subsetBytes.byteLength);
  const numTables = view.getUint16(4);
  const entries: SubsetTables['entries'] = [];
  const byTag = new Map<string, { offset: number; length: number }>();
  for (let i = 0; i < numTables; i += 1) {
    const at = 12 + i * 16;
    if (at + 16 > subsetBytes.length) return null;
    const tag = String.fromCharCode(
      view.getUint8(at),
      view.getUint8(at + 1),
      view.getUint8(at + 2),
      view.getUint8(at + 3),
    );
    const entry = {
      tag,
      checkSum: view.getUint32(at + 4),
      offset: view.getUint32(at + 8),
      length: view.getUint32(at + 12),
    };
    entries.push(entry);
    byTag.set(tag, entry);
  }
  const head = byTag.get('head');
  const loca = byTag.get('loca');
  const glyf = byTag.get('glyf');
  const maxp = byTag.get('maxp');
  if (!head || !loca || !glyf || !maxp) return null;
  if (head.offset + 54 > subsetBytes.length || maxp.offset + 6 > subsetBytes.length) {
    return null;
  }
  const long = view.getUint16(head.offset + 50) !== 0;
  const numGlyphs = view.getUint16(maxp.offset + 4);
  const entrySize = long ? 4 : 2;
  if (loca.offset + (numGlyphs + 1) * entrySize > subsetBytes.length) return null;
  return { view, head, loca, glyf, maxp, entries, long, numGlyphs };
}

/**
 * Structural check of an encoded subset: every loca range must hold exactly
 * one glyph plus at most alignment padding (simple glyphs fully consumed,
 * composites walked to the end). An odd-length raw-copied glyph once broke
 * short-loca alignment downstream and produced blank outlines with correct
 * positions - invisible to /W, CMap, layout and nonzero-length checks alike.
 * A corrupt subset must fail the export loudly, never ship inside a PDF.
 */
export function subsetBytesAreValid(subsetBytes: Uint8Array): boolean {
  try {
    const tables = readSubsetTables(subsetBytes);
    if (!tables) return false;
    const { view, loca, glyf, long, numGlyphs } = tables;
    const atLoc = (i: number): number =>
      long ? view.getUint32(loca.offset + i * 4) : view.getUint16(loca.offset + i * 2) * 2;
    let prev = 0;
    for (let i = 0; i < numGlyphs; i += 1) {
      const a = atLoc(i);
      const b = atLoc(i + 1);
      // Monotonic and inside glyf; the range must hold exactly one glyph plus
      // at most short padding. A truncated range shifts every glyph after it
      // (blank outlines at correct positions); anything else is dead padding.
      if (a < prev || b < a || glyf.offset + b > subsetBytes.length) return false;
      const consumed = glyphConsumedLength(view, glyf.offset + a, b - a);
      // The encoder pads re-encoded glyphs to a 4-byte alignment, so up to 4
      // trailing zero bytes are structural - but a truncated range (consumed
      // past recorded) shifts every glyph after it.
      if (consumed < 0 || consumed > b - a || b - a - consumed > 4) return false;
      for (let k = glyf.offset + a + consumed; k < glyf.offset + b; k += 1) {
        if (view.getUint8(k) !== 0) return false;
      }
      prev = b;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * How many bytes of the `length`-byte range at `at` the glyph header,
 * flags and coordinates account for, or -1 when the bytes cannot be a glyph
 * at all. Never reads past `at + length`: overruns throw and become invalid.
 */
function glyphConsumedLength(view: DataView, at: number, length: number): number {
  if (length === 0) return 0;
  const end = at + length;
  const nContours = view.getInt16(at);
  if (nContours === -1) return compositeConsumedLength(view, at, end);
  if (nContours < -1 || nContours > 500) return -1;
  let p = at + 10 + nContours * 2;
  if (p + 2 > end) return -1;
  const instrLen = view.getUint16(p);
  p += 2 + instrLen;
  if (p > end) return -1;
  const lastEnd = nContours === 0 ? -1 : view.getUint16(at + 10 + (nContours - 1) * 2);
  const nPts = lastEnd + 1;
  if (nContours > 0 && (lastEnd < 0 || nPts > 10000)) return -1;
  const flags: number[] = [];
  while (flags.length < nPts) {
    if (p >= end) return -1;
    const flag = view.getUint8(p++);
    flags.push(flag);
    if (flag & 0x08) {
      if (p >= end) return -1;
      const repeat = view.getUint8(p++);
      for (let k = 0; k < repeat; k += 1) flags.push(flag);
    }
  }
  let coords = 0;
  for (const flag of flags) {
    coords += flag & 0x02 ? 1 : flag & 0x10 ? 0 : 2;
    coords += flag & 0x04 ? 1 : flag & 0x20 ? 0 : 2;
  }
  return p - at + coords;
}

function compositeConsumedLength(view: DataView, at: number, end: number): number {
  let p = at + 10;
  let lastFlags = 0;
  for (;;) {
    if (p + 4 > end) return -1;
    const flags = view.getUint16(p);
    lastFlags = flags;
    p += 4; // flags + glyphIndex
    p += flags & 0x0001 ? 4 : 2; // args are words or bytes
    if (flags & 0x0008) p += 2;
    else if (flags & 0x0040) p += 4;
    else if (flags & 0x0080) p += 8;
    if (p > end) return -1;
    if (!(flags & 0x0020)) break; // MORE_COMPONENTS
  }
  if (lastFlags & 0x0100) {
    // WE_HAVE_INSTRUCTIONS: uint16 count + bytes.
    if (p + 2 > end) return -1;
    p += 2 + view.getUint16(p);
  }
  return p - at;
}

/** Coordinate byte length implied by one logical flag (same equation as the validator). */
function flagCoordLength(flag: number): number {
  return (flag & 0x02 ? 1 : flag & 0x10 ? 0 : 2) + (flag & 0x04 ? 1 : flag & 0x20 ? 0 : 2);
}

type RepairedGlyph = { bytes: Uint8Array; repaired: boolean } | null;

/**
 * Verbatim copy of a healthy record, or a repaired one when the record shows
 * exactly the encoder's missing-tail shape (see `repairSubsetRepeatTails`).
 * Anything else is unrepairable (`null`): the tripwire must stay loud.
 */
function repairGlyphRecord(view: DataView, at: number, length: number): RepairedGlyph {
  const end = at + length;
  const slice = (from: number, to: number): Uint8Array =>
    new Uint8Array(view.buffer, view.byteOffset + from, to - from).slice();
  if (length === 0) return { bytes: slice(at, at), repaired: false };
  if (length < 10) return null;
  const nContours = view.getInt16(at);
  if (nContours === -1) {
    // Composites travel the verbatim path even for instances: exact or dead.
    const consumed = compositeConsumedLength(view, at, end);
    if (consumed < 0 || consumed > length || length - consumed > 4) return null;
    for (let k = at + consumed; k < end; k += 1) {
      if (view.getUint8(k) !== 0) return null;
    }
    return { bytes: slice(at, end), repaired: false };
  }
  if (nContours < -1 || nContours > 500) return null;
  let p = at + 10 + nContours * 2;
  if (p + 2 > end) return null;
  p += 2 + view.getUint16(p); // instructions
  if (p > end) return null;
  const lastEnd = nContours === 0 ? -1 : view.getUint16(at + 10 + (nContours - 1) * 2);
  const nPts = lastEnd + 1;
  if (nContours > 0 && (lastEnd < 0 || nPts > 10000)) return null;
  if (nPts === 0) {
    // Contourless simple glyph: header only, like the validator accepts.
    if (length - (p - at) > 4) return null;
    for (let k = p; k < end; k += 1) {
      if (view.getUint8(k) !== 0) return null;
    }
    return { bytes: slice(at, end), repaired: false };
  }
  // Greedy pair expansion: literals plus [run flag, count] pairs. Past the
  // corruption point the bytes are coordinates read as flags, so the parse
  // past it is meaningless - but every pair strictly before the missing
  // count is intact, which is what the repair search below relies on.
  const pairFlags: number[] = [];
  const pairCounts: number[] = [];
  const pairStarts: number[] = [];
  const prefixPoints: number[] = [];
  let logical = 0;
  while (logical < nPts && p < end) {
    const start = p;
    const flag = view.getUint8(p++);
    let eaten = 0;
    if (flag & 0x08) {
      if (p >= end) break;
      eaten = view.getUint8(p++);
    }
    pairFlags.push(flag);
    pairCounts.push(eaten);
    pairStarts.push(start);
    prefixPoints.push(logical);
    logical += 1 + eaten;
  }
  if (logical === nPts && pairStarts.length > 0) {
    // Candidate healthy shape: flags meet the point count at a pair boundary.
    let coords = 0;
    for (let k = 0; k < pairFlags.length; k += 1) {
      const flag = pairFlags[k]!;
      const reps = 1 + (flag & 0x08 ? pairCounts[k]! : 0);
      coords += reps * flagCoordLength(flag & ~0x08);
    }
    const consumed = p - at + coords;
    if (consumed <= length && length - consumed <= 4) {
      let clean = true;
      for (let k = at + consumed; k < end; k += 1) {
        if (view.getUint8(k) !== 0) {
          clean = false;
          break;
        }
      }
      if (clean) return { bytes: slice(at, end), repaired: false };
    }
    // Closed exactly but the coordinate equation does not fit (a small eaten
    // count lets coordinates pose as flags): fall through to the repair
    // search instead of rejecting outright.
  }
  // Repair search: every run flag is a candidate for the run whose count the
  // encoder dropped. A byte stream can admit two structurally sound splits
  // (proven in practice: a complete earlier run re-read as the trailing one
  // still closes the equation with a zero tail), so structure alone cannot
  // disambiguate. The tiebreaker is the glyph header bbox: `encodeSimple`
  // copies it from the true outline (`path.bbox`), independent of the flag
  // stream, so only the candidate whose decoded points reproduce it exactly
  // is the true outline. Zero survivors means another corruption, several
  // means unresolvable ambiguity - both refuse loudly.
  const box: [number, number, number, number] = [
    view.getInt16(at + 2),
    view.getInt16(at + 4),
    view.getInt16(at + 6),
    view.getInt16(at + 8),
  ];
  const decodeBox = (flags: number[], from: number): [number, number, number, number] | null => {
    // Glyph coordinates are x-major (every X, then every Y), not interleaved.
    try {
      const deltas: [number, number][] = [];
      let cp = from;
      for (const raw of flags) {
        const flag = raw & ~0x08;
        let dx: number;
        if (flag & 0x02) {
          const d = view.getUint8(cp++);
          dx = flag & 0x10 ? d : -d;
        } else if (flag & 0x10) {
          dx = 0; // SAME_X with no SHORT: zero delta, no bytes
        } else {
          dx = view.getInt16(cp);
          cp += 2;
        }
        deltas.push([dx, 0]);
      }
      for (let i = 0; i < flags.length; i += 1) {
        const flag = (flags[i] ?? 0) & ~0x08;
        let dy: number;
        if (flag & 0x04) {
          const d = view.getUint8(cp++);
          dy = flag & 0x20 ? d : -d;
        } else if (flag & 0x20) {
          dy = 0; // SAME_Y with no SHORT: zero delta, no bytes
        } else {
          dy = view.getInt16(cp);
          cp += 2;
        }
        deltas[i]![1] = dy;
      }
      if (cp !== from + flags.reduce((sum, raw) => sum + flagCoordLength(raw & ~0x08), 0)) {
        return null;
      }
      let x = 0;
      let y = 0;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const [dx, dy] of deltas) {
        x += dx;
        y += dy;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
      return [minX, minY, maxX, maxY];
    } catch {
      return null;
    }
  };
  const candidates: { flagPos: number; count: number; coordsStart: number; coords: number }[] = [];
  for (let j = 0; j < pairFlags.length; j += 1) {
    const runFlag = pairFlags[j]!;
    if (!(runFlag & 0x08)) continue;
    const before = prefixPoints[j]!;
    const runLen = nPts - before;
    if (runLen < 1 || runLen > 256) continue;
    const count = runLen - 1;
    const flags: number[] = [];
    for (let k = 0; k < j; k += 1) {
      const flag = pairFlags[k]!;
      const reps = 1 + (flag & 0x08 ? pairCounts[k]! : 0);
      for (let r = 0; r < reps; r += 1) flags.push(flag);
    }
    for (let r = 0; r < runLen; r += 1) flags.push(runFlag);
    if (flags.length !== nPts) continue;
    let coords = 0;
    for (const flag of flags) coords += flagCoordLength(flag & ~0x08);
    const coordsStart = pairStarts[j]! + 1; // byte after the run flag
    const coordsEnd = coordsStart + coords;
    if (coordsEnd > end || end - coordsEnd > 4) continue;
    let tailClean = true;
    for (let k = coordsEnd; k < end; k += 1) {
      if (view.getUint8(k) !== 0) {
        tailClean = false;
        break;
      }
    }
    if (!tailClean) continue;
    const decoded = decodeBox(flags, coordsStart);
    if (
      !decoded ||
      decoded[0] !== box[0] ||
      decoded[1] !== box[1] ||
      decoded[2] !== box[2] ||
      decoded[3] !== box[3]
    ) {
      continue;
    }
    candidates.push({ flagPos: pairStarts[j]!, count, coordsStart, coords });
  }
  if (candidates.length !== 1) return null;
  const winner = candidates[0]!;
  // Rebuilt record: header + flags + the missing count + true coords, padded
  // to even so every downstream loca entry keeps its parity (the delta stays
  // even, which is what short-loca cascades need).
  const headLen = winner.flagPos + 1 - at;
  const core = new Uint8Array(headLen + 1 + winner.coords);
  core.set(new Uint8Array(view.buffer, view.byteOffset + at, headLen), 0);
  core[headLen] = winner.count;
  core.set(
    new Uint8Array(view.buffer, view.byteOffset + winner.coordsStart, winner.coords),
    headLen + 1,
  );
  const pad = core.length % 2 === 0 ? 0 : 1;
  const bytes = new Uint8Array(core.length + pad);
  bytes.set(core, 0);
  return { bytes, repaired: true };
}

/**
 * Repairs the one corrupt shape `@pdf-lib/fontkit`'s variation re-encoder
 * (`TTFGlyphEncoder.encodeSimple`) provably emits and nothing else: a simple
 * glyph whose outline ends in a run of identical flags loses the run's final
 * count byte (the pending run is never flushed), so a reader takes the first
 * coordinate byte for the count, overruns the record, and every glyph after
 * it cascades into blank/misplaced outlines - with positions, widths and
 * copy-paste all still correct, which is why only a byte-level check catches
 * it. Returns the input untouched when every glyph is healthy, rebuilt bytes
 * when each damaged glyph matches the missing-tail shape exactly, or `null`
 * when anything else is off - the caller must refuse to ship `null` loudly.
 * sfnt checksums are intentionally left alone: renderers do not verify them
 * for embedded subsets, and the validator re-proves structure afterwards.
 */
export function repairSubsetRepeatTails(subsetBytes: Uint8Array): Uint8Array | null {
  try {
    const tables = readSubsetTables(subsetBytes);
    if (!tables) return null;
    const { view, loca, glyf, long, numGlyphs } = tables;
    const atLoc = (i: number): number =>
      long ? view.getUint32(loca.offset + i * 4) : view.getUint16(loca.offset + i * 2) * 2;
    const records: Uint8Array[] = [];
    let repairedAny = false;
    let prev = 0;
    for (let i = 0; i < numGlyphs; i += 1) {
      const a = atLoc(i);
      const b = atLoc(i + 1);
      if (a < prev || b < a || glyf.offset + b > subsetBytes.length) return null;
      const fixed = repairGlyphRecord(view, glyf.offset + a, b - a);
      if (!fixed) return null;
      if (fixed.repaired) repairedAny = true;
      records.push(fixed.bytes);
      prev = b;
    }
    if (!repairedAny) return subsetBytes;
    // Rebuild glyf + loca; untouched tables travel verbatim at 4-alignment.
    let glyfLen = 0;
    for (const record of records) glyfLen += record.length;
    const locaLen = (numGlyphs + 1) * (long ? 4 : 2);
    const replacements = new Map<string, Uint8Array>();
    const newGlyf = new Uint8Array(glyfLen);
    const newLoca = new Uint8Array(locaLen);
    const locaView = new DataView(newLoca.buffer);
    let at = 0;
    for (let i = 0; i < records.length; i += 1) {
      if (long) locaView.setUint32(i * 4, at);
      else {
        if (at % 2 !== 0 || at > 0x1ffff) return null;
        locaView.setUint16(i * 2, at / 2);
      }
      newGlyf.set(records[i], at);
      at += records[i]!.length;
    }
    if (long) locaView.setUint32(numGlyphs * 4, at);
    else {
      if (at % 2 !== 0 || at > 0x1ffff) return null;
      locaView.setUint16(numGlyphs * 2, at / 2);
    }
    replacements.set('glyf', newGlyf);
    replacements.set('loca', newLoca);
    const headerLen = 12 + tables.entries.length * 16;
    let fileLen = headerLen;
    const placements = new Map<string, { offset: number; length: number }>();
    for (const entry of tables.entries) {
      const data =
        replacements.get(entry.tag) ??
        new Uint8Array(view.buffer, view.byteOffset + entry.offset, entry.length).slice();
      fileLen = (fileLen + 3) & ~3;
      placements.set(entry.tag, { offset: fileLen, length: data.length });
      fileLen += data.length;
    }
    const rebuilt = new Uint8Array(fileLen);
    rebuilt.set(new Uint8Array(view.buffer, view.byteOffset, headerLen).slice(), 0);
    const dir = new DataView(rebuilt.buffer);
    tables.entries.forEach((entry, index) => {
      const place = placements.get(entry.tag)!;
      const data =
        replacements.get(entry.tag) ??
        new Uint8Array(view.buffer, view.byteOffset + entry.offset, entry.length).slice();
      rebuilt.set(data, place.offset);
      const rec = 12 + index * 16;
      dir.setUint32(rec + 4, entry.checkSum);
      dir.setUint32(rec + 8, place.offset);
      dir.setUint32(rec + 12, place.length);
    });
    if (!subsetBytesAreValid(rebuilt)) return null;
    return rebuilt;
  } catch {
    return null;
  }
}

export async function loadPdfFontPack(matrices: PdfFontMatrices): Promise<PdfFontPack> {
  const fontkit = fontkitOf(await import('@pdf-lib/fontkit'));
  const baseRegular = fontkit.create(matrices.regular);
  const baseItalic = fontkit.create(matrices.italic);
  const cjkBase = matrices.cjk ? fontkit.create(matrices.cjk) : null;
  const instances: Record<PdfFont, { base: FontkitFont; cjk: FontkitFont | null }> = {
    times: { base: instanceOf(baseRegular, 400), cjk: cjkBase && instanceOf(cjkBase, 400) },
    'times-bold': {
      base: matrices.bold ? fontkit.create(matrices.bold) : instanceOf(baseRegular, 700),
      cjk: cjkBase && instanceOf(cjkBase, 700),
    },
    'times-italic': { base: instanceOf(baseItalic, 400), cjk: cjkBase && instanceOf(cjkBase, 400) },
    'times-bolditalic': {
      // CJK has no italics: the upright instance doubles (standard practice).
      base: matrices.boldItalic ? fontkit.create(matrices.boldItalic) : instanceOf(baseItalic, 700),
      cjk: cjkBase && instanceOf(cjkBase, 700),
    },
  };

  // Per-face, per-matrix glyph collection: glyph id -> codepoints drawn with it.
  type Collected = Record<FaceMatrix, Map<number, number[]>>;
  const collected: Record<PdfFont, Collected> = {
    times: { base: new Map(), cjk: new Map() },
    'times-bold': { base: new Map(), cjk: new Map() },
    'times-italic': { base: new Map(), cjk: new Map() },
    'times-bolditalic': { base: new Map(), cjk: new Map() },
  };
  const measureCache = new Map<string, number>();
  const QUESTION = '?';
  let finished: Record<PdfFont, Record<FaceMatrix, Map<number, number>>> | null = null;

  const NO_LIGA: ShapeFeatures = { liga: false, clig: false };

  /** Which matrix draws a codepoint: CJK coverage first, then the base face. */
  function matrixFor(font: PdfFont, codePoint: number): { matrix: FaceMatrix; char: string } {
    const char = String.fromCodePoint(codePoint);
    if (isCjkCodePoint(codePoint)) {
      const cjk = instances[font].cjk;
      if (cjk && cjk.hasGlyphForCodePoint(codePoint)) return { matrix: 'cjk', char };
      return { matrix: 'base', char: QUESTION };
    }
    if (instances[font].base.hasGlyphForCodePoint(codePoint)) return { matrix: 'base', char };
    return { matrix: 'base', char: QUESTION };
  }

  function includeGlyph(font: PdfFont, matrix: FaceMatrix, glyph: FontkitGlyph): void {
    const known = collected[font][matrix].get(glyph.id);
    if (known) {
      for (const codePoint of glyph.codePoints) {
        if (!known.includes(codePoint)) known.push(codePoint);
      }
      return;
    }
    collected[font][matrix].set(glyph.id, [...glyph.codePoints]);
  }

  /** Shape one matrix run (already resolved to covered chars). */
  function shapeRun(instance: FontkitFont, text: string): FontkitGlyph[] {
    return instance.layout(text, NO_LIGA).glyphs;
  }

  function instanceFor(font: PdfFont, matrix: FaceMatrix): FontkitFont {
    return matrix === 'cjk' ? (instances[font].cjk ?? instances[font].base) : instances[font].base;
  }

  function shape(font: PdfFont, text: string): { matrix: FaceMatrix; glyphs: FontkitGlyph[] }[] {
    // Split into same-matrix runs first: each instance shapes only its own
    // script, so measurement, collection and the per-char CIDs the writer
    // emits stay on the same units. Kerning stays on (sub-point; only
    // centering math and rule endpoints feel it).
    const runs: { matrix: FaceMatrix; chars: string }[] = [];
    for (const char of text) {
      const codePoint = char.codePointAt(0) ?? 0x3f;
      const { matrix, char: resolved } = matrixFor(font, codePoint);
      const last = runs[runs.length - 1];
      if (last && last.matrix === matrix) last.chars += resolved;
      else runs.push({ matrix, chars: resolved });
    }
    return runs.map(({ matrix, chars }) => ({
      matrix,
      glyphs: shapeRun(instanceFor(font, matrix), chars),
    }));
  }

  const measure = (text: string, font: PdfFont, size: number): number => {
    const key = `${font}\n${text}`;
    const hit = measureCache.get(key);
    if (hit !== undefined) return (hit * size) / 1000;
    let thousandths = 0;
    for (const run of shape(font, text)) {
      const upm = instanceFor(font, run.matrix).unitsPerEm;
      for (const glyph of run.glyphs) thousandths += (glyph.advanceWidth / upm) * 1000;
    }
    if (measureCache.size > 50000) measureCache.clear();
    measureCache.set(key, thousandths);
    return (thousandths * size) / 1000;
  };

  const collect = (font: PdfFont, text: string): void => {
    for (const run of shape(font, text)) {
      for (const glyph of run.glyphs) includeGlyph(font, run.matrix, glyph);
    }
  };

  const splitRuns = (font: PdfFont, text: string): { cjk: boolean; text: string }[] => {
    const runs: { cjk: boolean; text: string }[] = [];
    for (const char of text) {
      const codePoint = char.codePointAt(0) ?? 0x3f;
      const { matrix, char: resolved } = matrixFor(font, codePoint);
      const cjk = matrix === 'cjk';
      const last = runs[runs.length - 1];
      if (last && last.cjk === cjk) last.text += resolved;
      else runs.push({ cjk, text: resolved });
    }
    return runs;
  };

  const missingScripts = (text: string): MissingScript[] => {
    // Coverage is a property of the loaded matrices, identical across faces.
    const found = new Set<MissingScript>();
    for (const char of text) {
      const codePoint = char.codePointAt(0) ?? 0;
      if (codePoint < 0x20 || codePoint === 0x7f) continue;
      if (matrixFor('times', codePoint).char === QUESTION) {
        found.add(isCjkCodePoint(codePoint) ? 'cjk' : 'other');
      }
    }
    return [...found];
  };

  async function drain(stream: {
    on: (event: 'data' | 'end' | 'error', listener: (arg: never) => void) => void;
  }): Promise<Uint8Array> {
    const chunks: Uint8Array[] = [];
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (chunk: never) => chunks.push(chunk as Uint8Array));
      stream.on('end', () => resolve());
      stream.on('error', (error: never) => reject(error as Error));
    });
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const out = new Uint8Array(total);
    let at = 0;
    for (const chunk of chunks) {
      out.set(chunk, at);
      at += chunk.length;
    }
    return out;
  }

  const cidOf = (font: PdfFont, char: string): number => {
    if (!finished) throw new Error('PdfFontPack.cidOf called before finish().');
    const codePoint = char.codePointAt(0) ?? 0x3f;
    const { matrix } = matrixFor(font, codePoint);
    return (
      finished[font][matrix].get(codePoint) ??
      finished[font][matrix].get(QUESTION.codePointAt(0) ?? 0x3f) ??
      0
    );
  };

  async function finishFace(
    font: PdfFont,
    matrix: FaceMatrix,
    instance: FontkitFont,
    tag: string,
    cps: Map<number, number>,
  ): Promise<PdfEmbeddedFace> {
    includeGlyph(font, matrix, instance.glyphForCodePoint(QUESTION.codePointAt(0) ?? 0x3f));
    const subset = instance.createSubset();
    for (const id of collected[font][matrix].keys()) subset.includeGlyph(id);
    const idToCid = new Map<number, number>(
      Object.entries(subset.mapping).map(([oldId, cid]) => [Number(oldId), cid as number]),
    );
    const rawBytes = await drain(subset.encodeStream());
    // Variation instances pass through fontkit's re-encoder, which drops a
    // trailing repeat count the validator would (correctly) reject: repair
    // the provable shape, then gate on the validator either way.
    const subsetBytes = repairSubsetRepeatTails(rawBytes);
    if (!subsetBytes || !subsetBytesAreValid(subsetBytes)) {
      throw new Error(
        `PdfFontPack: invalid subset for ${font}/${matrix} - refusing to ship a corrupt PDF.`,
      );
    }
    const byCid = new Map<number, number[]>();
    for (const [oldId, codePoints] of collected[font][matrix]) {
      const cid = idToCid.get(oldId);
      if (cid === undefined) continue;
      byCid.set(cid, codePoints);
      for (const codePoint of codePoints) cps.set(codePoint, cid);
    }
    const cidToOld = new Map<number, number>();
    for (const [oldId, cid] of idToCid) cidToOld.set(cid, oldId);
    const cids = [...byCid.keys()].sort((a, b) => a - b);
    const advances = cids.map((cid) =>
      Math.round(
        (instance.getGlyph(cidToOld.get(cid) ?? 0).advanceWidth / instance.unitsPerEm) * 1000,
      ),
    );
    const widthRuns: { first: number; advances: number[] }[] = [];
    for (let at = 0; at < cids.length; at += 1) {
      const last = widthRuns[widthRuns.length - 1];
      if (last && last.first + last.advances.length === cids[at]) {
        last.advances.push(advances[at]);
      } else {
        widthRuns.push({ first: cids[at], advances: [advances[at]] });
      }
    }
    const metrics = (name: 'bbox' | 'ascent' | 'descent' | 'italicAngle' | 'capHeight') =>
      instance[name] as
        | number
        | { minX: number; minY: number; maxX: number; maxY: number }
        | undefined;
    const bbox = metrics('bbox');
    const box: [number, number, number, number] =
      bbox !== undefined && typeof bbox === 'object'
        ? [bbox.minX, bbox.minY, bbox.maxX, bbox.maxY]
        : [0, -250, 1000, 1000];
    const numberOr = (value: unknown, fallback: number): number =>
      typeof value === 'number' ? value : fallback;
    return {
      font,
      cjk: matrix === 'cjk',
      baseFontName: `${tag}+Subset`,
      widthRuns,
      toUnicode: toUnicodeCMap(byCid),
      descriptor: {
        bbox: box,
        ascent: numberOr(metrics('ascent'), 1000),
        descent: numberOr(metrics('descent'), -250),
        italicAngle: numberOr(
          metrics('italicAngle'),
          font === 'times-italic' || font === 'times-bolditalic' ? -12 : 0,
        ),
        capHeight: numberOr(metrics('capHeight'), 700),
      },
      subsetBytes,
    };
  }

  const finish = async (): Promise<PdfEmbeddedFace[]> => {
    const tags = ['KERAAB', 'KERACD', 'KERAEF', 'KERAGH', 'KERA01', 'KERA02', 'KERA03', 'KERA04'];
    const done: Record<PdfFont, Record<FaceMatrix, Map<number, number>>> = {
      times: { base: new Map(), cjk: new Map() },
      'times-bold': { base: new Map(), cjk: new Map() },
      'times-italic': { base: new Map(), cjk: new Map() },
      'times-bolditalic': { base: new Map(), cjk: new Map() },
    };
    finished = done;
    const faces: { font: PdfFont; matrix: FaceMatrix; instance: FontkitFont }[] = [];
    for (const font of PDF_FONTS)
      faces.push({ font, matrix: 'base', instance: instances[font].base });
    if (matrices.cjk) {
      for (const font of PDF_FONTS) {
        const instance = instances[font].cjk;
        if (instance) faces.push({ font, matrix: 'cjk', instance });
      }
    }
    return Promise.all(
      faces.map(({ font, matrix, instance }, index) =>
        finishFace(font, matrix, instance, tags[index], done[font][matrix]),
      ),
    );
  };

  return { measure, collect, splitRuns, cidOf, missingScripts, finish };
}
