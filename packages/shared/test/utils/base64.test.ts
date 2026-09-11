import { describe, expect, it } from 'vitest';
import { bytesToBase64 } from '../../utils/base64';

describe('bytesToBase64', () => {
  it('encodes empty, regular, and multi-chunk byte arrays', () => {
    expect(bytesToBase64(new Uint8Array())).toBe('');
    expect(bytesToBase64(new Uint8Array([0, 1, 255]))).toBe('AAH/');
    const bytes = new Uint8Array(0x8001).fill(65);
    expect(atob(bytesToBase64(bytes))).toHaveLength(bytes.length);
  });
});
