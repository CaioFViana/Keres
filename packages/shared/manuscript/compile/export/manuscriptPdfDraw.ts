import { assertWithinManuscriptLimit } from '../manuscriptSize';
import type { PdfFontPack } from './manuscriptPdfFonts';
import {
  widthOfTextAtSize,
  winAnsiByte,
  type LineRun,
  type PdfFont,
  type PdfGeometry,
  type PdfMeasure,
  type Word,
} from './manuscriptPdfLayout';

/**
 * Low-level drawing and encoding of the manuscript PDF: the byte sink (`PdfWriter`), one line of
 * text with its decoration rules, and one picture, all as content-stream operators. Layout lives
 * in `manuscriptPdfLayout.ts` and `manuscriptPdfRuns.ts`; `manuscriptPdf.ts` assembles the file.
 */

export const FONT_KEYS: PdfFont[] = ['times', 'times-bold', 'times-italic', 'times-bolditalic'];

function escapeLiteral(text: string): number[] {
  const bytes: number[] = [];
  for (const char of text) {
    if (char === '(' || char === ')' || char === '\\') bytes.push(0x5c);
    bytes.push(winAnsiByte(char));
  }
  return bytes;
}

/**
 * UTF-16BE with BOM for document metadata: page bytes are WinAnsi (the
 * standard-font constraint), but Info strings may carry the full title —
 * accents, quotes, even emoji — so they get the encoding readers expect.
 */
export function utf16beHex(text: string): string {
  const bytes: number[] = [0xfe, 0xff];
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0x3f;
    if (code > 0xffff) {
      const value = code - 0x10000;
      const high = 0xd800 + (value >> 10);
      const low = 0xdc00 + (value & 0x3ff);
      bytes.push(high >> 8, high & 0xff, low >> 8, low & 0xff);
    } else {
      bytes.push(code >> 8, code & 0xff);
    }
  }
  return bytes.map((byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join('');
}

export class PdfWriter {
  // Typed chunks: a book of tens of megabytes must not cost a JS number per byte.
  private chunks: Uint8Array[] = [];
  private offsets: number[] = [];
  private length = 0;
  // Coalesced ascii: thousands of tiny dictionary writes share one buffer
  // instead of one Uint8Array each. Flushed before anything position- or
  // order-sensitive (offsets, binary, snapshot), so byte order never changes.
  private pending = '';

  private push(bytes: Uint8Array): void {
    this.chunks.push(bytes);
    this.length += bytes.length;
    // A book already past the limit stops here, page by page, instead of finishing a file to throw away.
    assertWithinManuscriptLimit(this.length);
  }

  private flush(): void {
    if (this.pending === '') return;
    const text = this.pending;
    this.pending = '';
    const bytes = new Uint8Array(text.length);
    for (let index = 0; index < text.length; index += 1) {
      bytes[index] = text.charCodeAt(index) & 0xff;
    }
    this.push(bytes);
  }

  ascii(text: string): void {
    this.pending += text;
  }

  raw(bytes: Uint8Array): void {
    this.flush();
    this.push(bytes);
  }

  snapshot(): Uint8Array {
    this.flush();
    const out = new Uint8Array(this.length);
    let at = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, at);
      at += chunk.length;
    }
    return out;
  }

  literal(text: string): void {
    this.flush();
    this.push(Uint8Array.from([0x28, ...escapeLiteral(text), 0x29]));
  }

  object(body: (writer: PdfWriter) => void): number {
    this.flush();
    const id = this.offsets.length + 1;
    this.offsets.push(this.length);
    this.ascii(`${id} 0 obj\n`);
    body(this);
    this.ascii(`endobj\n`);
    return id;
  }

  finish(rootId: number, infoId: number): Uint8Array {
    this.flush();
    const xrefAt = this.length;
    this.ascii(`xref\n0 ${this.offsets.length + 1}\n0000000000 65535 f \n`);
    for (const offset of this.offsets) {
      this.ascii(`${String(offset).padStart(10, '0')} 00000 n \n`);
    }
    this.ascii(
      `trailer\n<< /Size ${this.offsets.length + 1} /Root ${rootId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefAt}\n%%EOF`,
    );
    this.flush();
    const out = new Uint8Array(this.length);
    let at = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, at);
      at += chunk.length;
    }
    return out;
  }
}

function hex4(value: number): string {
  return value.toString(16).toUpperCase().padStart(4, '0');
}

export function drawLine(
  run: LineRun,
  y: number,
  writer: PdfWriter,
  geometry: PdfGeometry,
  measure: PdfMeasure = widthOfTextAtSize,
  pack: PdfFontPack | null = null,
): void {
  const fontIndex = (font: PdfFont): number => FONT_KEYS.indexOf(font) + 1;
  // Base faces ride /F1../F4; CJK matrices add /F5../F8 in the same face order.
  const resourceOf = (font: PdfFont, cjk: boolean): number =>
    fontIndex(font) + (cjk ? FONT_KEYS.length : 0);
  let x = geometry.margin + run.indent;
  if (run.centered) {
    const width = run.words.reduce((sum, word) => sum + word.width, 0);
    const gaps = run.words
      .slice(1)
      .reduce((sum, word) => sum + measure(' ', word.font, run.size), 0);
    x = geometry.margin + (geometry.contentWidth - (width + gaps)) / 2;
  }
  const gray = run.gray.toFixed(2);
  const placed: { word: Word; x: number }[] = [];
  // A line is one text object: the words are set as consecutive strings of one font, the spaces
  // between them inside the strings (each word's leading space is drawn in the word's own face,
  // exactly the advance the layout counted), so the viewer places every glyph itself. Only a
  // change of face starts a new string.
  const segments: { font: PdfFont; text: string }[] = [];
  run.words.forEach((word, index) => {
    if (index > 0) x += measure(' ', word.font, run.size);
    placed.push({ word, x });
    x += word.width;
    const last = segments[segments.length - 1];
    const piece = (index > 0 ? ' ' : '') + word.text;
    if (last && last.font === word.font) last.text += piece;
    else segments.push({ font: word.font, text: piece });
  });
  if (segments.length > 0) {
    // Glyph collection happens on the anchor-settling passes, never here: by
    // emit time the subset is finished and `cidOf` resolves.
    writer.ascii(`BT ${gray} g 1 0 0 1 ${trim(placed[0].x)} ${trim(y - run.size)} Tm`);
    for (const segment of segments) {
      if (pack) {
        // Identity-H: two bytes per glyph, resolved after the final pass; a
        // mixed-script segment splits into one string per matrix (/F1../F8).
        for (const part of pack.splitRuns(segment.font, segment.text)) {
          writer.ascii(` /F${resourceOf(segment.font, part.cjk)} ${trim(run.size)} Tf `);
          writer.ascii(
            `<${[...part.text].map((char) => hex4(pack.cidOf(segment.font, char))).join('')}>`,
          );
          writer.ascii(' Tj');
        }
      } else {
        writer.ascii(` /F${fontIndex(segment.font)} ${trim(run.size)} Tf `);
        writer.literal(segment.text);
        writer.ascii(' Tj');
      }
    }
    writer.ascii(' ET\n');
  }
  // Decoration rules, grouped over contiguous marked words so a multi-word
  // underline reads as one stroke instead of breaking at every space.
  const rules: { flag: 'underline' | 'strikethrough'; from: number; to: number }[] = [];
  const collect = (flag: 'underline' | 'strikethrough') => {
    let group: { from: number; to: number } | null = null;
    const flush = () => {
      if (group) rules.push({ flag, ...group });
      group = null;
    };
    for (const { word, x } of placed) {
      if (word[flag]) {
        if (group) group.to = x + word.width;
        else group = { from: x, to: x + word.width };
      } else {
        flush();
      }
    }
    flush();
  };
  collect('underline');
  collect('strikethrough');
  if (rules.length > 0) {
    const baseline = y - run.size;
    const thickness = Math.max(0.4, run.size * 0.05);
    writer.ascii(`${gray} g\n`);
    for (const rule of rules) {
      const ruleY =
        rule.flag === 'underline'
          ? baseline - run.size * 0.1 - thickness
          : baseline + run.size * 0.25 - thickness / 2;
      writer.ascii(
        `${trim(rule.from)} ${trim(ruleY)} ${trim(rule.to - rule.from)} ${trim(thickness)} re f\n`,
      );
    }
  }
}

export function trim(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** A page's picture: drawn in its frame, cropped to it when it fills the frame. */
export function drawPicture(
  run: LineRun,
  y: number,
  writer: PdfWriter,
  geometry: PdfGeometry,
  imageIndex: number,
): void {
  const picture = run.image!;
  const left = geometry.margin + (geometry.contentWidth - picture.frameWidth) / 2;
  const bottom = y - picture.frameHeight;
  writer.ascii('q ');
  if (picture.clip) {
    writer.ascii(
      `${trim(left)} ${trim(bottom)} ${trim(picture.frameWidth)} ${trim(picture.frameHeight)} re W n `,
    );
  }
  writer.ascii(
    `${trim(picture.width)} 0 0 ${trim(picture.height)} ${trim(left + picture.dx)} ${trim(bottom + picture.dy)} cm /Im${imageIndex} Do Q\n`,
  );
}
