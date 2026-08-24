import { describe, expect, it } from 'vitest';
import { CreateChapterDataSchema } from '../../schemas/ChapterSchemas';
import { CreateCharacterDataSchema, PartialCharacterSchema } from '../../schemas/CharacterSchemas';
import { CreateNoteDataSchema } from '../../schemas/NoteSchemas';
import { CreateSceneDataSchema } from '../../schemas/SceneSchemas';
import {
  CreateStoryDataSchema,
  PartialStorySchema,
  StoryCreateInputSchema,
} from '../../schemas/StorySchemas';
import { CreateTagDataSchema } from '../../schemas/TagSchemas';
import { CreateWorldRuleDataSchema } from '../../schemas/WorldRuleSchemas';

const ulid = (suffix: string) => suffix.toUpperCase().padStart(26, '0');

const sceneBase = {
  chapterId: ulid('chapter1'),
  locationId: ulid('location1'),
  name: 'Cena de abertura',
  index: 1,
  summary: null,
  gap: null,
  gapType: null,
  duration: null,
  durationType: null,
  extraNotes: null,
};

const chapterBase = { name: 'Capítulo 1', index: 1, summary: null, extraNotes: null };

/**
 * Estes schemas são a fronteira de validação compartilhada entre client e API: o mesmo objeto
 * é validado no cliente antes do push e de novo no servidor antes de gravar. Um campo que
 * silenciosamente vira opcional aqui abre um buraco nos dois lados de uma vez.
 */
describe('create-entity schemas', () => {
  it.each([
    ['Character', CreateCharacterDataSchema, { name: 'Keres' }],
    ['Chapter', CreateChapterDataSchema, chapterBase],
    ['Scene', CreateSceneDataSchema, sceneBase],
    ['Tag', CreateTagDataSchema, { name: 'Vilões' }],
    ['Note', CreateNoteDataSchema, { title: 'Ideia', body: null, extraNotes: null }],
    [
      'WorldRule',
      CreateWorldRuleDataSchema,
      { title: 'Magia', description: null, extraNotes: null },
    ],
    ['Story', CreateStoryDataSchema, { title: 'A Queda', type: 'linear' }],
  ])('%s defaults isFavorite to false when the client omits it', (_label, schema, payload) => {
    const parsed = schema.parse(payload) as { isFavorite: boolean };
    expect(parsed.isFavorite).toBe(false);
  });

  it.each([
    ['Character', CreateCharacterDataSchema, { name: '' }],
    ['Chapter', CreateChapterDataSchema, { ...chapterBase, name: '' }],
    ['Scene', CreateSceneDataSchema, { ...sceneBase, name: '' }],
    ['Tag', CreateTagDataSchema, { name: '' }],
    ['Note', CreateNoteDataSchema, { title: '', body: null, extraNotes: null }],
    ['WorldRule', CreateWorldRuleDataSchema, { title: '', description: null, extraNotes: null }],
    ['Story', CreateStoryDataSchema, { title: '', type: 'linear' }],
  ])('%s rejects a blank display name', (_label, schema, payload) => {
    expect(schema.safeParse(payload).success).toBe(false);
  });

  it('rejects a chapter index below 1, since chapters are numbered from 1', () => {
    expect(CreateChapterDataSchema.safeParse({ ...chapterBase, index: 0 }).success).toBe(false);
    expect(CreateChapterDataSchema.safeParse({ ...chapterBase, index: 1.5 }).success).toBe(false);
  });

  /**
   * Cena e capítulo seguem a mesma numeração de propósito. Aceitar 0 na cena era o que deixava
   * criação e reordenação com contratos incompatíveis: o handler de reordenação da API recusa
   * qualquer conjunto que não seja 1..N contíguo.
   */
  it('rejects a scene index below 1, like the chapter it lives in', () => {
    expect(CreateSceneDataSchema.safeParse({ ...sceneBase, index: 1 }).success).toBe(true);
    expect(CreateSceneDataSchema.safeParse({ ...sceneBase, index: 0 }).success).toBe(false);
    expect(CreateSceneDataSchema.safeParse({ ...sceneBase, index: -1 }).success).toBe(false);
  });

  it('defaults a scene to neither start nor finish', () => {
    const parsed = CreateSceneDataSchema.parse(sceneBase);
    expect(parsed.isStart).toBe(false);
    expect(parsed.isFinish).toBe(false);
  });

  it('defaults a tag to a null colour instead of dropping the key', () => {
    expect(CreateTagDataSchema.parse({ name: 'Vilões' })).toMatchObject({
      color: null,
      extraNotes: null,
    });
  });
});

describe('StoryCreateInputSchema', () => {
  it('requires a client-generated ULID so the story id survives the offline round trip', () => {
    const base = { title: 'A Queda', type: 'linear' as const };

    expect(StoryCreateInputSchema.safeParse(base).success).toBe(false);
    expect(StoryCreateInputSchema.safeParse({ ...base, id: 'story-1' }).success).toBe(false);
    expect(StoryCreateInputSchema.safeParse({ ...base, id: ulid('story1') }).success).toBe(true);
  });

  it('applies the sharing-safe defaults for a brand new story', () => {
    const parsed = StoryCreateInputSchema.parse({
      id: ulid('story1'),
      title: 'A Queda',
      type: 'linear',
    });

    expect(parsed).toMatchObject({
      favoriteBehavior: 'individual',
      normalizeSceneTiming: false,
      allowReaderComments: false,
      isFavorite: false,
    });
  });

  it.each([
    ['story type', { type: 'circular' }],
    ['favorite behavior', { favoriteBehavior: 'everyone' }],
  ])('rejects an unknown %s', (_label, override) => {
    const payload = { id: ulid('story1'), title: 'A Queda', type: 'linear', ...override };
    expect(StoryCreateInputSchema.safeParse(payload).success).toBe(false);
  });
});

describe('partial update schemas strip identity fields', () => {
  it('does not keep storyId or id on a character patch', () => {
    const parsed = PartialCharacterSchema.parse({
      name: 'Nyx',
      storyId: ulid('otherstory'),
      id: ulid('character1'),
    });
    expect(parsed.name).toBe('Nyx');
    expect('storyId' in parsed).toBe(false);
    expect('id' in parsed).toBe(false);
  });

  it('does not keep userId on a story patch', () => {
    const parsed = PartialStorySchema.parse({
      title: 'A Queda',
      userId: ulid('user1'),
    });
    expect(parsed.title).toBe('A Queda');
    expect('userId' in parsed).toBe(false);
  });
});
