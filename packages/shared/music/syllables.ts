import { SYLLABLE_MARK } from './chordpro';

/**
 * How many syllables a line of lyrics has - an *estimate*, good enough to see that a second verse is
 * longer than the first, and never a scansion. A language with fixed rules would be more exact; the
 * writer's own marks (`·` between syllables) always win, which is also the way for a made-up
 * language, where no rule applies.
 */
export type SyllableLanguage = 'pt' | 'en' | null;

const PT_VOWELS = 'aeiouyáéíóúâêôãõàü';
const PT_STRONG = 'aeoáéíóúâêôãõà';

function portugueseSyllables(word: string): number {
  const lower = word.toLowerCase();
  // A `qu`/`gu` before e or i carries a silent u, which is no vowel of its own.
  const cleaned = lower.replace(/(q|g)u(?=[eiéíêy])/g, '$1');
  let count = 0;
  let previousVowel: string | null = null;
  // Whether a strong vowel was followed by a glide in this run: "cheia" is chei-a, not ch-ei-a.
  let glideAfterStrong = false;
  for (const char of cleaned) {
    if (!PT_VOWELS.includes(char)) {
      previousVowel = null;
      glideAfterStrong = false;
      continue;
    }
    const strong = PT_STRONG.includes(char);
    if (previousVowel === null) {
      count += 1;
    } else if (strong && (PT_STRONG.includes(previousVowel) || glideAfterStrong)) {
      // Two strong vowels side by side are two syllables (po-e-ma, vo-o), and so is a strong one that
      // follows a diphthong (fei-o); a glide (i, u) joins the vowel before it.
      count += 1;
      glideAfterStrong = false;
    } else if (!strong && PT_STRONG.includes(previousVowel)) {
      glideAfterStrong = true;
    }
    previousVowel = char;
  }
  // A word that ends in a glide and a vowel after a consonant is two syllables in song (lu-a, di-a).
  if (/[^qgaeiouáéíóúâêôãõ][iu][aeo]s?$/.test(cleaned) && count > 0) count += 1;
  return Math.max(count, cleaned.length > 0 ? 1 : 0);
}

function englishSyllables(word: string): number {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w === '') return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const groups = w.match(/[aeiouy]{1,2}/g);
  return Math.max(groups ? groups.length : 0, 1);
}

function genericSyllables(word: string): number {
  const groups = word.toLowerCase().match(/[aeiouyáéíóúâêôãõàü]+/g);
  return groups ? groups.length : word.length > 0 ? 1 : 0;
}

const words = (text: string) => text.match(/[\p{L}\p{M}'’-]+/gu) ?? [];

/** The syllables of one line of plain lyrics (no chords). Marks the writer put in count exactly. */
export function countLineSyllables(line: string, language: SyllableLanguage): number {
  if (line.includes(SYLLABLE_MARK)) {
    // The writer said where the syllables end: a mark between two is one more than the marks.
    return line
      .split(/\s+/)
      .filter((word) => /[\p{L}\p{M}]/u.test(word))
      .reduce((sum, word) => sum + word.split(SYLLABLE_MARK).filter(Boolean).length, 0);
  }
  const counter =
    language === 'pt' ? portugueseSyllables : language === 'en' ? englishSyllables : genericSyllables;
  return words(line).reduce((sum, word) => sum + counter(word.replace(/['’-]/g, '')), 0);
}
