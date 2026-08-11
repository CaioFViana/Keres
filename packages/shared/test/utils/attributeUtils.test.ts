import { describe, expect, it } from 'vitest';
import { AttributeType } from '../../metadata/AttributeType';
import { deriveAttributeKey } from '../../utils/attributeKey';
import { decodeAttributeValue, encodeAttributeValue } from '../../utils/attributeValueCodec';

describe('deriveAttributeKey', () => {
  it('creates stable keys from human-readable labels', () => {
    expect(deriveAttributeKey('Power Type')).toBe('power_type');
    expect(deriveAttributeKey('  Relação: Mãe & Filho  ')).toBe('relacao_mae_filho');
    expect(deriveAttributeKey('123')).toBe('f_123');
    expect(deriveAttributeKey('')).toBe('f_');
  });
});

describe('attribute value codec', () => {
  it('normalizes booleans and numbers for storage', () => {
    expect(encodeAttributeValue(AttributeType.BOOLEAN, '1')).toBe('true');
    expect(encodeAttributeValue(AttributeType.BOOLEAN, 'false')).toBe('false');
    expect(encodeAttributeValue(AttributeType.NUMBER, '12.5')).toBe('12.5');
    expect(encodeAttributeValue(AttributeType.NUMBER, 'invalid')).toBeNull();
  });

  it('decodes typed values and rejects malformed stored numbers', () => {
    expect(decodeAttributeValue(AttributeType.BOOLEAN, 'true')).toBe(true);
    expect(decodeAttributeValue(AttributeType.BOOLEAN, 'anything')).toBe(false);
    expect(decodeAttributeValue(AttributeType.NUMBER, '42')).toBe(42);
    expect(decodeAttributeValue(AttributeType.NUMBER, 'invalid')).toBeNull();
    expect(decodeAttributeValue(AttributeType.TEXT, '')).toBeNull();
  });
});
