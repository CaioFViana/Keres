/** A recovery code is ten characters of an unambiguous alphabet, shown as `XXXXX-XXXXX`. */
export const RECOVERY_CODE_LENGTH = 10;

/**
 * The code as issued, from the code as typed or pasted.
 *
 * It is read and typed by hand, so what arrives is rarely what was shown: lowercase from a keyboard
 * that does not capitalize, the hyphen missing or swapped for a space or an en dash (a word
 * processor's), spaces or a line break around it from a paste. The alphabet has no separator
 * in it, so everything that is not a letter or digit is dropped, the rest is upper-cased, and a
 * full-length code gets its hyphen back. Anything else is returned compacted and simply will not match.
 */
export function normalizeRecoveryCode(input: string): string {
  const compact = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return compact.length === RECOVERY_CODE_LENGTH
    ? `${compact.slice(0, 5)}-${compact.slice(5)}`
    : compact;
}
