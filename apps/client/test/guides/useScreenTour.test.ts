import { renderHook } from '@testing-library/react-native';
import { useScreenTour } from '../../src/guides/useScreenTour';
import { useGuideStore } from '../../src/state/guideStore';
import { useUserSettingsStore } from '../../src/state/userSettingsStore';
import { defaultTutorialProgress } from '../../src/utils/tutorialProgress';

jest.mock('@react-navigation/native', () => {
  const react = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    useFocusEffect: (callback: () => void | (() => void)) => react.useEffect(callback, [callback]),
  };
});

beforeEach(() => {
  useGuideStore.setState({ activeTour: null, dismissedGuideIds: [], snoozedGuideId: null });
  useUserSettingsStore.setState({
    showTutorials: true,
    tutorialProgress: defaultTutorialProgress(),
  });
});

describe('useScreenTour', () => {
  it('starts an unseen tour on focus', async () => {
    await renderHook(() => useScreenTour('BoardCanvas', true));

    expect(useGuideStore.getState().activeTour?.guide.id).toBe('BoardCanvas');
  });

  it('starts by default without the flag', async () => {
    await renderHook(() => useScreenTour('LocationMap'));

    expect(useGuideStore.getState().activeTour?.guide.id).toBe('LocationMap');
  });

  it('stays quiet when disabled', async () => {
    await renderHook(() => useScreenTour('BoardCanvas', false));

    expect(useGuideStore.getState().activeTour).toBeNull();
  });

  it('stays quiet without a registered guide', async () => {
    await renderHook(() => useScreenTour('NoSuchScreen', true));

    expect(useGuideStore.getState().activeTour).toBeNull();
  });
});
