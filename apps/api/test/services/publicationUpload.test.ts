import { MAX_MANUSCRIPT_BYTES } from '@keres/shared';
import { describe, expect, it } from 'vitest';
import {
  validateUploadedManuscript,
  validateUploadedReader,
} from '../../src/services/publicationCompile';
import { AppError } from '../../src/utils/errors';

function statusOf(fn: () => unknown): number {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    return (error as AppError).status;
  }
  throw new Error('Expected the validation to fail.');
}

const mdBytes = () => new TextEncoder().encode('# The Book\n\nFiled body.\n');
const htmlBytes = () =>
  new TextEncoder().encode('<!DOCTYPE html><html><head></head><body>Hi</body></html>');
const pdfBytes = () =>
  new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x25, 0x25, 0x0a]);
const zipBytes = () =>
  new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);

describe('validateUploadedManuscript', () => {
  it('accepts text bytes with a matching name and MIME type', () => {
    const bytes = mdBytes();

    const validated = validateUploadedManuscript(bytes, 'md', 'book.md', 'text/markdown');

    expect(validated.bytes).toBe(bytes);
    expect(validated.format).toBe('md');
  });

  it('accepts bytes with no name or MIME type to check against', () => {
    expect(validateUploadedManuscript(mdBytes(), 'md').format).toBe('md');
  });

  it('accepts a generic octet-stream sender', () => {
    expect(
      validateUploadedManuscript(mdBytes(), 'md', 'book.md', 'application/octet-stream').format,
    ).toBe('md');
  });

  it('accepts PDF bytes for both PDF formats sharing the extension', () => {
    expect(validateUploadedManuscript(pdfBytes(), 'pdf', 'book.pdf').format).toBe('pdf');
    expect(
      validateUploadedManuscript(pdfBytes(), 'screenplay-pdf', 'script.pdf', 'application/pdf')
        .format,
    ).toBe('screenplay-pdf');
  });

  it('accepts zip bytes for the zipped formats', () => {
    expect(validateUploadedManuscript(zipBytes(), 'docx', 'book.docx').format).toBe('docx');
    expect(
      validateUploadedManuscript(zipBytes(), 'epub', 'book.epub', 'application/epub+zip').format,
    ).toBe('epub');
  });

  it('refuses PDF bytes posing as Markdown', () => {
    expect(statusOf(() => validateUploadedManuscript(pdfBytes(), 'md', 'book.md'))).toBe(400);
  });

  it('refuses text bytes posing as PDF', () => {
    expect(statusOf(() => validateUploadedManuscript(mdBytes(), 'pdf', 'book.pdf'))).toBe(400);
  });

  it('refuses a file extension from another format', () => {
    expect(statusOf(() => validateUploadedManuscript(mdBytes(), 'md', 'book.pdf'))).toBe(400);
  });

  it('refuses a MIME type from another byte kind', () => {
    expect(
      statusOf(() => validateUploadedManuscript(mdBytes(), 'md', 'book.md', 'application/pdf')),
    ).toBe(400);
  });

  it('refuses an unknown format', () => {
    expect(statusOf(() => validateUploadedManuscript(mdBytes(), 'bogus' as never))).toBe(400);
  });

  it('refuses empty bytes', () => {
    expect(statusOf(() => validateUploadedManuscript(new Uint8Array(0), 'md', 'book.md'))).toBe(
      400,
    );
  });

  it('refuses bytes past the shared cap with 413', () => {
    const huge = new Uint8Array(MAX_MANUSCRIPT_BYTES + 1);

    expect(statusOf(() => validateUploadedManuscript(huge, 'md', 'book.md'))).toBe(413);
  });

  it('refuses a non-document as HTML', () => {
    expect(statusOf(() => validateUploadedManuscript(mdBytes(), 'html', 'book.html'))).toBe(400);
    expect(validateUploadedManuscript(htmlBytes(), 'html', 'book.html').format).toBe('html');
  });
});

describe('validateUploadedReader', () => {
  it('accepts an HTML document', () => {
    const bytes = htmlBytes();

    expect(validateUploadedReader(bytes, 'reader.html', 'text/html').bytes).toBe(bytes);
  });

  it('accepts bytes with no name or MIME type to check against', () => {
    expect(validateUploadedReader(htmlBytes()).bytes).toBeDefined();
  });

  it('refuses a non-HTML extension', () => {
    expect(statusOf(() => validateUploadedReader(htmlBytes(), 'reader.txt'))).toBe(400);
  });

  it('refuses text without markup', () => {
    expect(statusOf(() => validateUploadedReader(mdBytes(), 'reader.html'))).toBe(400);
  });

  it('refuses PDF bytes', () => {
    expect(statusOf(() => validateUploadedReader(pdfBytes(), 'reader.html'))).toBe(400);
  });

  it('refuses a non-text MIME type', () => {
    expect(
      statusOf(() => validateUploadedReader(htmlBytes(), 'reader.html', 'application/pdf')),
    ).toBe(400);
  });

  it('refuses empty bytes', () => {
    expect(statusOf(() => validateUploadedReader(new Uint8Array(0), 'reader.html'))).toBe(400);
  });

  it('refuses bytes past the shared cap with 413', () => {
    const huge = new Uint8Array(MAX_MANUSCRIPT_BYTES + 1);

    expect(statusOf(() => validateUploadedReader(huge, 'reader.html'))).toBe(413);
  });
});
