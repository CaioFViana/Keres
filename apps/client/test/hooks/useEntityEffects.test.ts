const mockDb = {};
const mockT = (key: string) => key;
const mockEffectService = {
  getEffectsByEntity: jest.fn(),
  createEffect: jest.fn(),
  updateEffect: jest.fn(),
  deleteEffect: jest.fn(),
};
const mockAlert = jest.fn();

jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: jest.fn(() => mockDb) }));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: jest.fn(() => ({ t: mockT })),
}));
jest.mock('../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: jest.fn(() => ({ userId: 'user' })),
}));
jest.mock('../../src/services/storymanagement/EffectService', () => ({
  __esModule: true,
  createEffectService: jest.fn(() => mockEffectService),
}));
jest.mock('../../src/utils/AppAlert', () => ({
  __esModule: true,
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useEntityEffects } from '../../src/hooks/useEntityEffects';
import { entityEventEmitter } from '../../src/utils/EventEmitter';

beforeEach(() => {
  jest.clearAllMocks();
  mockEffectService.getEffectsByEntity.mockResolvedValue([
    { id: 'effect-1', effectType: 'itemGrant' },
  ]);
  mockEffectService.createEffect.mockResolvedValue({ id: 'effect-2', effectType: 'itemGrant' });
  mockEffectService.updateEffect.mockResolvedValue({ id: 'effect-1', effectType: 'triggerSet' });
});

describe('useEntityEffects', () => {
  it('loads, creates, changes and deletes effects while announcing mutations', async () => {
    const view = await renderHook(() => useEntityEffects('Scene', 'scene', 'story', true));
    await waitFor(() =>
      expect(view.result.current.effects).toEqual([{ id: 'effect-1', effectType: 'itemGrant' }]),
    );

    await act(async () => view.result.current.handleAddEffect());
    expect(mockEffectService.createEffect).toHaveBeenCalledWith(
      'user',
      expect.objectContaining({
        storyId: 'story',
        entityType: 'Scene',
        entityId: 'scene',
        effectType: 'itemGrant',
      }),
    );
    await act(async () => view.result.current.handleChangeEffectType('effect-1', 'triggerSet'));
    expect(mockEffectService.updateEffect).toHaveBeenCalledWith('user', 'effect-1', {
      effectType: 'triggerSet',
      itemId: null,
      triggerName: null,
    });
    await act(async () => view.result.current.handleDeleteEffect('effect-2'));
    expect(mockEffectService.deleteEffect).toHaveBeenCalledWith('user', 'effect-2');
    expect(() => entityEventEmitter.emit('effect_changed', 'story', 'scene')).not.toThrow();
  });

  it('keeps the list safe when loading or saving fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockEffectService.getEffectsByEntity.mockRejectedValueOnce(new Error('offline'));
    const view = await renderHook(() => useEntityEffects('Choice', 'choice', 'story', true));
    await waitFor(() => expect(mockEffectService.getEffectsByEntity).toHaveBeenCalled());
    expect(view.result.current.effects).toEqual([]);

    mockEffectService.createEffect.mockRejectedValueOnce(new Error('denied'));
    await act(async () => view.result.current.handleAddEffect());
    expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_save_effect');
  });
});
