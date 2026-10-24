import { act, cleanup, renderHook } from '@testing-library/react-native';
import { useSyncAccountNotice } from '@/src/hooks/guides/useSyncAccountNotice';
import { SYNC_ACCOUNT_NOTICE_ID } from '@/src/guides/shouldShowSyncNotice';
import { useUserSettingsStore } from '@/src/state/app/userSettingsStore';
import { defaultTutorialProgress } from '@/src/utils/ui/tutorialProgress';
import { isServerless } from '@/src/utils/platform/clientFlavor';
import { withSilencedConsole } from '@/test/helpers/silenceConsole';

const mockDrizzle = {};
const mockMarkTutorialSeen = jest.fn();
const mockShowcase = { current: null as unknown };

jest.mock('@/src/db', () => ({
  useDrizzle: () => mockDrizzle,
}));

jest.mock('@/src/services/showcase/showcaseRequest', () => ({
  __esModule: true,
  readShowcaseRequest: () => mockShowcase.current,
}));

// A function the registry already calls while it loads, so it is a jest.fn (answering false) rather than a closure over the state.
jest.mock('@/src/utils/platform/clientFlavor', () => ({
  ...jest.requireActual('@/src/utils/platform/clientFlavor'),
  isServerless: jest.fn(() => false),
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(isServerless).mockReturnValue(false);
  mockShowcase.current = null;
  mockMarkTutorialSeen.mockResolvedValue(undefined);
  useUserSettingsStore.setState({
    showTutorials: true,
    tutorialProgress: { ...defaultTutorialProgress(), seen: [] },
    markTutorialSeen: mockMarkTutorialSeen,
  });
});

afterEach(async () => {
  await cleanup();
});

describe('useSyncAccountNotice', () => {
  it('is visible for a device with no server that has never been told', async () => {
    const { result } = await renderHook(() => useSyncAccountNotice(0));

    expect(result.current.visible).toBe(true);
    expect(mockMarkTutorialSeen).not.toHaveBeenCalled();
  });

  it('stays hidden until the servers have been read, then shows once they show none', async () => {
    const { result, rerender } = await renderHook(
      ({ count }: { count: number | null }) => useSyncAccountNotice(count),
      { initialProps: { count: null as number | null } },
    );
    expect(result.current.visible).toBe(false);

    await rerender({ count: 0 });
    expect(result.current.visible).toBe(true);
  });

  it('stays hidden for a device that already has a server', async () => {
    expect((await renderHook(() => useSyncAccountNotice(1))).result.current.visible).toBe(false);
    expect((await renderHook(() => useSyncAccountNotice(3))).result.current.visible).toBe(false);
  });

  it('stays hidden once the notice was seen', async () => {
    useUserSettingsStore.setState({
      tutorialProgress: {
        ...defaultTutorialProgress(),
        seen: [SYNC_ACCOUNT_NOTICE_ID],
      },
    });

    expect((await renderHook(() => useSyncAccountNotice(0))).result.current.visible).toBe(false);
  });

  it('stays hidden while the tutorials are switched off', async () => {
    useUserSettingsStore.setState({ showTutorials: false });

    expect((await renderHook(() => useSyncAccountNotice(0))).result.current.visible).toBe(false);
  });

  it('stays hidden in the serverless browser build', async () => {
    jest.mocked(isServerless).mockReturnValue(true);

    expect((await renderHook(() => useSyncAccountNotice(0))).result.current.visible).toBe(false);
  });

  it('stays hidden during a showcase capture', async () => {
    mockShowcase.current = { story: 'alice' };

    expect((await renderHook(() => useSyncAccountNotice(0))).result.current.visible).toBe(false);
  });

  it('hides at once when dismissed, and records the notice as seen', async () => {
    const { result } = await renderHook(() => useSyncAccountNotice(0));
    expect(result.current.visible).toBe(true);

    await act(async () => {
      result.current.dismiss();
    });

    expect(result.current.visible).toBe(false);
    expect(mockMarkTutorialSeen).toHaveBeenCalledTimes(1);
    expect(mockMarkTutorialSeen).toHaveBeenCalledWith(mockDrizzle, 'sync-account-prompt');
  });

  it('does not throw for the caller when recording the dismissal fails, and still hides', async () => {
    await withSilencedConsole(['error'], async (spies) => {
      mockMarkTutorialSeen.mockRejectedValueOnce(new Error('disk full'));
      const { result } = await renderHook(() => useSyncAccountNotice(0));

      await act(async () => {
        expect(() => result.current.dismiss()).not.toThrow();
      });

      expect(result.current.visible).toBe(false);
      await act(async () => {});
      expect(spies.error).toHaveBeenCalled();
    });
  });
});
