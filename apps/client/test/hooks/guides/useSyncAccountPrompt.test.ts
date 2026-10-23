import { act, cleanup, renderHook } from '@testing-library/react-native';
import { useSyncAccountPrompt } from '@/src/hooks/guides/useSyncAccountPrompt';
import { getScreenGuide } from '@/src/guides/registry';
import { SYNC_ACCOUNT_PROMPT_ID } from '@/src/guides/shouldShowSyncPrompt';
import { useGuideStore } from '@/src/state/ui/guideStore';
import { useUserSettingsStore } from '@/src/state/app/userSettingsStore';
import { defaultTutorialProgress } from '@/src/utils/ui/tutorialProgress';
import { isServerless } from '@/src/utils/platform/clientFlavor';

jest.unmock('@/src/hooks/guides/useSyncAccountPrompt');

const mockDrizzle = {};
const mockAlert = jest.fn();
const mockMarkTutorialSeen = jest.fn();
const mockFocused = { current: true };
const mockShowcase = { current: null as unknown };

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useIsFocused: () => mockFocused.current,
}));

jest.mock('@/src/db', () => ({
  useDrizzle: () => mockDrizzle,
}));

jest.mock('@/src/state/ui/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
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

const openServers = jest.fn();

/** The notice's own buttons, as the alert was given them. */
const alertButtons = () => mockAlert.mock.calls[0][2] as { text: string; onPress?: () => void }[];

const tourId = 'StorySelectionMain';

beforeEach(() => {
  jest.clearAllMocks();
  mockFocused.current = true;
  jest.mocked(isServerless).mockReturnValue(false);
  mockShowcase.current = null;
  mockMarkTutorialSeen.mockResolvedValue(undefined);
  useGuideStore.setState({ activeTour: null, dismissedGuideIds: [], snoozedGuideId: null });
  // Everything but the notice itself is out of the way: the screen's own tour is already seen.
  useUserSettingsStore.setState({
    showTutorials: true,
    tutorialProgress: { ...defaultTutorialProgress(), seen: [tourId] },
    markTutorialSeen: mockMarkTutorialSeen,
  });
});

afterEach(async () => {
  await cleanup();
});

const renderPrompt = (serverCount: number | null = 0) =>
  renderHook(({ count }: { count: number | null }) => useSyncAccountPrompt(count, openServers), {
    initialProps: { count: serverCount },
  });

describe('useSyncAccountPrompt', () => {
  it('opens the notice once, even when the screen renders again', async () => {
    const view = await renderPrompt(0);
    await view.rerender({ count: 0 });
    await view.rerender({ count: 0 });

    expect(mockAlert).toHaveBeenCalledTimes(1);
    expect(mockAlert).toHaveBeenCalledWith(
      'sync_prompt_title',
      'sync_prompt_message',
      expect.any(Array),
    );
  });

  it('records the notice as seen when it opens', async () => {
    const view = await renderPrompt(0);
    await view.rerender({ count: 0 });

    expect(mockMarkTutorialSeen).toHaveBeenCalledTimes(1);
    expect(mockMarkTutorialSeen).toHaveBeenCalledWith(mockDrizzle, SYNC_ACCOUNT_PROMPT_ID);
  });

  it('offers a way out with "later" and a way to the servers with the action', async () => {
    await renderPrompt(0);

    const buttons = alertButtons();
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toEqual({ text: 'sync_prompt_later', style: 'cancel' });
    expect(buttons[1].text).toBe('sync_prompt_action');
  });

  it('goes to server management from the action, and not from "later"', async () => {
    await renderPrompt(0);

    expect(openServers).not.toHaveBeenCalled();
    alertButtons()[0].onPress?.();
    expect(openServers).not.toHaveBeenCalled();

    alertButtons()[1].onPress?.();
    expect(openServers).toHaveBeenCalledTimes(1);
  });

  it('waits for the servers to be read, then opens once they show none', async () => {
    const view = await renderPrompt(null);
    expect(mockAlert).not.toHaveBeenCalled();

    await view.rerender({ count: 0 });
    expect(mockAlert).toHaveBeenCalledTimes(1);
  });

  it('stays quiet for a device that already has a server', async () => {
    const view = await renderPrompt(2);
    await view.rerender({ count: 2 });

    expect(mockAlert).not.toHaveBeenCalled();
    expect(mockMarkTutorialSeen).not.toHaveBeenCalled();
  });

  it('stays quiet once the notice was seen', async () => {
    useUserSettingsStore.setState({
      tutorialProgress: { ...defaultTutorialProgress(), seen: [tourId, SYNC_ACCOUNT_PROMPT_ID] },
    });
    await renderPrompt(0);

    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('waits for the screen tour to be seen before opening', async () => {
    useUserSettingsStore.setState({
      tutorialProgress: { ...defaultTutorialProgress(), seen: [] },
    });
    const view = await renderPrompt(0);
    expect(mockAlert).not.toHaveBeenCalled();

    await act(async () => {
      useUserSettingsStore.setState({
        tutorialProgress: { ...defaultTutorialProgress(), seen: [tourId] },
      });
    });
    await view.rerender({ count: 0 });
    expect(mockAlert).toHaveBeenCalledTimes(1);
  });

  it('does not interrupt a tour that is playing', async () => {
    const guide = getScreenGuide(tourId);
    if (!guide) throw new Error(`no guide registered for ${tourId}`);
    useGuideStore.setState({ activeTour: { guide, stepIndex: 0 } });
    await renderPrompt(0);

    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('stays quiet while the tutorials are switched off', async () => {
    useUserSettingsStore.setState({ showTutorials: false });
    await renderPrompt(0);

    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('stays quiet while the screen is not in front, and opens once it is', async () => {
    mockFocused.current = false;
    const view = await renderPrompt(0);
    expect(mockAlert).not.toHaveBeenCalled();

    mockFocused.current = true;
    await view.rerender({ count: 0 });
    expect(mockAlert).toHaveBeenCalledTimes(1);
  });

  it('stays quiet in the serverless browser build', async () => {
    jest.mocked(isServerless).mockReturnValue(true);
    await renderPrompt(0);

    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('stays quiet during a showcase capture', async () => {
    mockShowcase.current = { story: 'alice' };
    await renderPrompt(0);

    expect(mockAlert).not.toHaveBeenCalled();
  });
});
