/**
 * @jest-environment node
 */
import { getEntityTable, toEntityColumns } from '../../src/services/entityTableRegistry';

describe('entity table registry', () => {
  it('resolves known tables and declines unknown entity names', () => {
    expect(getEntityTable('Character')).toBeDefined();
    expect(getEntityTable('Unknown')).toBeUndefined();
  });

  it('keeps only writable table fields, protecting identity and reviving dates', () => {
    expect(
      toEntityColumns('Character', {
        id: 'external-id',
        storyId: 'external-story',
        name: 'Ada',
        updatedAt: '2026-08-14T12:00:00.000Z',
        arbitrary: 'discarded',
      }),
    ).toEqual({
      name: 'Ada',
      updatedAt: new Date('2026-08-14T12:00:00.000Z'),
    });
    expect(toEntityColumns('Unknown', { name: 'Ada' })).toEqual({});
  });
});

/**
 * `CharacterRelation` é a única relação onde o payload de servidor (`character1Id`/
 * `character2Id`) não bate com o nome de coluna da tabela local (`charId1`/`charId2`) - sem
 * o alias em `toEntityColumns`, essas duas chaves eram descartadas em silêncio por não
 * existirem na tabela, e "manter do servidor"/"manter o meu" numa relação de personagens
 * nunca reescrevia de fato quem está relacionado.
 */
describe('toEntityColumns field aliasing', () => {
  it('translates server-shaped CharacterRelation fields to their local column names', () => {
    const columns = toEntityColumns('CharacterRelation', {
      character1Id: 'char-a',
      character2Id: 'char-b',
      relationType: 'allies',
    });

    expect(columns).toEqual({
      charId1: 'char-a',
      charId2: 'char-b',
      relationType: 'allies',
    });
  });

  it('does not rename fields for other relation types, which already share names with the server', () => {
    const columns = toEntityColumns('TagRelation', {
      tagId: 'tag-1',
      relationId: 'char-1',
      relationType: 'Character',
    });

    expect(columns).toEqual({
      tagId: 'tag-1',
      relationId: 'char-1',
      relationType: 'Character',
    });
  });

  it('still drops protected fields and unknown columns after aliasing', () => {
    const columns = toEntityColumns('CharacterRelation', {
      id: 'relation-1',
      storyId: 'story-1',
      character1Id: 'char-a',
      character2Id: 'char-b',
      notARealField: 'x',
    });

    expect(columns).toEqual({
      charId1: 'char-a',
      charId2: 'char-b',
    });
  });

  it('returns an empty object for an unregistered entity type', () => {
    expect(toEntityColumns('NotAnEntity', { character1Id: 'char-a' })).toEqual({});
  });
});
