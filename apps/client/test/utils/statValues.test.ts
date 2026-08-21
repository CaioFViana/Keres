import {
  indexStatValues,
  resolveCharacterStats,
  resolveStatValue,
} from '../../src/utils/statValues';

const index = indexStatValues([
  { characterId: 'ilda', modeId: null, statId: 'courage', value: 100 },
  { characterId: 'ilda', modeId: null, statId: 'cunning', value: 30 },
  { characterId: 'ilda', modeId: 'storm', statId: 'courage', value: 480 },
]);

describe('resolveStatValue', () => {
  it('reads the value of the normal mode', () => {
    expect(resolveStatValue(index, 'ilda', null, 'courage')).toEqual({
      value: 100,
      inherited: false,
    });
  });

  it('prefers the value the mode overrode', () => {
    expect(resolveStatValue(index, 'ilda', 'storm', 'courage')).toEqual({
      value: 480,
      inherited: false,
    });
  });

  it('inherits from the normal mode when the mode has no value of its own', () => {
    expect(resolveStatValue(index, 'ilda', 'storm', 'cunning')).toEqual({
      value: 30,
      inherited: true,
    });
  });

  it('reports no value when neither the mode nor the normal mode has one', () => {
    expect(resolveStatValue(index, 'ilda', 'storm', 'reputation')).toEqual({
      value: null,
      inherited: false,
    });
  });

  it('never inherits into the normal mode itself', () => {
    expect(resolveStatValue(index, 'ilda', null, 'reputation')).toEqual({
      value: null,
      inherited: false,
    });
  });

  it('keeps characters apart', () => {
    expect(resolveStatValue(index, 'bento', null, 'courage').value).toBeNull();
  });

  it('honours a zero written on the mode instead of falling back', () => {
    const withZero = indexStatValues([
      { characterId: 'ilda', modeId: null, statId: 'courage', value: 100 },
      { characterId: 'ilda', modeId: 'storm', statId: 'courage', value: 0 },
    ]);

    expect(resolveStatValue(withZero, 'ilda', 'storm', 'courage')).toEqual({
      value: 0,
      inherited: false,
    });
  });
});

describe('resolveCharacterStats', () => {
  it('resolves every requested stat in one pass', () => {
    const resolved = resolveCharacterStats(index, 'ilda', 'storm', [
      'courage',
      'cunning',
      'reputation',
    ]);

    expect(resolved.get('courage')).toEqual({ value: 480, inherited: false });
    expect(resolved.get('cunning')).toEqual({ value: 30, inherited: true });
    expect(resolved.get('reputation')).toEqual({ value: null, inherited: false });
  });
});
