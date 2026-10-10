/**
 * Structural check and byte-level repair of the TrueType subsets the PDF font pack encodes.
 * Pure byte work over a DataView with no imports: `manuscriptPdfFonts.ts` calls the two
 * entry points and re-exports them.
 */

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
