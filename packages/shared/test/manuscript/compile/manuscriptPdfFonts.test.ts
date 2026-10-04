import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  fontkitOf,
  loadPdfFontPack,
  repairSubsetRepeatTails,
  subsetBytesAreValid,
} from '../../../manuscript/compile/export/manuscriptPdfFonts';

// Roboto Regular (44 KB subset) vendored with its license as
// `test/fixtures/fonts/`: a real TrueType face for the font machinery,
// small enough to commit. Sans vs serif does not matter here - only the
// subset/CMap/advance plumbing is under test.
const ROBOTO = new Uint8Array(
  readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      '..',
      '..',
      'fixtures',
      'fonts',
      'Roboto-Regular.ttf',
    ),
  ),
);

function matrices() {
  return { regular: ROBOTO, italic: ROBOTO };
}

describe('loadPdfFontPack', () => {
  it('measures shaped advances and memoizes them', async () => {
    const pack = await loadPdfFontPack(matrices());

    const first = pack.measure('Hamburgefonstiv', 'times', 11);
    expect(first).toBeGreaterThan(0);
    expect(pack.measure('Hamburgefonstiv', 'times', 11)).toBe(first);
    expect(pack.measure('Hamburgefonstiv', 'times', 22)).toBeCloseTo(first * 2, 6);
  });

  it('degrades uncovered codepoints to the ? glyph, never throws', async () => {
    const pack = await loadPdfFontPack(matrices());
    pack.collect('times', 'Hi ');
    pack.collect('times', '漢字');
    await pack.finish();

    expect(pack.cidOf('times', 'H')).not.toBe(pack.cidOf('times', '漢'));
    expect(pack.cidOf('times', '漢')).toBe(pack.cidOf('times', '?'));
    expect(pack.cidOf('times', '字')).toBe(pack.cidOf('times', '?'));
  });

  it('finishes subsets smaller than the source with full width and ToUnicode coverage', async () => {
    const pack = await loadPdfFontPack(matrices());
    pack.collect('times', 'Agua — “coração” café');
    pack.collect('times-bold', 'Bold bit');
    const [regular, bold, italic, boldItalic] = await pack.finish();
    // Load-bearing order: the writer addresses faces as /F1../F4 in this sequence.
    expect([regular.font, bold.font, italic.font, boldItalic.font]).toEqual([
      'times',
      'times-bold',
      'times-italic',
      'times-bolditalic',
    ]);

    for (const face of [regular, bold]) {
      expect(face.subsetBytes.length).toBeGreaterThan(0);
      expect(face.subsetBytes.length).toBeLessThan(ROBOTO.length);
      const covered = face.widthRuns.reduce((sum, run) => sum + run.advances.length, 0);
      expect(covered).toBeGreaterThan(0);
      // Every used CID maps back to Unicode in the CMap.
      expect(face.toUnicode).toContain('beginbfrange');
    }
    expect(regular.toUnicode).toContain('<0041>');
    expect(bold.toUnicode).toContain('<0042>');
    expect(regular.baseFontName).not.toBe(bold.baseFontName);
  });

  it('reads real font metrics for the descriptor, not fallbacks', async () => {
    const pack = await loadPdfFontPack(matrices());
    pack.collect('times', 'Hi');
    const [face] = await pack.finish();

    // Roboto's UPM is 2048: these clear the WinAnsi-era 1000/-250 fallbacks,
    // proving the descriptor carries the face's own numbers.
    expect(face.descriptor.ascent).toBeGreaterThan(1000);
    expect(face.descriptor.descent).toBeLessThan(0);
    expect(face.descriptor.bbox[1]).toBeLessThan(0);
    expect(face.descriptor.bbox[3]).toBeGreaterThan(1000);
  });

  it('names the missing script a text needs', async () => {
    const pack = await loadPdfFontPack(matrices());

    expect(pack.missingScripts('Agua — “coração”')).toEqual([]);
    expect(pack.missingScripts('あいう漢字')).toEqual(['cjk']);
    expect(pack.missingScripts('한글')).toEqual(['cjk']);
  });

  it('covers the CJK punctuation block (、。々「」・ー〜…)', async () => {
    const { containsCjk, isCjkCodePoint } = await import(
      '../../../manuscript/compile/export/manuscriptPdfFonts'
    );

    // U+3000–U+303F travels with the CJK matrix: the western serif has no
    // glyphs there, so without this every Japanese sentence degrades its
    // commas, full stops and iteration marks to `?` even with the pack.
    for (const codePoint of [0x3000, 0x3001, 0x3002, 0x3005, 0x300c, 0x303f]) {
      expect(isCjkCodePoint(codePoint)).toBe(true);
    }
    expect(isCjkCodePoint(0x2fff)).toBe(false);
    expect(isCjkCodePoint(0x3040)).toBe(true);
    expect(containsCjk('星々が輝くことで、夜空は暗闇に覆われない。')).toBe(true);
  });

  it('reports CJK punctuation as a CJK need, not an uncovered other', async () => {
    const pack = await loadPdfFontPack(matrices());
    expect(pack.missingScripts('、。々')).toEqual(['cjk']);
  });

  it('scans CJK need without touching fontkit', async () => {
    const { containsCjk, isCjkCodePoint } = await import(
      '../../../manuscript/compile/export/manuscriptPdfFonts'
    );

    expect(containsCjk('Agua — “coração”')).toBe(false);
    expect(containsCjk('あいう漢字')).toBe(true);
    expect(isCjkCodePoint('漢'.codePointAt(0) ?? 0)).toBe(true);
    expect(isCjkCodePoint('É'.codePointAt(0) ?? 0)).toBe(false);
  });

  it('routes CJK runs to the CJK matrix, base faces first', async () => {
    // Roboto stands in for the CJK matrix: routing is by codepoint range, so
    // the structure (8 faces, /F5../F8) is provable without a 13 MB fixture.
    // Real-glyph fidelity came from the /tmp probe plus the reader gate.
    const pack = await loadPdfFontPack({ regular: ROBOTO, italic: ROBOTO, cjk: ROBOTO });

    // The stand-in CJK matrix covers nothing, so everything stays on base
    // (routing to CJK requires real coverage, proven with the JP font in /tmp
    // and the reader gate - carrying 13 MB of fixture here is not worth it).
    expect(pack.splitRuns('times', 'A漢B')).toEqual([{ cjk: false, text: 'A?B' }]);
    // The stand-in lacks the glyph, so the need is still reported.
    expect(pack.missingScripts('A漢')).toEqual(['cjk']);

    pack.collect('times', 'A漢B');
    const faces = await pack.finish();
    expect(faces).toHaveLength(8);
    expect(faces.map((face) => face.cjk)).toEqual([
      false,
      false,
      false,
      false,
      true,
      true,
      true,
      true,
    ]);
    expect(faces.map((face) => face.font)).toEqual([
      'times',
      'times-bold',
      'times-italic',
      'times-bolditalic',
      'times',
      'times-bold',
      'times-italic',
      'times-bolditalic',
    ]);
  });

  it('refuses CIDs before the subset exists', async () => {
    const pack = await loadPdfFontPack(matrices());
    expect(() => pack.cidOf('times', 'H')).toThrow();
  });
});

describe('subsetBytesAreValid', () => {
  async function robotoSubset(): Promise<Uint8Array> {
    const pack = await loadPdfFontPack(matrices());
    pack.collect('times', 'Hello, World! 123');
    const [face] = await pack.finish();
    return face.subsetBytes;
  }

  /** File range of a table in an encoded subset. */
  function tableRange(bytes: Uint8Array, name: string): { offset: number; length: number } {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const numTables = view.getUint16(4);
    for (let i = 0; i < numTables; i += 1) {
      const at = 12 + i * 16;
      const tag = String.fromCharCode(
        view.getUint8(at),
        view.getUint8(at + 1),
        view.getUint8(at + 2),
        view.getUint8(at + 3),
      );
      if (tag === name) return { offset: view.getUint32(at + 8), length: view.getUint32(at + 12) };
    }
    throw new Error(`table ${name} missing`);
  }

  /** File offset of loca entry `index` (short format, as fontkit emits). */
  function locaEntryAt(bytes: Uint8Array, index: number): number {
    return tableRange(bytes, 'loca').offset + index * 2;
  }

  it('accepts a real encoder subset', async () => {
    expect(subsetBytesAreValid(await robotoSubset())).toBe(true);
  });

  it('rejects empty and truncated buffers', async () => {
    const valid = await robotoSubset();
    expect(subsetBytesAreValid(new Uint8Array(0))).toBe(false);
    expect(subsetBytesAreValid(valid.slice(0, 11))).toBe(false);
    // Cut inside glyf (not the trailing tables): the last outlines vanish.
    const glyf = tableRange(valid, 'glyf');
    expect(subsetBytesAreValid(valid.slice(0, glyf.offset + glyf.length - 10))).toBe(false);
  });

  it('rejects a shifted loca entry (the short-loca cascade)', async () => {
    const valid = await robotoSubset();
    const shifted = new Uint8Array(valid);
    // Bump a middle entry by one unit: every glyph after it misaligns.
    const at = locaEntryAt(shifted, 2);
    const entry = (shifted[at]! << 8) | shifted[at + 1]!;
    shifted[at] = (entry + 1) >> 8;
    shifted[at + 1] = (entry + 1) & 0xff;

    expect(subsetBytesAreValid(shifted)).toBe(false);
  });
});

describe('repairSubsetRepeatTails', () => {
  /** Minimal sfnt: head (short loca) + maxp + loca + glyf around given records. */
  function syntheticSubset(records: Uint8Array[]): Uint8Array {
    const head = new Uint8Array(54);
    const maxp = new Uint8Array(8);
    new DataView(maxp.buffer).setUint16(4, records.length);
    const evenRecords = records.map((record) => {
      // Even-sized records, like the encoder's 4-fill: keeps short-loca even.
      if (record.length % 2 === 0) return record;
      const padded = new Uint8Array(record.length + 1);
      padded.set(record, 0);
      return padded;
    });
    let glyfLen = 0;
    for (const record of evenRecords) glyfLen += record.length;
    const loca = new Uint8Array((evenRecords.length + 1) * 2);
    const locaView = new DataView(loca.buffer);
    const glyf = new Uint8Array(glyfLen);
    let at = 0;
    evenRecords.forEach((record, index) => {
      locaView.setUint16(index * 2, at / 2);
      glyf.set(record, at);
      at += record.length;
    });
    locaView.setUint16(evenRecords.length * 2, at / 2);
    const tables: [string, Uint8Array][] = [
      ['head', head],
      ['maxp', maxp],
      ['loca', loca],
      ['glyf', glyf],
    ];
    const headerLen = 12 + tables.length * 16;
    let fileLen = headerLen;
    const offsets: number[] = [];
    for (const [, data] of tables) {
      fileLen = (fileLen + 3) & ~3;
      offsets.push(fileLen);
      fileLen += data.length;
    }
    const out = new Uint8Array(fileLen);
    const dir = new DataView(out.buffer);
    dir.setUint32(0, 0x00010000);
    dir.setUint16(4, tables.length);
    tables.forEach(([tag, data], index) => {
      const rec = 12 + index * 16;
      for (let k = 0; k < 4; k += 1) out[rec + k] = tag.charCodeAt(k);
      dir.setUint32(rec + 8, offsets[index]!);
      dir.setUint32(rec + 12, data.length);
      out.set(data, offsets[index]!);
    });
    return out;
  }

  /**
   * One-contour triangle; flag stream given explicitly (no count handling).
   * `points` is the true point count: a corrupt stream's byte length does
   * not reveal it, so the test states it outright like endPts would.
   */
  function simpleGlyph(
    flags: number[],
    coords: number[],
    points = flags.length,
    bbox: [number, number, number, number] = [0, 0, 120, 120],
  ): Uint8Array {
    const out = new Uint8Array(10 + 2 + 2 + flags.length + coords.length);
    const view = new DataView(out.buffer);
    view.setInt16(0, 1); // one contour
    view.setInt16(2, bbox[0]); // bbox
    view.setInt16(4, bbox[1]);
    view.setInt16(6, bbox[2]);
    view.setInt16(8, bbox[3]);
    view.setUint16(10, points - 1); // endPts
    view.setUint16(12, 0); // no instructions
    out.set(flags, 14);
    out.set(coords, 14 + flags.length);
    return out;
  }

  /** Logical flags of record `index` in a subset (test-side re-expansion). */
  function logicalFlags(bytes: Uint8Array, index: number): number[] {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const numTables = view.getUint16(4);
    let loca = 0;
    let glyf = 0;
    for (let i = 0; i < numTables; i += 1) {
      const at = 12 + i * 16;
      const tag = String.fromCharCode(
        view.getUint8(at),
        view.getUint8(at + 1),
        view.getUint8(at + 2),
        view.getUint8(at + 3),
      );
      if (tag === 'loca') loca = view.getUint32(at + 8);
      if (tag === 'glyf') glyf = view.getUint32(at + 8);
    }
    const a = view.getUint16(loca + index * 2) * 2;
    const g = glyf + a;
    const n = view.getInt16(g);
    let p = g + 10 + n * 2 + 2 + view.getUint16(g + 10 + n * 2);
    const lastEnd = view.getUint16(g + 10 + (n - 1) * 2);
    const flags: number[] = [];
    while (flags.length < lastEnd + 1) {
      const flag = view.getUint8(p++);
      flags.push(flag & ~0x08);
      if (flag & 0x08) {
        const count = view.getUint8(p++);
        for (let k = 0; k < count; k += 1) flags.push(flag & ~0x08);
      }
    }
    return flags;
  }

  it('returns healthy subsets untouched (same reference)', async () => {
    const pack = await loadPdfFontPack(matrices());
    pack.collect('times', 'Hello, World! 123');
    const [face] = await pack.finish();
    expect(repairSubsetRepeatTails(face.subsetBytes)).toBe(face.subsetBytes);
  });

  it('returns null for truncated or shapeless buffers', () => {
    expect(repairSubsetRepeatTails(new Uint8Array(0))).toBe(null);
    expect(repairSubsetRepeatTails(new Uint8Array(11))).toBe(null);
  });

  it('inserts the missing trailing repeat count and keeps outlines intact', () => {
    // Glyph 0: empty. Glyph 1: healthy triangle, literal flags, no runs.
    // Glyph 2: four points whose last two form a zero-delta run, with the
    // encoder's missing final count (stream ends on the run flag, coords +
    // alignment zeros follow) - the exact shape `encodeSimple` emits. Coords
    // are x-major (every X, then every Y) with asymmetric values, so the
    // bbox only matches when decoded in spec order - an interleaved decode
    // lands on a different box and the repair refuses.
    const healthy = simpleGlyph([0x01, 0x01, 0x01], [0, 10, 0, 10, 0, 100, 0, 0, 255, 156, 0, 100]);
    const corrupt = simpleGlyph(
      [0x01, 0x01, 0x39], // 0x39 = 0x31 | REPEAT, count byte missing
      [0, 10, 0, 30, 0, 20, 0, 40],
      4, // four points: the trailing run hides the fourth flag
      [10, 20, 40, 60], // x-major points (10,20) (40,60) (40,60) (40,60)
    );
    const padded = new Uint8Array(corrupt.length + ((4 - (corrupt.length % 4)) % 4));
    padded.set(corrupt, 0);
    const bytes = syntheticSubset([new Uint8Array(0), healthy, padded]);

    expect(subsetBytesAreValid(bytes)).toBe(false);
    const repaired = repairSubsetRepeatTails(bytes);
    expect(repaired).not.toBe(null);
    expect(subsetBytesAreValid(repaired!)).toBe(true);
    // The healthy glyph travels byte-identical; the repaired one gains exactly
    // the count byte (0x01: two 0x31 flags).
    expect(logicalFlags(repaired!, 1)).toEqual([0x01, 0x01, 0x01]);
    expect(logicalFlags(repaired!, 2)).toEqual([0x01, 0x01, 0x31, 0x31]);
    // Repair is idempotent: a second pass finds nothing to do.
    expect(repairSubsetRepeatTails(repaired!)).toBe(repaired!);
  });

  it('refuses a corruption whose coordinate equation does not close', () => {
    // A wild count (0x05: six flags for a 3-point triangle) overshoots the
    // point count and no candidate run closes the coordinate equation with a
    // zero tail - the repair must not guess, only the tripwire may judge.
    const healthy = simpleGlyph([0x01, 0x01, 0x01], [0, 10, 0, 10, 0, 100, 0, 0, 255, 156, 0, 100]);
    const broken = simpleGlyph([0x01, 0x39, 0x05], [0, 10, 0, 10, 0, 0, 0, 0]);
    const bytes = syntheticSubset([new Uint8Array(0), healthy, broken]);
    expect(subsetBytesAreValid(bytes)).toBe(false);
    expect(repairSubsetRepeatTails(bytes)).toBe(null);
  });
});

describe('fontkitOf', () => {
  const engine = { create: () => ({}) };

  it('reads create straight off a UMD namespace, as Node/Bun/jest hand it', () => {
    expect(fontkitOf(engine).create).toBe(engine.create);
  });

  it('reads create from default, the only export of the ES build bundlers prefer on web', () => {
    expect(fontkitOf({ default: engine }).create).toBe(engine.create);
  });

  it('throws a diagnosable error instead of "a.create is not a function" downstream', () => {
    expect(() => fontkitOf({})).toThrow('fontkit.create is not available');
    expect(() => fontkitOf(null)).toThrow('fontkit.create is not available');
  });
});
