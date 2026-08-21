import type { StatTier } from '../../src/utils/statLadder';
import { buildStatRanking, type StatRankingInput } from '../../src/utils/statRanking';
import { indexStatValues } from '../../src/utils/statValues';

const LADDER: StatTier[] = [
  { label: 'F', minValue: 0 },
  { label: 'C', minValue: 50 },
  { label: 'A', minValue: 400 },
];

const CHARACTERS = [
  { id: 'ilda', name: 'Ilda' },
  { id: 'bento', name: 'Bento' },
];

const MODES = [
  { id: 'storm', characterId: 'ilda', name: 'Na tempestade' },
  { id: 'hurt', characterId: 'bento', name: 'Ferido' },
];

const rank = (overrides: Partial<StatRankingInput> = {}) =>
  buildStatRanking({
    characters: CHARACTERS,
    modes: MODES,
    values: indexStatValues([
      { characterId: 'ilda', modeId: null, statId: 'courage', value: 100 },
      { characterId: 'ilda', modeId: 'storm', statId: 'courage', value: 480 },
      { characterId: 'bento', modeId: null, statId: 'courage', value: 20 },
    ]),
    statId: 'courage',
    ladder: LADDER,
    notation: 'letter',
    direction: 'desc',
    ...overrides,
  });

const flatten = (groups: ReturnType<typeof buildStatRanking>) =>
  groups.flatMap((group) => group.entries.map((entry) => entry.label));

describe('buildStatRanking', () => {
  it('lists every character and every mode as its own row', () => {
    expect(flatten(rank())).toEqual(['Ilda · Na tempestade', 'Ilda', 'Bento', 'Bento · Ferido']);
  });

  it('sorts from the highest value down when descending', () => {
    const values = rank().flatMap((group) => group.entries.map((entry) => entry.value));

    expect(values).toEqual([480, 100, 20, 20]);
  });

  it('sorts from the lowest value up when ascending', () => {
    const values = rank({ direction: 'asc' }).flatMap((group) =>
      group.entries.map((entry) => entry.value),
    );

    expect(values).toEqual([20, 20, 100, 480]);
  });

  it('marks a mode that only repeats the normal mode as inherited', () => {
    const hurt = rank()
      .flatMap((group) => group.entries)
      .find((entry) => entry.modeId === 'hurt');

    expect(hurt).toMatchObject({ value: 20, inherited: true });
  });

  it('hides inherited rows on request', () => {
    expect(flatten(rank({ hideInherited: true }))).toEqual([
      'Ilda · Na tempestade',
      'Ilda',
      'Bento',
    ]);
  });

  it('groups by tier in letter notation, from the top down', () => {
    const groups = rank();

    expect(groups.map((group) => group.label)).toEqual(['A', 'C', 'F']);
    expect(groups[0]!.entries.map((entry) => entry.label)).toEqual(['Ilda · Na tempestade']);
  });

  it('turns the tier groups upside down when ascending', () => {
    expect(rank({ direction: 'asc' }).map((group) => group.label)).toEqual(['F', 'C', 'A']);
  });

  it('carries the tier and the number together, and the number alone', () => {
    const top = rank()[0]!.entries[0]!;

    // O cabeçalho do grupo já diz o tier, então a linha pode mostrar só o número; fora de um
    // grupo (notação numérica, ou o painel do personagem) o tier precisa vir junto.
    expect(top.display).toBe('A (480)');
    expect(top.valueDisplay).toBe('480');
  });

  it('does not group in number notation', () => {
    const groups = rank({ notation: 'number' });

    expect(groups).toHaveLength(1);
    expect(groups[0]!.label).toBeNull();
    expect(groups[0]!.entries[0]!.display).toBe('480');
  });

  it('breaks a tie by name', () => {
    const groups = rank({
      values: indexStatValues([
        { characterId: 'ilda', modeId: null, statId: 'courage', value: 100 },
        { characterId: 'bento', modeId: null, statId: 'courage', value: 100 },
      ]),
      hideInherited: true,
    });

    expect(flatten(groups)).toEqual(['Bento', 'Ilda']);
  });

  it('sends everyone without a value to a group at the end', () => {
    const groups = rank({
      values: indexStatValues([
        { characterId: 'ilda', modeId: null, statId: 'courage', value: 100 },
      ]),
    });
    const last = groups.at(-1)!;

    expect(last.key).toBe('none');
    expect(last.entries.map((entry) => entry.label)).toEqual(['Bento', 'Bento · Ferido']);
    expect(last.entries[0]!.display).toBe('—');
    expect(last.entries[0]!.valueDisplay).toBe('—');
  });

  it('ignores a mode whose character is not in the list', () => {
    const groups = rank({
      modes: [{ id: 'ghost', characterId: 'gone', name: 'Fantasma' }],
    });

    expect(flatten(groups)).toEqual(['Ilda', 'Bento']);
  });

  it('returns nothing when there is nobody to rank', () => {
    expect(rank({ characters: [], modes: [] })).toEqual([]);
  });
});
