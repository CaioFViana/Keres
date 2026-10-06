import { inflate } from 'pako';
import { describe, expect, it } from 'vitest';
import { screenplayPdfFromFountain } from '../../../manuscript/screenplay/screenplayPdf';

const latin1 = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');

/** The text of each page's content stream, inflated. */
function pageStreams(bytes: Uint8Array): string[] {
  const raw = latin1(bytes);
  const streams: string[] = [];
  const pattern = /stream\n([\s\S]*?)\nendstream/g;
  for (let match = pattern.exec(raw); match !== null; match = pattern.exec(raw)) {
    const data = Uint8Array.from(match[1], (char) => char.charCodeAt(0));
    streams.push(latin1(inflate(data)));
  }
  return streams;
}

describe('renderScreenplayPdf', () => {
  it('writes a PDF with the four Courier faces and the right page size', () => {
    const { bytes } = screenplayPdfFromFountain('INT. KITCHEN\n\nShe waits.');
    const raw = latin1(bytes);

    expect(raw.startsWith('%PDF-1.4')).toBe(true);
    expect(raw.trimEnd().endsWith('%%EOF')).toBe(true);
    for (const face of ['Courier', 'Courier-Bold', 'Courier-Oblique', 'Courier-BoldOblique']) {
      expect(raw).toContain(`/BaseFont /${face}`);
    }
    expect(raw).toContain('/MediaBox [0 0 612 792]');
  });

  it('uses A4 when asked', () => {
    const { bytes } = screenplayPdfFromFountain('INT. A\n\nOne.', { paper: 'a4' });

    expect(latin1(bytes)).toContain('/MediaBox [0 0 595.28 841.89]');
  });

  it('puts each element at its column: 1.5" for action, 2.5" for dialogue, 3.7" for the cue', () => {
    const { bytes } = screenplayPdfFromFountain('INT. A\n\nShe waits.\n\nMOM\nBe careful.');
    const [page] = pageStreams(bytes);

    // x is columns * 7.2 pt: 15 -> 108, 25 -> 180, 37 -> 266.4.
    expect(page).toMatch(/1 0 0 1 108 \d+(\.\d+)? Tm \(INT\. A\) Tj/);
    expect(page).toMatch(/1 0 0 1 108 \d+(\.\d+)? Tm \(She waits\.\) Tj/);
    expect(page).toMatch(/1 0 0 1 266\.4 \d+(\.\d+)? Tm \(MOM\) Tj/);
    expect(page).toMatch(/1 0 0 1 180 \d+(\.\d+)? Tm \(Be careful\.\) Tj/);
  });

  it('draws emphasis with the matching face and underlines with a line', () => {
    const { bytes } = screenplayPdfFromFountain('INT. A\n\n**Bold** *slant* _under_.');
    const [page] = pageStreams(bytes);

    expect(page).toContain('/F2 12 Tf');
    expect(page).toContain('(Bold) Tj');
    expect(page).toContain('/F3 12 Tf');
    expect(page).toContain('(slant) Tj');
    expect(page).toMatch(/q 0\.6 w [\d.]+ [\d.]+ m [\d.]+ [\d.]+ l S Q/);
  });

  it('escapes parentheses and keeps accents', () => {
    const { bytes } = screenplayPdfFromFountain('INT. A\n\nCafé (and tea) \\ done.');
    const [page] = pageStreams(bytes);

    expect(page).toContain('Café \\(and tea\\)');
  });

  it('numbers pages from the second, in the top right margin, and not the first', () => {
    const script = Array.from({ length: 70 }, (_, number) => `Beat ${number + 1}.`).join('\n\n');
    const { bytes, pages } = screenplayPdfFromFountain(script);
    const streams = pageStreams(bytes);

    expect(pages).toBe(3);
    expect(streams).toHaveLength(3);
    expect(streams[0]).not.toMatch(/\(1\.\) Tj/);
    expect(streams[1]).toContain('(2.) Tj');
    expect(streams[2]).toContain('(3.) Tj');
  });

  it('adds a title page that is not counted among the script pages', () => {
    const { bytes, pages } = screenplayPdfFromFountain(
      'Title: The Heist\nCredit: Written by\nAuthor: Ana\nDraft date: 2026-10-06\n\nINT. A\n\nOne.',
    );
    const streams = pageStreams(bytes);

    expect(pages).toBe(1);
    expect(streams).toHaveLength(2);
    expect(streams[0]).toContain('(THE HEIST) Tj');
    expect(streams[0]).toContain('(Written by) Tj');
    expect(streams[0]).toContain('(Ana) Tj');
    expect(streams[0]).toContain('(2026-10-06) Tj');
    expect(latin1(bytes)).toContain('/Title (The Heist)');
    expect(latin1(bytes)).toContain('/Author (Ana)');
  });

  it('prints the scene number in both margins', () => {
    const { bytes } = screenplayPdfFromFountain('INT. A #12#\n\nOne.');
    const [page] = pageStreams(bytes);

    expect(page.match(/\(12\) Tj/g)).toHaveLength(2);
  });

  it('keeps a cross-reference table whose offsets point at their objects', () => {
    const { bytes } = screenplayPdfFromFountain('Title: X\n\nINT. A\n\nOne.\n\n===\n\nTwo.');
    const raw = latin1(bytes);
    const startxref = Number(/startxref\n(\d+)\n%%EOF/.exec(raw)![1]);

    expect(raw.slice(startxref, startxref + 4)).toBe('xref');
    const entries = [...raw.slice(startxref).matchAll(/^(\d{10}) 00000 n $/gm)];
    expect(entries.length).toBeGreaterThanOrEqual(8);
    entries.forEach((entry, index) => {
      const at = Number(entry[1]);
      expect(raw.slice(at, at + 12)).toMatch(new RegExp(`^${index + 1} 0 obj`));
    });
    expect(Number(/\/Size (\d+)/.exec(raw)![1])).toBe(entries.length + 1);
  });

  it('still makes a valid file from nothing', () => {
    const { bytes, pages } = screenplayPdfFromFountain('');

    expect(pages).toBe(0);
    expect(latin1(bytes)).toContain('%%EOF');
  });
});
