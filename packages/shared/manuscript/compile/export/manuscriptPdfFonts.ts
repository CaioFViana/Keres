import type { PdfFont } from './manuscriptPdfLayout';
import { repairSubsetRepeatTails, subsetBytesAreValid } from './manuscriptPdfSubsetRepair';

export { subsetBytesAreValid, repairSubsetRepeatTails } from './manuscriptPdfSubsetRepair';

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
 * sequence (it mirrors `FONT_KEYS` in `manuscriptPdfDraw.ts`), CJK faces follow
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
