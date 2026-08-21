import { describe, expect, it } from 'vitest';
import { AttributeType } from '../../metadata/AttributeType';
import { deriveAttributeKey } from '../../utils/attributeKey';
import { isSuggestionAttributeType } from '../../metadata/AttributeType';
import {
  decodeAttributeValue,
  encodeAttributeValue,
  explodeAttributeUsageValue,
  isEntityAttributeType,
  joinSuggestionListForDisplay,
} from '../../utils/attributeValueCodec';

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

  it('stores entity references as trimmed raw identifiers', () => {
    expect(encodeAttributeValue(AttributeType.ENTITY, ' 01HXENTITY ')).toBe('01HXENTITY');
    expect(decodeAttributeValue(AttributeType.ENTITY, ' 01HXENTITY ')).toBe('01HXENTITY');
    expect(encodeAttributeValue(AttributeType.ENTITY, '   ')).toBeNull();
    expect(isEntityAttributeType(AttributeType.ENTITY)).toBe(true);
    expect(isEntityAttributeType(AttributeType.TEXT)).toBe(false);
  });

  it('stores a suggestion list as JSON and drops empty or duplicate items', () => {
    expect(encodeAttributeValue(AttributeType.SUGGESTION_LIST, ['elf', 'dwarf'])).toBe(
      '["elf","dwarf"]',
    );
    expect(encodeAttributeValue(AttributeType.SUGGESTION_LIST, [' Elf ', 'elf', '', 'dwarf'])).toBe(
      '["Elf","dwarf"]',
    );
    expect(encodeAttributeValue(AttributeType.SUGGESTION_LIST, [])).toBeNull();
    expect(encodeAttributeValue(AttributeType.SUGGESTION_LIST, '["elf","dwarf"]')).toBe(
      '["elf","dwarf"]',
    );
    expect(decodeAttributeValue(AttributeType.SUGGESTION_LIST, '["elf","dwarf"]')).toEqual([
      'elf',
      'dwarf',
    ]);
    expect(decodeAttributeValue(AttributeType.SUGGESTION_LIST, '[]')).toBeNull();
    expect(decodeAttributeValue(AttributeType.SUGGESTION_LIST, 'not-json')).toEqual(['not-json']);
  });

  it('explodes list usage and joins items for display', () => {
    expect(explodeAttributeUsageValue(AttributeType.SUGGESTION_LIST, '["a","b"]')).toEqual([
      'a',
      'b',
    ]);
    expect(explodeAttributeUsageValue(AttributeType.SUGGESTION, 'solo')).toEqual(['solo']);
    expect(joinSuggestionListForDisplay(['a', 'b'])).toBe('a, b');
    expect(joinSuggestionListForDisplay([])).toBeNull();
    expect(isSuggestionAttributeType(AttributeType.SUGGESTION_LIST)).toBe(true);
    expect(isSuggestionAttributeType(AttributeType.TEXT)).toBe(false);
  });
});
