import { formatEditedAgo } from '../../src/utils/editedAgo';

const NOW = new Date('2026-10-08T12:00:00.000Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('formatEditedAgo', () => {
  it('says minutes, hours and days in the language of the person', () => {
    expect(formatEditedAgo(ago(5 * MINUTE), NOW, 'en')).toBe('5 minutes ago');
    expect(formatEditedAgo(ago(2 * HOUR), NOW, 'en')).toBe('2 hours ago');
    expect(formatEditedAgo(ago(3 * DAY), NOW, 'en')).toBe('3 days ago');
    expect(formatEditedAgo(ago(2 * HOUR), NOW, 'pt-BR')).toBe('há 2 horas');
  });

  it('says "now" within the first minute, and never goes into the future', () => {
    expect(formatEditedAgo(ago(10_000), NOW, 'en')).toBe('this minute');
    expect(formatEditedAgo(new Date(NOW.getTime() + HOUR), NOW, 'en')).toBe('this minute');
  });

  it('gives a date once it is more than a month ago', () => {
    const old = ago(45 * DAY);
    expect(formatEditedAgo(old, NOW, 'en')).toBe(old.toLocaleDateString('en'));
  });

  it('gives the date when the engine cannot say it relatively', () => {
    const original = Intl.RelativeTimeFormat;
    (Intl as unknown as { RelativeTimeFormat: unknown }).RelativeTimeFormat = undefined;
    try {
      const when = ago(2 * HOUR);
      expect(formatEditedAgo(when, NOW, 'en')).toBe(when.toLocaleDateString('en'));
    } finally {
      (Intl as unknown as { RelativeTimeFormat: unknown }).RelativeTimeFormat = original;
    }
  });
});
