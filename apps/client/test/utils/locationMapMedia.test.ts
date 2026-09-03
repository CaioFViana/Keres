import { bytesToBase64 } from '../../src/utils/locationMapMedia';

describe('location map media', () => {
  it('encodes ordinary bytes and payloads larger than one conversion chunk', () => {
    expect(bytesToBase64(new Uint8Array([0, 1, 2, 253, 254, 255]))).toBe('AAEC/f7/');
    const large = Uint8Array.from({ length: 0x8001 }, (_, index) => index % 251);
    expect(bytesToBase64(large)).toBe(Buffer.from(large).toString('base64'));
  });
});
