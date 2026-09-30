import { describe, expect, it } from 'vitest';
import { normalizeRecoveryCode, RECOVERY_CODE_LENGTH } from '../../utils/recoveryCode';

describe('normalizeRecoveryCode', () => {
  it('leaves a code as issued untouched', () => {
    expect(normalizeRecoveryCode('ABCDE-FGHJK')).toBe('ABCDE-FGHJK');
  });

  it.each([
    ['lowercase', 'abcde-fghjk'],
    ['mixed case', 'AbCdE-fGhJk'],
    ['no hyphen', 'ABCDEFGHJK'],
    ['a space for the hyphen', 'ABCDE FGHJK'],
    ['an en dash', 'ABCDE\u2013FGHJK'],
    ['an em dash', 'ABCDE\u2014FGHJK'],
    ['a non-breaking space', 'ABCDE\u00a0FGHJK'],
    ['spaces around it', '  ABCDE-FGHJK  '],
    ['a trailing line break', 'ABCDE-FGHJK\n'],
    ['spaces inside the halves', 'ABC DE - FGH JK'],
  ])('reads %s as the code that was meant', (_label, typed) => {
    expect(normalizeRecoveryCode(typed)).toBe('ABCDE-FGHJK');
  });

  it('gives back anything that is not a full code compacted, to be refused by the comparison', () => {
    expect(normalizeRecoveryCode('abc-de')).toBe('ABCDE');
    expect(normalizeRecoveryCode('')).toBe('');
    expect(normalizeRecoveryCode('ABCDE-FGHJK-LMNPQ')).toHaveLength(15);
    expect(RECOVERY_CODE_LENGTH).toBe(10);
  });
});
