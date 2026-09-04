/** @jest-environment node */
import { sql } from 'drizzle-orm';
import { tags } from '../../src/db/schema';
import {
  buildAdvancedSearchConditions,
  buildNativeAdvancedSearchConditions,
} from '../../src/services/storymanagement/advancedSearchConditions';

describe('advanced search conditions', () => {
  it('uses handler-declared native metadata and ignores unknown fields', () => {
    expect(
      buildNativeAdvancedSearchConditions('Tag', tags, {
        name: 'magic',
        missing: 'ignored',
      }),
    ).toHaveLength(1);
  });

  it('delegates only unknown non-empty fields to the custom-attribute fallback', async () => {
    const fallback = jest.fn().mockResolvedValue(sql`1 = 1`);
    const conditions = await buildAdvancedSearchConditions(
      'Tag',
      tags,
      { name: 'magic', customField: 'arcane', emptyCustom: '' },
      fallback,
    );

    expect(conditions).toHaveLength(2);
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(fallback).toHaveBeenCalledWith('customField', 'arcane');
  });
});
