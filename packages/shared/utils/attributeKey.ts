const COMBINING_MARKS = new RegExp(
  '[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']',
  'g',
);

/**
 * "Power Type" -> "power_type". It lives in `packages/shared` (not only in the client) so the API
 * can re-derive/validate the key independently of what the client sent, instead of merely trusting
 * the received value.
 *
 * The result always matches `AttributeKeyRegex` (it starts with a letter, only [a-z0-9_]): a name
 * starting with a digit, or an empty one, gets the `f_` prefix so it never fails schema validation.
 */
export function deriveAttributeKey(displayName: string): string {
  const base = displayName
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);

  return /^[a-z]/.test(base) ? base : `f_${base}`;
}
