import type { StoryVocabulary } from '@keres/shared/entities/Story';
import { resolveEffectiveVocabulary } from '../../src/vocabulary/effectiveVocabulary';

const term = (singular: string, plural: string) => ({
  singular,
  plural,
  grammaticalGender: 'masculine' as const,
});

const storyPt: StoryVocabulary = {
  version: 1,
  language: 'pt',
  terms: { Chapter: term('Missão', 'Missões'), Character: term('Herói', 'Heróis') },
};

const arcPt: StoryVocabulary = {
  version: 1,
  language: 'pt',
  terms: { Character: term('Personagem', 'Personagens') },
};

describe('resolveEffectiveVocabulary', () => {
  it('is null when no layer brings a term, so a prose story reads as it always has', () => {
    expect(resolveEffectiveVocabulary(null, null, 'pt')).toBeNull();
    expect(
      resolveEffectiveVocabulary(null, { medium: 'generic', vocabulary: null }, 'en'),
    ).toBeNull();
  });

  it('lets the medium bring its default terms', () => {
    const result = resolveEffectiveVocabulary(null, { medium: 'comic', vocabulary: null }, 'pt');
    expect(result?.terms.Arc?.singular).toBe('Edição');
    expect(result?.terms.Arc?.grammaticalGender).toBe('feminine');
    expect(
      resolveEffectiveVocabulary(null, { medium: 'comic', vocabulary: null }, 'en')?.terms.Arc,
    ).toMatchObject({ singular: 'Issue' });
  });

  it('ranks the arc over the story over the medium', () => {
    const result = resolveEffectiveVocabulary(
      storyPt,
      { medium: 'campaign', vocabulary: arcPt },
      'pt',
    );
    // campaign says Sessão, the story says Missão, the arc alone chooses Personagem.
    expect(result?.terms.Chapter?.singular).toBe('Missão');
    expect(result?.terms.Character?.singular).toBe('Personagem');
    expect(result?.terms.Arc?.singular).toBe('Módulo');
  });

  it('ignores a layer written in another language than the UI', () => {
    const result = resolveEffectiveVocabulary(
      storyPt,
      { medium: 'campaign', vocabulary: arcPt },
      'en',
    );
    expect(result?.terms.Chapter?.singular).toBe('Session');
    expect(result?.terms.Character).toBeUndefined();
  });

  it('keeps a story vocabulary working with no arc in effect', () => {
    expect(resolveEffectiveVocabulary(storyPt, null, 'pt')).toEqual(storyPt);
  });
});
