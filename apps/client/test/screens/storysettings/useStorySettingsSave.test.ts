const mockAlert = jest.fn();
const mockGoBack = jest.fn();
const mockUpdateStory = jest.fn();
const mockSyncStoryNow = jest.fn();
const mockSetSelectedStory = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: (...args: unknown[]) => mockGoBack(...args) }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/src/db', () => ({ useDrizzle: () => ({}) }));
jest.mock('@/src/hooks/ui/useAsyncOperation', () => ({
  useAsyncOperation: () => ({
    pending: false,
    run: (operation: () => Promise<void>) => operation(),
  }),
}));
jest.mock('@/src/services/storymanagement/story-lifecycle/StoryService', () => ({
  createStoryService: () => ({
    updateStory: (...args: unknown[]) => mockUpdateStory(...args),
  }),
}));
jest.mock('@/src/services/sync/appSyncEngine', () => ({
  syncEngine: { syncStoryNow: (...args: unknown[]) => mockSyncStoryNow(...args) },
}));
jest.mock('@/src/state/story/storyStore', () => ({
  useStoryStore: () => ({
    selectedStory: { id: 'story-1', allowReaderComments: false },
    setSelectedStory: (...args: unknown[]) => mockSetSelectedStory(...args),
  }),
}));
jest.mock('@/src/state/app/userSettingsStore', () => ({
  useUserSettingsStore: () => ({ userId: 'user-1' }),
}));
jest.mock('@/src/state/ui/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));

import { act, renderHook } from '@testing-library/react-native';
import { useStorySettingsSave } from '@/src/screens/storysettings/useStorySettingsSave';

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockUpdateStory.mockResolvedValue(undefined);
  mockSyncStoryNow.mockResolvedValue({ conflicts: 0, refusals: [] });
});

afterEach(() => {
  jest.restoreAllMocks();
  mockAlert.mockClear();
  mockGoBack.mockClear();
  mockUpdateStory.mockReset();
  mockSyncStoryNow.mockReset();
});

describe('useStorySettingsSave', () => {
  it('shows the success message once the save has reached the server', async () => {
    const view = await renderHook(() => useStorySettingsSave());

    await act(async () => view.result.current.save({ allowReaderComments: true }));

    expect(mockUpdateStory).toHaveBeenCalledWith('user-1', 'story-1', {
      allowReaderComments: true,
    });
    expect(mockSyncStoryNow).toHaveBeenCalledWith('story-1');
    expect(mockAlert).toHaveBeenCalledWith('success', 'story_updated_successfully');
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('lists what the server refused, and shows no success message, when a save does not reach it', async () => {
    mockSyncStoryNow.mockResolvedValueOnce({
      conflicts: 1,
      refusals: [
        {
          clientOperationId: 'op-1',
          entity: 'Story',
          entityId: 'story-1',
          type: 'update' as const,
          reason: 'unauthorized' as const,
          message: 'Only the owner may change this.',
        },
      ],
    });
    const view = await renderHook(() => useStorySettingsSave());

    await act(async () => view.result.current.save({ allowReaderComments: true }));

    expect(mockAlert).toHaveBeenCalledWith(
      'error',
      expect.stringContaining('conflict_reason_unauthorized'),
    );
    expect(mockAlert).not.toHaveBeenCalledWith('success', 'story_updated_successfully');
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('keeps the local save and reports the failure when the local write itself fails', async () => {
    mockUpdateStory.mockRejectedValueOnce(new Error('disk full'));
    const view = await renderHook(() => useStorySettingsSave());

    await act(async () => view.result.current.save({ allowReaderComments: true }));

    expect(mockSyncStoryNow).not.toHaveBeenCalled();
    expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_save_story_settings');
    expect(mockAlert).not.toHaveBeenCalledWith('success', 'story_updated_successfully');
  });
});
