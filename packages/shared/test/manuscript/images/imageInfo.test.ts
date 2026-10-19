import { inflate } from 'pako';
import { describe, expect, it } from 'vitest';
import { readImageInfo } from '../../../manuscript/images/imageInfo';
import { pdfImageOf } from '../../../manuscript/images/pdfImage';
import { encodePng, jpegOf, solidPng } from './imageFixtures';

describe('readImageInfo', () => {
  it('reads the size of a PNG and of a JPEG from their headers', () => {
    expect(readImageInfo(solidPng(30, 20).bytes)).toEqual({
      mimeType: 'image/png',
      width: 30,
      height: 20,
    });
    expect(readImageInfo(jpegOf(640, 480).bytes)).toEqual({
      mimeType: 'image/jpeg',
      width: 640,
      height: 480,
    });
  });

  it('finds the JPEG frame past other segments', () => {
    expect(readImageInfo(jpegOf(100, 50, 4, true).bytes)).toMatchObject({ width: 100, height: 50 });
  });

  it('refuses what a manuscript cannot embed', () => {
    expect(readImageInfo(new Uint8Array([1, 2, 3]))).toBeNull();
    expect(readImageInfo(new TextEncoder().encode('GIF89a not an image at all....'))).toBeNull();
    expect(readImageInfo(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]))).toBeNull();
  });
});

describe('pdfImageOf', () => {
  const rawOf = (data: Uint8Array) => Array.from(inflate(data));

  it('passes a JPEG through untouched, naming its colour space', () => {
    const rgb = jpegOf(10, 10, 3);
    expect(pdfImageOf(rgb)).toMatchObject({ filter: 'DCTDecode', colorSpace: 'DeviceRGB' });
    expect(pdfImageOf(rgb)!.data).toBe(rgb.bytes);
    expect(pdfImageOf(jpegOf(10, 10, 1))).toMatchObject({ colorSpace: 'DeviceGray' });
  });

  it('inverts the Decode of an Adobe CMYK JPEG, and only of that', () => {
    expect(pdfImageOf(jpegOf(10, 10, 4, true))).toMatchObject({
      colorSpace: 'DeviceCMYK',
      decode: '[1 0 1 0 1 0 1 0]',
    });
    expect(pdfImageOf(jpegOf(10, 10, 4, false))!.decode).toBeUndefined();
  });

  it('decodes an RGBA PNG to colour plus a soft mask, dropping the mask when nothing is transparent', () => {
    const translucent = encodePng({
      width: 2,
      height: 1,
      colorType: 6,
      rows: [[10, 20, 30, 255, 40, 50, 60, 128]],
    });
    const image = pdfImageOf({ bytes: translucent, mimeType: 'image/png', width: 2, height: 1 })!;
    expect(image.colorSpace).toBe('DeviceRGB');
    expect(rawOf(image.data)).toEqual([10, 20, 30, 40, 50, 60]);
    expect(rawOf(image.softMask!.data)).toEqual([255, 128]);

    const opaque = pdfImageOf(solidPng(3, 3))!;
    expect(opaque.softMask).toBeUndefined();
  });

  it('undoes every PNG row filter', () => {
    const rows = [
      [10, 20, 30, 40, 50, 60],
      [15, 25, 35, 45, 55, 65],
      [5, 200, 17, 99, 3, 250],
      [100, 101, 102, 103, 104, 105],
      [9, 8, 7, 6, 5, 4],
    ];
    const bytes = encodePng({
      width: 2,
      height: 5,
      colorType: 2,
      rows,
      filters: [0, 1, 2, 3, 4],
    });
    const image = pdfImageOf({ bytes, mimeType: 'image/png', width: 2, height: 5 })!;

    expect(rawOf(image.data)).toEqual(rows.flat());
  });

  it('expands gray, gray with alpha and 16-bit samples', () => {
    const gray = encodePng({ width: 3, height: 1, colorType: 0, rows: [[0, 128, 255]] });
    expect(
      rawOf(pdfImageOf({ bytes: gray, mimeType: 'image/png', width: 3, height: 1 })!.data),
    ).toEqual([0, 128, 255]);

    const grayAlpha = encodePng({ width: 2, height: 1, colorType: 4, rows: [[50, 255, 60, 0]] });
    const withAlpha = pdfImageOf({ bytes: grayAlpha, mimeType: 'image/png', width: 2, height: 1 })!;
    expect(withAlpha.colorSpace).toBe('DeviceGray');
    expect(rawOf(withAlpha.data)).toEqual([50, 60]);
    expect(rawOf(withAlpha.softMask!.data)).toEqual([255, 0]);

    const deep = encodePng({
      width: 1,
      height: 1,
      colorType: 2,
      depth: 16,
      rows: [[0xaa, 0x11, 0xbb, 0x22, 0xcc, 0x33]],
    });
    expect(
      rawOf(pdfImageOf({ bytes: deep, mimeType: 'image/png', width: 1, height: 1 })!.data),
    ).toEqual([0xaa, 0xbb, 0xcc]);
  });

  it('expands a palette PNG, with its transparency', () => {
    const bytes = encodePng({
      width: 2,
      height: 1,
      colorType: 3,
      depth: 8,
      rows: [[1, 0]],
      palette: [255, 0, 0, 0, 0, 255],
      transparency: [255, 64],
    });
    const image = pdfImageOf({ bytes, mimeType: 'image/png', width: 2, height: 1 })!;

    expect(rawOf(image.data)).toEqual([0, 0, 255, 255, 0, 0]);
    expect(rawOf(image.softMask!.data)).toEqual([64, 255]);
  });

  it('unpacks a 2-bit palette', () => {
    // Four pixels of one byte: indices 0,1,2,3 -> 00 01 10 11.
    const bytes = encodePng({
      width: 4,
      height: 1,
      colorType: 3,
      depth: 2,
      rows: [[0b00011011]],
      palette: [0, 0, 0, 10, 10, 10, 20, 20, 20, 30, 30, 30],
    });
    const image = pdfImageOf({ bytes, mimeType: 'image/png', width: 4, height: 1 })!;

    expect(rawOf(image.data)).toEqual([0, 0, 0, 10, 10, 10, 20, 20, 20, 30, 30, 30]);
  });

  it('gives up on what it cannot decode instead of throwing', () => {
    const interlaced = encodePng({
      width: 1,
      height: 1,
      colorType: 2,
      rows: [[1, 2, 3]],
      interlace: 1,
    });
    expect(
      pdfImageOf({ bytes: interlaced, mimeType: 'image/png', width: 1, height: 1 }),
    ).toBeNull();
    const damaged = solidPng(2, 2).bytes.slice(0, 40);
    expect(pdfImageOf({ bytes: damaged, mimeType: 'image/png', width: 2, height: 2 })).toBeNull();
    expect(
      pdfImageOf({ bytes: new Uint8Array(4), mimeType: 'image/jpeg', width: 1, height: 1 }),
    ).toBeNull();
  });
});
