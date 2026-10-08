const mockExportFullStory = jest.fn();
const mockBuildZipBytes = jest.fn();
const mockDeliverExport = jest.fn();
const mockDeliverZipExport = jest.fn();
const mockNotify = jest.fn();
const mockNotificationState = { showNotification: (...args: unknown[]) => mockNotify(...args) };

jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));
jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: () => ({}) }));
jest.mock('../../src/services/storymanagement/StoryService', () => ({
  __esModule: true,
  createStoryService: () => ({
    exportFullStory: (...args: unknown[]) => mockExportFullStory(...args),
  }),
}));
jest.mock('../../src/utils/storyMediaBundle', () => ({
  __esModule: true,
  buildStoryZipBytes: (...args: unknown[]) => mockBuildZipBytes(...args),
}));
jest.mock('../../src/utils/storyTransfer', () => ({
  __esModule: true,
  buildExportFileName: (title: string) => `${title}.json`,
  buildExportZipFileName: (title: string) => `${title}.zip`,
  deliverStoryExport: (...args: unknown[]) => mockDeliverExport(...args),
  deliverStoryZipExport: (...args: unknown[]) => mockDeliverZipExport(...args),
}));
jest.mock('../../src/state/notificationStore', () => ({
  __esModule: true,
  useNotificationStore: (selector?: (state: unknown) => unknown) =>
    typeof selector === 'function' ? selector(mockNotificationState) : mockNotificationState,
}));

import { act, renderHook } from '@testing-library/react-native';
import { useStoryBackupExport } from '../../src/hooks/useStoryBackupExport';
import { withSilencedConsole } from '../helpers/silenceConsole';

const STORY = { id: 'story-1', title: 'Epic' };

beforeEach(() => {
  jest.clearAllMocks();
  mockExportFullStory.mockResolvedValue({ story: { title: 'Epic' } });
  mockBuildZipBytes.mockResolvedValue({
    bytes: new Uint8Array([1]),
    includedCount: 2,
    totalCount: 2,
  });
  mockDeliverExport.mockResolvedValue({ delivered: true, fileName: 'Epic.json' });
  mockDeliverZipExport.mockResolvedValue({ delivered: true, fileName: 'Epic.zip' });
});

describe('useStoryBackupExport', () => {
  it('exports the story as data only', async () => {
    const { result } = await renderHook(() => useStoryBackupExport(STORY));

    await act(async () => {
      await result.current.exportJson();
    });

    expect(mockExportFullStory).toHaveBeenCalledWith('story-1');
    expect(mockDeliverExport).toHaveBeenCalledWith({ story: { title: 'Epic' } }, 'Epic.json');
    expect(mockNotify).toHaveBeenCalledWith('export_story_success', 'success');
    expect(result.current.exporting).toBe(false);
  });

  it('says where the file is when nothing can share it', async () => {
    mockDeliverExport.mockResolvedValue({ delivered: false, fileName: 'Epic.json', uri: '/tmp/x' });
    const { result } = await renderHook(() => useStoryBackupExport(STORY));

    await act(async () => {
      await result.current.exportJson();
    });

    expect(mockNotify).toHaveBeenCalledWith('export_story_no_share_target', 'warning');
  });

  it('reports a failed export', async () => {
    await withSilencedConsole(['log'], async () => {
      mockExportFullStory.mockRejectedValue(new Error('boom'));
      const { result } = await renderHook(() => useStoryBackupExport(STORY));

      await act(async () => {
        await result.current.exportJson();
      });

      expect(mockNotify).toHaveBeenCalledWith('export_story_failed', 'error');
      expect(result.current.exporting).toBe(false);
    });
  });

  it('exports the story with the media the device has', async () => {
    const { result } = await renderHook(() => useStoryBackupExport(STORY));

    await act(async () => {
      await result.current.exportZip();
    });

    expect(mockBuildZipBytes).toHaveBeenCalledWith({ story: { title: 'Epic' } }, 'story-1');
    expect(mockDeliverZipExport).toHaveBeenCalledWith(expect.any(Uint8Array), 'Epic.zip');
    expect(mockNotify).toHaveBeenCalledWith('export_story_success', 'success');
  });

  it('warns that the package is missing media this device never downloaded', async () => {
    mockBuildZipBytes.mockResolvedValue({
      bytes: new Uint8Array([1]),
      includedCount: 1,
      totalCount: 3,
    });
    const { result } = await renderHook(() => useStoryBackupExport(STORY));

    await act(async () => {
      await result.current.exportZip();
    });

    expect(mockNotify).toHaveBeenCalledWith('export_story_zip_success_partial', 'warning');
  });

  it('reports a failed package', async () => {
    await withSilencedConsole(['log'], async () => {
      mockBuildZipBytes.mockRejectedValue(new Error('zip boom'));
      const { result } = await renderHook(() => useStoryBackupExport(STORY));

      await act(async () => {
        await result.current.exportZip();
      });

      expect(mockNotify).toHaveBeenCalledWith('export_story_failed', 'error');
    });
  });

  it('does nothing without a story', async () => {
    const { result } = await renderHook(() => useStoryBackupExport(null));

    await act(async () => {
      await result.current.exportJson();
      await result.current.exportZip();
    });

    expect(mockExportFullStory).not.toHaveBeenCalled();
  });
});
