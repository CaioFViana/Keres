/**
 * @jest-environment node
 */
import { AttributeType } from '@keres/shared';
import { validateRequiredCustomAttributes } from '../../src/components/common/forms/CustomAttributeFields/CustomAttributeFields';

const listField = {
  id: 'traits',
  name: 'Traços',
  type: AttributeType.SUGGESTION_LIST,
  isRequired: true,
} as never;

describe('validateRequiredCustomAttributes', () => {
  it('treats an empty suggestion list as missing', () => {
    expect(validateRequiredCustomAttributes([listField], { traits: null })).toBe('Traços');
    expect(validateRequiredCustomAttributes([listField], { traits: '[]' })).toBe('Traços');
  });

  it('accepts a list that has at least one item', () => {
    expect(validateRequiredCustomAttributes([listField], { traits: '["elf"]' })).toBeNull();
  });
});
