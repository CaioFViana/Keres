import { describe, expect, it } from 'vitest';
import { reviveDates } from '../../utils/reviveDates';

describe('reviveDates', () => {
  it('revives ISO dates recursively without changing other values', () => {
    const input = {
      createdAt: '2026-01-02T03:04:05.000Z',
      nested: [{ updatedAt: '2026-02-03T04:05:06Z', value: 'plain text' }],
      invalid: '2026-01-02',
    };

    const revived = reviveDates(input);

    expect(revived.createdAt).toBeInstanceOf(Date);
    expect(revived.nested[0].updatedAt).toBeInstanceOf(Date);
    expect(revived.nested[0].value).toBe('plain text');
    expect(revived.invalid).toBe('2026-01-02');
    expect(input.createdAt).toBe('2026-01-02T03:04:05.000Z');
  });
});
