import { formatDateTime } from '@/src/utils/formatDateTime';

describe('formatDateTime', () => {
  it('names the month, so no reader takes the day for the month', () => {
    const text = formatDateTime(new Date(2026, 9, 10, 20, 7, 25), 'en');

    expect(text).toContain('Oct');
    expect(text).toContain('2026');
    expect(text).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it('follows the language it is given', () => {
    expect(formatDateTime(new Date(2026, 9, 10, 20, 7), 'pt-BR')).toContain('out');
  });
});
