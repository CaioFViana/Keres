import { renderHook } from '@testing-library/react-native';
import type { BoardNodeType } from '@keres/shared';
import type { BoardPinOption } from '../../src/hooks/useBoardPinOptions';
import { useBoardNodeTitles } from '../../src/hooks/useBoardNodeTitles';

const nodes = [
  { id: 'note', kind: 'note', title: '  ', x: 0, y: 0 },
  {
    id: 'live',
    kind: 'entity',
    entityType: 'Character',
    entityId: 'c1',
    labelAtPin: 'Old label',
    x: 0,
    y: 0,
  },
  {
    id: 'ghost',
    kind: 'entity',
    entityType: 'Character',
    entityId: 'gone',
    labelAtPin: 'Pinned label',
    x: 0,
    y: 0,
  },
] as unknown as BoardNodeType[];

const options = [
  { entityType: 'Character', entityId: 'c1', label: 'Live label', group: 'character' },
] as BoardPinOption[];

describe('useBoardNodeTitles', () => {
  it('falls back to the note label, prefers live labels, and ghosts deleted pins', async () => {
    const view = await renderHook(() => useBoardNodeTitles(nodes, options));
    const { titles, nodeTitles } = view.result.current;
    expect(titles.note.title).toBe('board_note');
    expect(titles.note.ghost).toBeUndefined();
    expect(titles.live.title).toBe('Live label');
    expect(titles.live.ghost).toBeUndefined();
    expect(titles.ghost.title).toBe('Pinned label');
    expect(titles.ghost.ghost).toBe(true);
    expect(titles.ghost.typeLabel).toContain('board_deleted_entity');
    expect(nodeTitles).toEqual({
      note: 'board_note',
      live: 'Live label',
      ghost: 'Pinned label',
    });
  });
});
