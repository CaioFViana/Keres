import { decodeBase64ToBytes } from '../../../src/components/features/manuscript/export/manuscriptBase64';

describe('decodeBase64ToBytes', () => {
  it.each([
    ['', ''],
    ['Zg==', 'f'],
    ['Zm8=', 'fo'],
    ['Zm9v', 'foo'],
    ['Zm9vYmFy', 'foobar'],
    ['SGVsbG8sIFdvcmxkIQ==', 'Hello, World!'],
    ['UEsDBA==', 'PK\x03\x04'],
  ])('decodes %p', (base64, expected) => {
    expect(Buffer.from(decodeBase64ToBytes(base64)).toString('binary')).toBe(expected);
  });

  it('matches Buffer on binary payloads', () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
    const base64 = Buffer.from(bytes).toString('base64');

    expect(decodeBase64ToBytes(base64)).toEqual(bytes);
  });
});
