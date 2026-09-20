import { describe, expect, it } from 'vitest';
import { base64ToBytes, bytesToBase64 } from '../../utils/base64';

describe('bytesToBase64', () => {
  it('encodes empty, regular, and multi-chunk byte arrays', () => {
    expect(bytesToBase64(new Uint8Array())).toBe('');
    expect(bytesToBase64(new Uint8Array([0, 1, 255]))).toBe('AAH/');
    const bytes = new Uint8Array(0x8001).fill(65);
    expect(atob(bytesToBase64(bytes))).toHaveLength(bytes.length);
  });
});

describe('base64ToBytes', () => {
  it('decodes back to the exact bytes, including empty input', () => {
    expect(base64ToBytes('')).toEqual(new Uint8Array());
    expect(base64ToBytes('AAH/')).toEqual(new Uint8Array([0, 1, 255]));
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });
});
