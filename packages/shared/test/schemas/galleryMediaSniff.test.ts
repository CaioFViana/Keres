import { describe, expect, it } from 'vitest';
import {
  isSupportedMediaMimeType,
  MEDIA_SNIFF_HEADER_BYTES,
  mediaTypeForMimeType,
  sniffMediaMimeType,
} from '../../index';

function headerWith(bytes: number[], asciiAt?: [number, string]): Uint8Array {
  const header = new Uint8Array(MEDIA_SNIFF_HEADER_BYTES);
  header.set(bytes, 0);
  if (asciiAt) {
    const [offset, text] = asciiAt;
    for (let index = 0; index < text.length; index++) {
      header[offset + index] = text.charCodeAt(index);
    }
  }
  return header;
}

function ftypHeader(brand: string): Uint8Array {
  const header = new Uint8Array(MEDIA_SNIFF_HEADER_BYTES);
  header.set([0x00, 0x00, 0x00, 0x20], 0);
  header.set([0x66, 0x74, 0x79, 0x70], 4);
  for (let index = 0; index < brand.length; index++) {
    header[8 + index] = brand.charCodeAt(index);
  }
  return header;
}

function ebmlHeader(docType: string): Uint8Array {
  const header = new Uint8Array(MEDIA_SNIFF_HEADER_BYTES);
  header.set([0x1a, 0x45, 0xdf, 0xa3], 0);
  const at = 8;
  header[at] = 0x42;
  header[at + 1] = 0x82;
  header[at + 2] = 0x80 | docType.length;
  for (let index = 0; index < docType.length; index++) {
    header[at + 3 + index] = docType.charCodeAt(index);
  }
  return header;
}

describe('sniffMediaMimeType', () => {
  it('identifies images, audio frames, and documents from their magic bytes', () => {
    expect(sniffMediaMimeType(headerWith([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(
      sniffMediaMimeType(headerWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe('image/png');
    expect(sniffMediaMimeType(headerWith([], [0, 'GIF89a']))).toBe('image/gif');
    expect(sniffMediaMimeType(headerWith([0x42, 0x4d]))).toBe('image/bmp');
    expect(sniffMediaMimeType(headerWith([], [0, '%PDF-1.7']))).toBe('application/pdf');
    expect(sniffMediaMimeType(headerWith([], [0, 'OggS']))).toBe('audio/ogg');
    expect(sniffMediaMimeType(headerWith([], [0, 'fLaC']))).toBe('audio/flac');
    expect(sniffMediaMimeType(headerWith([], [0, 'ID3']))).toBe('audio/mpeg');
    // Raw MPEG frame (layer bits `11`) vs ADTS AAC frame (layer bits `00`).
    expect(sniffMediaMimeType(headerWith([0xff, 0xfb]))).toBe('audio/mpeg');
    expect(sniffMediaMimeType(headerWith([0xff, 0xf1]))).toBe('audio/aac');
  });

  it('reads RIFF form types and ISO BMFF brands', () => {
    expect(sniffMediaMimeType(headerWith([], [0, 'RIFFxxxxWAVE']))).toBe('audio/wav');
    expect(sniffMediaMimeType(headerWith([], [0, 'RIFFxxxxWEBP']))).toBe('image/webp');
    expect(sniffMediaMimeType(headerWith([], [0, 'RIFFxxxxAVI ']))).toBeUndefined();
    expect(sniffMediaMimeType(ftypHeader('isom'))).toBe('video/mp4');
    expect(sniffMediaMimeType(ftypHeader('qt  '))).toBe('video/quicktime');
    expect(sniffMediaMimeType(ftypHeader('M4V '))).toBe('video/x-m4v');
    expect(sniffMediaMimeType(ftypHeader('M4A '))).toBe('audio/mp4');
    expect(sniffMediaMimeType(ftypHeader('3gp4'))).toBe('video/3gpp');
    expect(sniffMediaMimeType(ftypHeader('heic'))).toBe('image/heic');
    expect(sniffMediaMimeType(ftypHeader('mif1'))).toBe('image/heif');
  });

  it('tells webm apart from matroska through the EBML DocType', () => {
    expect(sniffMediaMimeType(ebmlHeader('webm'))).toBe('video/webm');
    expect(sniffMediaMimeType(ebmlHeader('matroska'))).toBe('video/x-matroska');
    expect(sniffMediaMimeType(headerWith([0x1a, 0x45, 0xdf, 0xa3]))).toBeUndefined();
  });

  it('answers only with supported mime types and survives truncated headers', () => {
    const truncated = new Uint8Array([0xff, 0xd8]);
    expect(sniffMediaMimeType(truncated)).toBeUndefined();
    expect(sniffMediaMimeType(new Uint8Array(0))).toBeUndefined();
    // Plain text and zip-based documents have no usable magic: left unsupported.
    expect(sniffMediaMimeType(headerWith([], [0, 'hello world']))).toBeUndefined();
    expect(sniffMediaMimeType(headerWith([0x50, 0x4b, 0x03, 0x04]))).toBeUndefined();

    for (const header of [
      headerWith([0xff, 0xd8, 0xff]),
      ftypHeader('isom'),
      ebmlHeader('matroska'),
      headerWith([], [0, 'OggS']),
    ]) {
      const mimeType = sniffMediaMimeType(header);
      expect(mimeType).toBeDefined();
      expect(isSupportedMediaMimeType(mimeType)).toBe(true);
      expect(mediaTypeForMimeType(mimeType)).not.toBeNull();
    }
  });
});
