/**
 * @jest-environment node
 */
const mockSave = jest.fn();
const mockDelete = jest.fn();
const mockAlert = jest.fn();

jest.mock('../../../src/services/storymanagement/CharacterRelationService', () => ({
  __esModule: true,
  createCharacterRelationService: () => ({
    saveCharacterRelation: (...args: unknown[]) => mockSave(...args),
    deleteCharacterRelation: (...args: unknown[]) => mockDelete(...args),
  }),
}));
jest.mock('../../../src/utils/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import type { CharacterRelation } from '@keres/shared/entities/CharacterRelation';
import { act, renderHook } from '@testing-library/react-native';
import { useCharacterRelationEditor } from '../../../src/screens/characterrelations/useCharacterRelationEditor';
import { entityEventEmitter } from '../../../src/utils/EventEmitter';

const stamp = new Date('2026-01-01T00:00:00.000Z');
const relation = (id: string, a: string, b: string, type = 'friend'): CharacterRelation => ({
  id,
  storyId: 'story-1',
  character1Id: a,
  character2Id: b,
  relationType: type,
  createdAt: stamp,
  updatedAt: stamp,
  version: 3,
  isDeleted: false,
  deletedAt: null,
});

const RELATIONS = [relation('r1', 'a', 'b'), relation('r2', 'b', 'c', 'rival')];

async function setup(overrides: { userId?: string | null; storyId?: string } = {}) {
  const reload = jest.fn().mockResolvedValue(undefined);
  const view = await renderHook(() =>
    useCharacterRelationEditor({
      db: {} as never,
      storyId: 'storyId' in overrides ? overrides.storyId : 'story-1',
      userId: 'userId' in overrides ? overrides.userId : 'user-1',
      relations: RELATIONS,
      reload,
    }),
  );
  return { reload, ...view };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSave.mockResolvedValue({});
  mockDelete.mockResolvedValue(true);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('opening the editor', () => {
  it('is closed until asked', async () => {
    const { result } = await setup();

    expect(result.current.target).toBeNull();
    expect(result.current.editing).toBeNull();
    expect(result.current.relatedCharacterIds).toEqual([]);
  });

  it('opens to add a relation, leaving out who the character already knows', async () => {
    const { result } = await setup();

    await act(async () => result.current.openAdd('b'));

    expect(result.current.target).toEqual({ characterId: 'b', relationId: null });
    expect(result.current.editing).toBeNull();
    expect([...result.current.relatedCharacterIds].sort()).toEqual(['a', 'c']);
  });

  it('opens to change a relation, with that relation in hand', async () => {
    const { result } = await setup();

    await act(async () => result.current.openEdit('a', 'r1'));

    expect(result.current.editing?.id).toBe('r1');
    expect(result.current.relatedCharacterIds).toEqual(['b']);
  });

  it('closes', async () => {
    const { result } = await setup();
    await act(async () => result.current.openAdd('a'));

    await act(async () => result.current.close());

    expect(result.current.target).toBeNull();
  });
});

describe('saving', () => {
  it('writes a new relation under a fresh id with the pair in order, then announces it and reloads', async () => {
    const heard = jest.fn();
    entityEventEmitter.on('character_relation_changed', heard);
    const { result, reload } = await setup();
    await act(async () => result.current.openAdd('z'));

    await act(async () => result.current.save('a', 'mentor'));

    const [user, saved] = mockSave.mock.calls[0];
    expect(user).toBe('user-1');
    expect(saved).toMatchObject({
      storyId: 'story-1',
      character1Id: 'a',
      character2Id: 'z',
      relationType: 'mentor',
      version: 1,
      isDeleted: false,
    });
    expect(typeof saved.id).toBe('string');
    expect(saved.id.length).toBeGreaterThan(0);
    expect(heard).toHaveBeenCalledWith('story-1', 'z');
    expect(reload).toHaveBeenCalledTimes(1);
    entityEventEmitter.off('character_relation_changed', heard);
  });

  it('keeps the identity and history of a relation that is changed', async () => {
    const { result } = await setup();
    await act(async () => result.current.openEdit('a', 'r1'));

    await act(async () => result.current.save('b', 'enemy', 'r1'));

    expect(mockSave.mock.calls[0][1]).toMatchObject({
      id: 'r1',
      character1Id: 'a',
      character2Id: 'b',
      relationType: 'enemy',
      createdAt: stamp,
      version: 3,
    });
  });

  it('tells the author when it cannot be written, and does not reload', async () => {
    mockSave.mockRejectedValueOnce(new Error('db down'));
    const { result, reload } = await setup();
    await act(async () => result.current.openAdd('a'));

    await act(async () => result.current.save('b', 'friend'));

    expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_save_relation');
    expect(reload).not.toHaveBeenCalled();
  });

  it.each([
    ['no user', { userId: null }],
    ['no story', { storyId: undefined }],
  ])('writes nothing and says so with %s', async (_label, options) => {
    const { result } = await setup(options);
    await act(async () => result.current.openAdd('a'));

    await act(async () => result.current.save('b', 'friend'));

    expect(mockSave).not.toHaveBeenCalled();
    expect(mockAlert).toHaveBeenCalledWith('error', 'service_not_initialized');
  });
});

describe('removing', () => {
  const confirm = () => {
    const buttons = mockAlert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    return buttons.find((button) => button.text === 'delete')!.onPress!();
  };

  it('asks first, and deletes nothing until the author agrees', async () => {
    const { result } = await setup();

    await act(async () => result.current.remove('a', 'r1'));

    expect(mockAlert).toHaveBeenCalledWith(
      'delete_character_relation_title',
      'delete_character_relation_message',
      expect.any(Array),
      { cancelable: true },
    );
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('deletes once confirmed, announces it and reloads', async () => {
    const heard = jest.fn();
    entityEventEmitter.on('character_relation_changed', heard);
    const { result, reload } = await setup();
    await act(async () => result.current.remove('a', 'r1'));

    await act(async () => confirm());

    expect(mockDelete).toHaveBeenCalledWith('user-1', 'r1');
    expect(heard).toHaveBeenCalledWith('story-1', 'a');
    expect(reload).toHaveBeenCalledTimes(1);
    entityEventEmitter.off('character_relation_changed', heard);
  });

  it('says so when the service reports that it did not delete', async () => {
    mockDelete.mockResolvedValueOnce(false);
    const { result, reload } = await setup();
    await act(async () => result.current.remove('a', 'r1'));
    const buttons = mockAlert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    mockAlert.mockClear();

    await act(async () => buttons.find((b) => b.text === 'delete')!.onPress!());

    expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_delete_relation');
    expect(reload).not.toHaveBeenCalled();
  });

  it('says so when deleting throws', async () => {
    mockDelete.mockRejectedValueOnce(new Error('db down'));
    const { result, reload } = await setup();
    await act(async () => result.current.remove('a', 'r1'));
    const buttons = mockAlert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    mockAlert.mockClear();

    await act(async () => buttons.find((b) => b.text === 'delete')!.onPress!());

    expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_delete_relation');
    expect(reload).not.toHaveBeenCalled();
  });

  it('can be cancelled without touching anything', async () => {
    const { result } = await setup();
    await act(async () => result.current.remove('a', 'r1'));

    const buttons = mockAlert.mock.calls[0][2] as { text: string; style?: string }[];
    expect(buttons.find((b) => b.text === 'cancel')?.style).toBe('cancel');
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
