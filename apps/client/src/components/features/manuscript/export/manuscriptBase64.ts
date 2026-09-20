const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Base64 into bytes with no platform API (`atob`/`Buffer` exist nowhere the app runs
 * uniformly) - the DOCX packer returns base64 and delivery wants bytes.
 */
export function decodeBase64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/\s/g, '');
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const bytes = new Uint8Array(((clean.length * 3) / 4 - padding) | 0);
  let offset = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      (ALPHABET.indexOf(clean[i]) << 18) |
      (ALPHABET.indexOf(clean[i + 1]) << 12) |
      ((ALPHABET.indexOf(clean[i + 2]) & 63) << 6) |
      (ALPHABET.indexOf(clean[i + 3]) & 63);
    if (offset < bytes.length) bytes[offset++] = (n >> 16) & 255;
    if (offset < bytes.length) bytes[offset++] = (n >> 8) & 255;
    if (offset < bytes.length) bytes[offset++] = n & 255;
  }
  return bytes;
}
