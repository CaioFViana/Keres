import { describe, expect, it } from 'vitest';
import type { GraphCharacter, GraphRelation } from '../../graphs/characterRelationGraphLayout';
import { buildCharacterRelationGraphLayout } from '../../graphs/characterRelationGraphLayout';
import { filterCharacterRelationGraph } from '../../graphs/characterRelationGraphFilter';

const character = (id: string, name = `Personagem ${id}`): GraphCharacter => ({ id, name });

const relation = (
  id: string,
  character1Id: string,
  character2Id: string,
  relationType = 'irmão',
): GraphRelation => ({
  id,
  character1Id,
  character2Id,
  relationType,
});

const idsOf = (characters: GraphCharacter[]) => characters.map((character) => character.id);

describe('filterCharacterRelationGraph', () => {
  it('keeps everything when nothing is selected', () => {
    const characters = [character('a'), character('b'), character('c')];
    const relations = [relation('r1', 'a', 'b')];

    const filtered = filterCharacterRelationGraph(characters, relations, []);

    expect(filtered.characters).toEqual(characters);
    expect(filtered.relations).toEqual(relations);
  });

  it('keeps the selected characters and their direct neighbours, dropping everyone else', () => {
    const characters = [character('a'), character('b'), character('c'), character('d')];
    const relations = [
      relation('r1', 'a', 'b'),
      relation('r2', 'b', 'c'),
      relation('r3', 'c', 'd'),
    ];

    const filtered = filterCharacterRelationGraph(characters, relations, ['a']);

    expect(idsOf(filtered.characters)).toEqual(['a', 'b']);
    expect(filtered.relations.map((edge) => edge.id)).toEqual(['r1']);
  });

  it('does not pull in neighbours of neighbours', () => {
    const characters = [character('a'), character('b'), character('c')];
    const relations = [relation('r1', 'a', 'b'), relation('r2', 'b', 'c')];

    const filtered = filterCharacterRelationGraph(characters, relations, ['a']);

    expect(idsOf(filtered.characters)).toEqual(['a', 'b']);
  });

  it('keeps a relation between two neighbours when both are in the kept set', () => {
    const characters = [character('a'), character('b'), character('c')];
    const relations = [
      relation('r1', 'a', 'b'),
      relation('r2', 'a', 'c'),
      relation('r3', 'b', 'c'),
    ];

    const filtered = filterCharacterRelationGraph(characters, relations, ['a']);

    expect(idsOf(filtered.characters)).toEqual(['a', 'b', 'c']);
    expect(filtered.relations.map((edge) => edge.id)).toEqual(['r1', 'r2', 'r3']);
  });

  it('drops a relation that reaches outside the kept set', () => {
    const characters = [character('a'), character('b'), character('c')];
    const relations = [relation('r1', 'a', 'b'), relation('r2', 'b', 'c')];

    const filtered = filterCharacterRelationGraph(characters, relations, ['a']);

    expect(idsOf(filtered.characters)).toEqual(['a', 'b']);
    expect(filtered.relations.map((edge) => edge.id)).toEqual(['r1']);
  });

  it('keeps both selected characters and the relation between them', () => {
    const characters = [character('a'), character('b'), character('c')];
    const relations = [relation('r1', 'a', 'b')];

    const filtered = filterCharacterRelationGraph(characters, relations, ['a', 'b']);

    expect(idsOf(filtered.characters)).toEqual(['a', 'b']);
    expect(filtered.relations.map((edge) => edge.id)).toEqual(['r1']);
  });

  it('ignores selected ids that do not exist', () => {
    const characters = [character('a'), character('b')];
    const relations = [relation('r1', 'a', 'b')];

    const filtered = filterCharacterRelationGraph(characters, relations, ['ghost']);

    expect(filtered.characters).toEqual([]);
    expect(filtered.relations).toEqual([]);
  });

  it('preserves the original order of characters and relations', () => {
    const characters = [character('z'), character('a'), character('m')];
    const relations = [relation('r2', 'a', 'm'), relation('r1', 'z', 'a')];

    const filtered = filterCharacterRelationGraph(characters, relations, ['a']);

    expect(idsOf(filtered.characters)).toEqual(['z', 'a', 'm']);
    expect(filtered.relations.map((edge) => edge.id)).toEqual(['r2', 'r1']);
  });

  it('keeps a selected isolated character as the only node', () => {
    const characters = [character('a'), character('b'), character('c')];
    const relations = [relation('r1', 'a', 'b')];

    const filtered = filterCharacterRelationGraph(characters, relations, ['c']);

    expect(idsOf(filtered.characters)).toEqual(['c']);
    expect(filtered.relations).toEqual([]);
  });

  it('feeds a layout containing only the kept characters and relations', () => {
    const characters = [character('a'), character('b'), character('c'), character('d')];
    const relations = [
      relation('r1', 'a', 'b'),
      relation('r2', 'b', 'c'),
      relation('r3', 'c', 'd'),
    ];

    const filtered = filterCharacterRelationGraph(characters, relations, ['a']);
    const layout = buildCharacterRelationGraphLayout(filtered.characters, filtered.relations);

    expect(layout.nodes.map((node) => node.id).sort()).toEqual(['a', 'b']);
    expect(layout.edges.map((edge) => edge.id)).toEqual(['r1']);
  });
});