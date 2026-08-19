import { describe, expect, it } from 'vitest';
import { getSimpleDisplayName } from '../../metadata/entityDisplayName';

describe('getSimpleDisplayName', () => {
  it('uses Character.name even when title is also set', () => {
    expect(
      getSimpleDisplayName('Character', { name: 'Keres', title: 'Lady' }),
    ).toBe('Keres');
  });

  it('falls back Gallery title to fileName', () => {
    expect(getSimpleDisplayName('Gallery', { title: 'Cover', fileName: 'a.png' })).toBe('Cover');
    expect(getSimpleDisplayName('Gallery', { title: null, fileName: 'a.png' })).toBe('a.png');
  });

  it('reads Story.title and Choice.text', () => {
    expect(getSimpleDisplayName('Story', { title: 'Ouroboros' })).toBe('Ouroboros');
    expect(getSimpleDisplayName('Choice', { text: 'Go left' })).toBe('Go left');
  });

  it('snippets Comment text and uses Effect trigger/type', () => {
    expect(getSimpleDisplayName('Comment', { commentText: 'Hello world' })).toBe('Hello world');
    expect(getSimpleDisplayName('Effect', { triggerName: 'door_open', effectType: 'triggerSet' })).toBe(
      'door_open',
    );
    expect(getSimpleDisplayName('Effect', { effectType: 'itemGrant' })).toBe('itemGrant');
  });

  it('returns null for unknown or empty rows', () => {
    expect(getSimpleDisplayName('CharacterRelation', { character1Id: 'x' })).toBeNull();
    expect(getSimpleDisplayName('Character', { name: '  ' })).toBeNull();
  });
});
