import { deflate } from 'pako';
import { winAnsiByte } from '../compile/export/manuscriptPdfLayout';
import {
  layoutScreenplay,
  screenplayPreset,
  type ScreenplayLayout,
  type ScreenplayLine,
  type ScreenplayPaper,
  type ScreenplaySegment,
} from './screenplayLayout';

/*
 * Draws a laid-out screenplay as a PDF. Courier is one of the fourteen fonts every PDF reader has, so
 * nothing is embedded and the file stays small; and because Courier is monospaced, every character
 * lands on the grid the layout already worked out. Encoding is WinAnsi, which covers Portuguese and
 * English; a character outside it degrades to `?`, as in the book PDF.
 */

const FONT_NAMES = ['Courier', 'Courier-Bold', 'Courier-Oblique', 'Courier-BoldOblique'] as const;

function fontIndexOf(segment: Pick<ScreenplaySegment, 'bold' | 'italic'>): number {
  return (segment.bold ? 1 : 0) + (segment.italic ? 2 : 0);
}

function literal(text: string): string {
  let out = '(';
  for (const char of text) {
    const byte = winAnsiByte(char);
    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) out += '\\';
    out += String.fromCharCode(byte);
  }
  return `${out})`;
}

function ascii(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) {
    bytes[index] = text.charCodeAt(index) & 0xff;
  }
  return bytes;
}

const number = (value: number) => (Math.round(value * 100) / 100).toString();

/** One run of text at a point, as the page needs it. */
type Placed = { x: number; y: number; text: string; font: number; underline: boolean };

function contentOf(placed: Placed[], size: number, widthOf: (text: string) => number): string {
  const parts: string[] = [];
  for (const run of placed) {
    parts.push(
      `BT /F${run.font + 1} ${number(size)} Tf 1 0 0 1 ${number(run.x)} ${number(run.y)} Tm ${literal(run.text)} Tj ET`,
    );
    if (run.underline) {
      const width = widthOf(run.text);
      parts.push(
        `q 0.6 w ${number(run.x)} ${number(run.y - 1.6)} m ${number(run.x + width)} ${number(run.y - 1.6)} l S Q`,
      );
    }
  }
  return parts.join('\n');
}

function placeLine(
  line: ScreenplayLine,
  layout: ScreenplayLayout,
  baselineOf: (row: number) => number,
): Placed[] {
  const { charWidthPt } = layout.geometry;
  const placed: Placed[] = [];
  let column = line.column;
  for (const segment of line.segments) {
    if (segment.text !== '') {
      placed.push({
        x: column * charWidthPt,
        y: baselineOf(line.row),
        text: segment.text,
        font: fontIndexOf(segment),
        underline: segment.underline,
      });
    }
    column += segment.text.length;
  }
  if (line.sceneNumber) {
    const right =
      layout.preset.marginLeftIn * layout.preset.charactersPerInch + layout.geometry.actionColumns;
    placed.push({
      x: (line.column - 1 - line.sceneNumber.length) * charWidthPt,
      y: baselineOf(line.row),
      text: line.sceneNumber,
      font: 0,
      underline: false,
    });
    placed.push({
      x: (right + 1) * charWidthPt,
      y: baselineOf(line.row),
      text: line.sceneNumber,
      font: 0,
      underline: false,
    });
  }
  return placed;
}

function titlePagePlacements(layout: ScreenplayLayout): Placed[] {
  const { preset, geometry } = layout;
  const valueOf = (key: string) =>
    layout.titlePage.find((entry) => entry.key.toLowerCase() === key)?.value ?? '';
  const centered = (text: string, y: number, font = 0): Placed => ({
    x: Math.max(0, (preset.pageWidthPt - text.length * geometry.charWidthPt) / 2),
    y,
    text,
    font,
    underline: false,
  });
  const placed: Placed[] = [];
  let y = preset.pageHeightPt * 0.62;
  const title = valueOf('title');
  for (const line of title ? title.split('\n') : []) {
    placed.push(centered(line.toUpperCase(), y, 1));
    y -= geometry.lineHeightPt;
  }
  y -= geometry.lineHeightPt * 2;
  for (const key of ['credit', 'author', 'authors', 'source']) {
    const value = valueOf(key);
    for (const line of value ? value.split('\n') : []) {
      placed.push(centered(line, y));
      y -= geometry.lineHeightPt;
    }
    if (value) y -= geometry.lineHeightPt;
  }
  const left = preset.marginLeftIn * 72;
  let contactY = 1.5 * 72 + valueOf('contact').split('\n').length * geometry.lineHeightPt;
  for (const line of valueOf('contact') ? valueOf('contact').split('\n') : []) {
    contactY -= geometry.lineHeightPt;
    placed.push({ x: left, y: contactY, text: line, font: 0, underline: false });
  }
  const date = valueOf('draft date') || valueOf('date');
  if (date) {
    placed.push({
      x: preset.pageWidthPt - 72 - date.length * geometry.charWidthPt,
      y: 1.5 * 72,
      text: date,
      font: 0,
      underline: false,
    });
  }
  return placed;
}

export type ScreenplayPdfMeta = { title?: string | null; author?: string | null };

/** Renders the laid-out pages as a PDF: a title page when one was written, then the numbered script. */
export function renderScreenplayPdf(
  layout: ScreenplayLayout,
  meta: ScreenplayPdfMeta = {},
): Uint8Array {
  const { preset, geometry } = layout;
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const write = (bytes: Uint8Array) => {
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (id: number, body: Uint8Array | string) => {
    offsets[id - 1] = length;
    write(ascii(`${id} 0 obj\n`));
    write(typeof body === 'string' ? ascii(body) : body);
    write(ascii('\nendobj\n'));
  };
  const widthOf = (text: string) => text.length * geometry.charWidthPt;
  const baselineOf = (row: number) =>
    preset.pageHeightPt - preset.marginTopIn * 72 - (row + 1) * geometry.lineHeightPt + 3;

  const pageContents: string[] = [];
  const hasTitlePage = layout.titlePage.length > 0;
  if (hasTitlePage) {
    pageContents.push(contentOf(titlePagePlacements(layout), preset.fontSizePt, widthOf));
  }
  const numberRight =
    (preset.marginLeftIn * preset.charactersPerInch + geometry.actionColumns) *
    geometry.charWidthPt;
  layout.pages.forEach((page, index) => {
    const placed = page.lines.flatMap((line) => placeLine(line, layout, baselineOf));
    // Page 1 carries no number; from the second on, "2." sits in the top right margin.
    if (index > 0) {
      const label = `${index + 1}.`;
      placed.push({
        x: numberRight - label.length * geometry.charWidthPt,
        y: preset.pageHeightPt - 0.5 * 72 - 9,
        text: label,
        font: 0,
        underline: false,
      });
    }
    pageContents.push(contentOf(placed, preset.fontSizePt, widthOf));
  });
  if (pageContents.length === 0) pageContents.push('');

  const fontFirst = 3;
  const infoId = fontFirst + FONT_NAMES.length;
  const pageFirst = infoId + 1;
  const pageIds = pageContents.map((_, index) => pageFirst + index * 2);

  write(ascii('%PDF-1.4\n%âãÏÓ\n'));
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(
    2,
    `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`,
  );
  FONT_NAMES.forEach((name, index) => {
    object(
      fontFirst + index,
      `<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>`,
    );
  });
  object(
    infoId,
    `<< /Producer (Keres)${meta.title ? ` /Title ${literal(meta.title)}` : ''}${
      meta.author ? ` /Author ${literal(meta.author)}` : ''
    } >>`,
  );
  const fontResources = FONT_NAMES.map(
    (_, index) => `/F${index + 1} ${fontFirst + index} 0 R`,
  ).join(' ');
  pageContents.forEach((content, index) => {
    const pageId = pageIds[index];
    object(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${number(preset.pageWidthPt)} ${number(
        preset.pageHeightPt,
      )}] /Resources << /Font << ${fontResources} >> >> /Contents ${pageId + 1} 0 R >>`,
    );
    // The page's bytes are WinAnsi, one byte per character, deflated like the book's.
    const stream = deflate(ascii(content));
    offsets[pageId] = length;
    write(
      ascii(`${pageId + 1} 0 obj\n<< /Length ${stream.length} /Filter /FlateDecode >>\nstream\n`),
    );
    write(stream);
    write(ascii('\nendstream\nendobj\n'));
  });

  const xrefAt = length;
  const total = offsets.length + 1;
  let xref = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (const offset of offsets) xref += `${String(offset).padStart(10, '0')} 00000 n \n`;
  write(
    ascii(
      `${xref}trailer\n<< /Size ${total} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefAt}\n%%EOF`,
    ),
  );

  const out = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

/** Fountain text to a screenplay PDF on the chosen paper, with the number of script pages it made. */
export function screenplayPdfFromFountain(
  fountain: string,
  options: { paper?: ScreenplayPaper; meta?: ScreenplayPdfMeta } = {},
): { bytes: Uint8Array; pages: number } {
  const layout = layoutScreenplay(fountain, screenplayPreset(options.paper ?? 'letter'));
  const entry = (key: string) =>
    layout.titlePage.find((row) => row.key.toLowerCase() === key)?.value.split('\n')[0] ?? null;
  return {
    bytes: renderScreenplayPdf(layout, {
      title: options.meta?.title ?? entry('title'),
      author: options.meta?.author ?? entry('author'),
    }),
    pages: layout.pages.length,
  };
}
