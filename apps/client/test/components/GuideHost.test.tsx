import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { DrawerActions } from '@react-navigation/native';
import GuideHost from '../../src/components/common/feedback/GuideHost/GuideHost';
import { __resetGuideAnchorsForTests, registerGuideAnchor } from '../../src/guides/anchorRegistry';
import type { Guide } from '../../src/guides/types';
import {
  __resetGuideDrawersForTests,
  registerGuideDrawer,
} from '../../src/navigation/drawerGuideRegistry';
import { useGuideStore } from '../../src/state/guideStore';

jest.mock('../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      onPrimary: '#fff',
      primary: '#00f',
      surface: '#eee',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));
jest.mock('react-i18next', () => {
  const t = (key: string) => key;
  return { __esModule: true, useTranslation: () => ({ t }) };
});
const mockRecordSeen = jest.fn();
jest.mock('../../src/hooks/useGuidePersistence', () => ({
  __esModule: true,
  useGuidePersistence: () => mockRecordSeen,
}));
const mockResponsiveLayout = { isWide: false };
jest.mock('../../src/hooks/useResponsiveLayout', () => ({
  __esModule: true,
  useResponsiveLayout: () => mockResponsiveLayout,
}));

const twoStepGuide: Guide = {
  id: 'TourScreen',
  drawerId: 'story-selection',
  steps: [
    { id: 's1', titleKey: 'tour_title_1', bodyKey: 'tour_body_1' },
    { id: 's2', titleKey: 'tour_title_2', bodyKey: 'tour_body_2' },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockResponsiveLayout.isWide = false;
  useGuideStore.setState({ activeTour: null, dismissedGuideIds: [], snoozedGuideId: null });
  __resetGuideAnchorsForTests();
  __resetGuideDrawersForTests();
});

describe('GuideHost', () => {
  it('renders nothing without an active tour', async () => {
    const screen = await render(<GuideHost />);

    expect(screen.queryByTestId('guide-card')).toBeNull();
  });

  it('shows a card-only step with skip and next', async () => {
    useGuideStore.getState().startTour(twoStepGuide);
    const screen = await render(<GuideHost />);

    expect(screen.getByTestId('guide-card')).toBeTruthy();
    expect(screen.getByText('tour_title_1')).toBeTruthy();
    expect(screen.getByText('tour_body_1')).toBeTruthy();
    expect(screen.getByTestId('guide-skip')).toBeTruthy();
    expect(screen.getByTestId('guide-next')).toBeTruthy();
    expect(screen.queryByTestId('guide-prev')).toBeNull();
    expect(screen.queryByTestId('guide-finish')).toBeNull();
    expect(screen.queryByTestId('guide-spotlight')).toBeNull();
  });

  it('walks forward and back, offering finish on the last step', async () => {
    useGuideStore.getState().startTour(twoStepGuide);
    const screen = await render(<GuideHost />);

    await fireEvent.press(screen.getByTestId('guide-next'));
    expect(screen.getByText('tour_title_2')).toBeTruthy();
    expect(screen.getByTestId('guide-prev')).toBeTruthy();
    expect(screen.getByTestId('guide-finish')).toBeTruthy();
    expect(screen.queryByTestId('guide-next')).toBeNull();

    await fireEvent.press(screen.getByTestId('guide-prev'));
    expect(screen.getByText('tour_title_1')).toBeTruthy();
  });

  it('skipping dismisses and records the tour as seen', async () => {
    useGuideStore.getState().startTour(twoStepGuide);
    const screen = await render(<GuideHost />);

    await fireEvent.press(screen.getByTestId('guide-skip'));

    expect(screen.queryByTestId('guide-card')).toBeNull();
    expect(mockRecordSeen).toHaveBeenCalledWith('TourScreen');
  });

  it('snoozing closes the card without recording the tour as seen', async () => {
    useGuideStore.getState().startTour(twoStepGuide);
    const screen = await render(<GuideHost />);

    await fireEvent.press(screen.getByTestId('guide-snooze'));

    expect(screen.queryByTestId('guide-card')).toBeNull();
    expect(mockRecordSeen).not.toHaveBeenCalled();
    expect(useGuideStore.getState().snoozedGuideId).toBe('TourScreen');
    expect(useGuideStore.getState().dismissedGuideIds).toEqual([]);
  });

  it('finishing dismisses and records the tour as seen', async () => {
    useGuideStore.getState().startTour(twoStepGuide);
    const screen = await render(<GuideHost />);
    await fireEvent.press(screen.getByTestId('guide-next'));

    await fireEvent.press(screen.getByTestId('guide-finish'));

    expect(screen.queryByTestId('guide-card')).toBeNull();
    expect(mockRecordSeen).toHaveBeenCalledWith('TourScreen');
  });

  it('spotlights measured anchors once they resolve', async () => {
    registerGuideAnchor('target', async () => ({ x: 10, y: 100, width: 200, height: 40 }));
    useGuideStore.getState().startTour({
      id: 'TourScreen',
      drawerId: 'story-selection',
      steps: [{ id: 's1', anchors: ['target'], titleKey: 't', bodyKey: 'b' }],
    });
    const screen = await render(<GuideHost />);

    expect(await screen.findByTestId('guide-spotlight', {}, { timeout: 4000 })).toBeTruthy();
    expect(screen.getByTestId('guide-card')).toBeTruthy();
  });

  it('draws nothing until the first hole is measured, so the dim never shows without it', async () => {
    let resolve: (rect: { x: number; y: number; width: number; height: number }) => void = () => {};
    registerGuideAnchor(
      'target',
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    useGuideStore.getState().startTour({
      id: 'TourScreen',
      drawerId: 'story-selection',
      steps: [{ id: 's1', anchors: ['target'], titleKey: 't', bodyKey: 'b' }],
    });
    const screen = await render(<GuideHost />);

    expect(screen.queryByTestId('guide-card')).toBeNull();
    expect(screen.queryByTestId('guide-dim')).toBeNull();
    expect(screen.queryByTestId('guide-spotlight')).toBeNull();

    await act(async () => resolve({ x: 10, y: 100, width: 200, height: 40 }));

    expect(screen.getByTestId('guide-card')).toBeTruthy();
    expect(screen.getByTestId('guide-spotlight')).toBeTruthy();
    expect(screen.queryByTestId('guide-dim')).toBeNull();
  });

  it('keeps the card where it is while the next step is measured, instead of resting it elsewhere', async () => {
    registerGuideAnchor('a', async () => ({ x: 10, y: 100, width: 200, height: 40 }));
    registerGuideAnchor('b', () => new Promise(() => {}));
    useGuideStore.getState().startTour({
      id: 'TourScreen',
      drawerId: 'story-selection',
      steps: [
        { id: 's1', anchors: ['a'], titleKey: 't1', bodyKey: 'b1' },
        { id: 's2', anchors: ['b'], titleKey: 't2', bodyKey: 'b2' },
      ],
    });
    const screen = await render(<GuideHost />);
    await screen.findByTestId('guide-spotlight', {}, { timeout: 4000 });
    const top = () => StyleSheet.flatten(screen.getByTestId('guide-card-wrap').props.style).top;
    const before = top();

    await fireEvent.press(screen.getByTestId('guide-next'));
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(screen.getByText('t2')).toBeTruthy();
    expect(top()).toBe(before);
  });

  it('measures again a moment later, so the hole covers what laid out after the tour began', async () => {
    let calls = 0;
    registerGuideAnchor('late', async () => {
      calls += 1;
      return calls === 1
        ? { x: 10, y: 300, width: 200, height: 40 }
        : { x: 10, y: 100, width: 200, height: 240 };
    });
    useGuideStore.getState().startTour({
      id: 'TourScreen',
      drawerId: 'story-selection',
      steps: [{ id: 's1', anchors: ['late'], titleKey: 't', bodyKey: 'b' }],
    });
    const screen = await render(<GuideHost />);
    await screen.findByTestId('guide-spotlight', {}, { timeout: 4000 });

    // Once it has measured again the card sits under the taller hole, not the first, shorter one.
    await waitFor(() => expect(calls).toBeGreaterThan(1), { timeout: 2000 });
    const wrap = () => StyleSheet.flatten(screen.getByTestId('guide-card-wrap').props.style);
    await waitFor(() => expect(wrap().top).toBe(100 - 8 + 240 + 16 + 14), { timeout: 2000 });
  });

  it('opens card-only when the measurement never answers', async () => {
    jest.useFakeTimers();
    try {
      registerGuideAnchor('target', () => new Promise(() => {}));
      useGuideStore.getState().startTour({
        id: 'TourScreen',
        drawerId: 'story-selection',
        steps: [{ id: 's1', anchors: ['target'], titleKey: 't', bodyKey: 'b' }],
      });
      const screen = await render(<GuideHost />);
      expect(screen.queryByTestId('guide-card')).toBeNull();

      await act(async () => {
        jest.advanceTimersByTime(1600);
      });

      expect(screen.getByTestId('guide-card')).toBeTruthy();
      expect(screen.getByTestId('guide-dim')).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('dims through one canvas for every step, hole or none, and keeps the hole while the next is measured', async () => {
    registerGuideAnchor('a', async () => ({ x: 10, y: 100, width: 200, height: 40 }));
    let resolve: (rect: { x: number; y: number; width: number; height: number }) => void = () => {};
    registerGuideAnchor(
      'b',
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    useGuideStore.getState().startTour({
      id: 'TourScreen',
      drawerId: 'story-selection',
      steps: [
        { id: 's1', anchors: ['a'], titleKey: 't1', bodyKey: 'b1' },
        { id: 's2', anchors: ['b'], titleKey: 't2', bodyKey: 'b2' },
        { id: 's3', titleKey: 't3', bodyKey: 'b3' },
      ],
    });
    const screen = await render(<GuideHost />);
    expect(await screen.findByTestId('guide-spotlight', {}, { timeout: 4000 })).toBeTruthy();

    await fireEvent.press(screen.getByTestId('guide-next'));
    // Step two is still being measured: the hole of step one stays, nothing closes over the screen.
    expect(screen.getByText('t2')).toBeTruthy();
    expect(screen.getByTestId('guide-spotlight')).toBeTruthy();
    expect(screen.queryByTestId('guide-dim')).toBeNull();

    await act(async () => resolve({ x: 0, y: 300, width: 100, height: 40 }));
    await fireEvent.press(screen.getByTestId('guide-next'));
    expect(screen.getByTestId('guide-dim')).toBeTruthy();
    expect(screen.queryByTestId('guide-spotlight')).toBeNull();
  });

  it('stays card-only when anchors cannot be measured', async () => {
    registerGuideAnchor('target', async () => null);
    useGuideStore.getState().startTour({
      id: 'TourScreen',
      drawerId: 'story-selection',
      steps: [{ id: 's1', anchors: ['target', 'missing'], titleKey: 't', bodyKey: 'b' }],
    });
    const screen = await render(<GuideHost />);

    expect(await screen.findByTestId('guide-card', {}, { timeout: 4000 })).toBeTruthy();
    expect(screen.queryByTestId('guide-spotlight')).toBeNull();
    expect(screen.getByTestId('guide-dim')).toBeTruthy();
  });

  it('opens the drawer and scrolls to a drawer step', async () => {
    const dispatch = jest.fn();
    const scrollTo = jest.fn();
    registerGuideDrawer('story-selection', {
      navigation: { dispatch } as never,
      scrollTo,
      getScrollOffset: () => 0,
      measureScrollWindowY: async () => 0,
    });
    registerGuideAnchor('item', async () => ({ x: 0, y: 1400, width: 200, height: 40 }));
    useGuideStore.getState().startTour({
      id: 'TourScreen',
      drawerId: 'story-selection',
      steps: [
        { id: 's1', drawerId: 'story-selection', anchors: ['item'], titleKey: 't', bodyKey: 'b' },
      ],
    });
    const screen = await render(<GuideHost />);

    expect(await screen.findByTestId('guide-spotlight', {}, { timeout: 4000 })).toBeTruthy();
    expect(dispatch).toHaveBeenCalledWith(DrawerActions.openDrawer());
    expect(scrollTo).toHaveBeenCalledWith(1400 - 96);
  });

  it('points at a group that is already in view without scrolling the drawer', async () => {
    const scrollTo = jest.fn();
    registerGuideDrawer('story-selection', {
      navigation: { dispatch: jest.fn() } as never,
      scrollTo,
      getScrollOffset: () => 0,
      measureScrollWindowY: async () => 0,
    });
    registerGuideAnchor('item', async () => ({ x: 16, y: 400, width: 200, height: 40 }));
    useGuideStore.getState().startTour({
      id: 'TourScreen',
      drawerId: 'story-selection',
      steps: [
        { id: 's1', drawerId: 'story-selection', anchors: ['item'], titleKey: 't', bodyKey: 'b' },
      ],
    });
    const screen = await render(<GuideHost />);

    expect(await screen.findByTestId('guide-spotlight', {}, { timeout: 4000 })).toBeTruthy();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('puts the drawer back when the tour that opened it ends', async () => {
    const dispatch = jest.fn();
    registerGuideDrawer('story-selection', {
      navigation: { dispatch } as never,
      scrollTo: jest.fn(),
      getScrollOffset: () => 0,
      measureScrollWindowY: async () => 0,
    });
    registerGuideAnchor('item', async () => ({ x: 0, y: 400, width: 200, height: 40 }));
    useGuideStore.getState().startTour({
      id: 'TourScreen',
      drawerId: 'story-selection',
      steps: [
        { id: 's1', drawerId: 'story-selection', anchors: ['item'], titleKey: 't', bodyKey: 'b' },
      ],
    });
    const screen = await render(<GuideHost />);
    await screen.findByTestId('guide-spotlight', {}, { timeout: 4000 });

    await fireEvent.press(screen.getByTestId('guide-finish'));

    expect(dispatch).toHaveBeenCalledWith(DrawerActions.closeDrawer());
  });

  it('leaves the drawer alone when the tour never opened it', async () => {
    const dispatch = jest.fn();
    registerGuideDrawer('story-selection', {
      navigation: { dispatch } as never,
      scrollTo: jest.fn(),
      getScrollOffset: () => 0,
      measureScrollWindowY: async () => 0,
    });
    useGuideStore.getState().startTour(twoStepGuide);
    const screen = await render(<GuideHost />);

    await fireEvent.press(screen.getByTestId('guide-skip'));

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('waits for a sliding drawer to come to rest before it points at anything in it', async () => {
    registerGuideDrawer('story-selection', {
      navigation: { dispatch: jest.fn() } as never,
      scrollTo: jest.fn(),
      getScrollOffset: () => 0,
      measureScrollWindowY: async () => 0,
    });
    // The group is off to the left while the drawer opens, then in place.
    const xs = [-268, -150, 16, 16, 16, 16, 16];
    let call = 0;
    registerGuideAnchor('item', async () => ({
      x: xs[Math.min(call++, xs.length - 1)],
      y: 100,
      width: 236,
      height: 60,
    }));
    useGuideStore.getState().startTour({
      id: 'TourScreen',
      drawerId: 'story-selection',
      steps: [
        { id: 's1', drawerId: 'story-selection', anchors: ['item'], titleKey: 't', bodyKey: 'b' },
      ],
    });
    const screen = await render(<GuideHost />);

    await screen.findByTestId('guide-spotlight', {}, { timeout: 3000 });
    const arrow = () => screen.getByTestId('guide-arrow');
    // The arrow is over the middle of the group where it came to rest (x 16..252), not the first guess.
    await waitFor(
      () => {
        const left = StyleSheet.flatten(arrow().props.style).left as number;
        const card = StyleSheet.flatten(screen.getByTestId('guide-card-wrap').props.style);
        expect((card.left as number) + left + 8).toBeCloseTo(16 + 236 / 2, -1);
      },
      { timeout: 3000 },
    );
  });

  it('does not open permanent drawers on wide layouts', async () => {
    mockResponsiveLayout.isWide = true;
    const dispatch = jest.fn();
    registerGuideDrawer('story-selection', {
      navigation: { dispatch } as never,
      scrollTo: jest.fn(),
      getScrollOffset: () => 0,
      measureScrollWindowY: async () => 0,
    });
    registerGuideAnchor('item', async () => ({ x: 0, y: 400, width: 200, height: 40 }));
    useGuideStore.getState().startTour({
      id: 'TourScreen',
      drawerId: 'story-selection',
      steps: [
        { id: 's1', drawerId: 'story-selection', anchors: ['item'], titleKey: 't', bodyKey: 'b' },
      ],
    });
    const screen = await render(<GuideHost />);

    expect(await screen.findByTestId('guide-spotlight', {}, { timeout: 4000 })).toBeTruthy();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('hides the help link without a page or a drawer', async () => {
    useGuideStore.getState().startTour(twoStepGuide);
    const screen = await render(<GuideHost />);

    expect(screen.queryByTestId('guide-help')).toBeNull();
  });

  it('opens the help page and counts the tour as skipped', async () => {
    const navigate = jest.fn();
    registerGuideDrawer('story-selection', {
      navigation: {
        navigate,
        getState: () => ({ routes: [{ name: 'StorySelectionMain' }], index: 0 }),
      } as never,
      scrollTo: jest.fn(),
      getScrollOffset: () => 0,
      measureScrollWindowY: async () => 0,
    });
    useGuideStore.getState().startTour({ ...twoStepGuide, helpPageId: 'story-list' });
    const screen = await render(<GuideHost />);

    await fireEvent.press(screen.getByTestId('guide-help'));

    expect(navigate).toHaveBeenCalledWith('HelpDrawer', {
      screen: 'HelpPage',
      params: { pageId: 'story-list', returnDrawerRoute: 'StorySelectionMain' },
    });
    expect(screen.queryByTestId('guide-card')).toBeNull();
    expect(mockRecordSeen).toHaveBeenCalledWith('TourScreen');
  });
});

describe('the tour card and the navigation bar', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- the context under test.
  const { SafeAreaInsetsContext } = require('react-native-safe-area-context');
  const { StyleSheet } = require('react-native');

  it('leaves room under its last row (the help link) for the system bar', async () => {
    useGuideStore.getState().startTour(twoStepGuide);
    const screen = await render(
      <SafeAreaInsetsContext.Provider value={{ top: 0, right: 0, bottom: 34, left: 0 }}>
        <GuideHost />
      </SafeAreaInsetsContext.Provider>,
    );

    const wrap = StyleSheet.flatten(screen.getByTestId('guide-card-wrap').props.style);
    expect(wrap.top).toBe(1334 - 34 - 20 - 230);
  });

  it('puts the card against its target, over it when the bottom is too tight, with an arrow toward it', async () => {
    registerGuideAnchor('low', async () => ({ x: 0, y: 1180, width: 300, height: 60 }));
    registerGuideAnchor('high', async () => ({ x: 0, y: 100, width: 300, height: 60 }));
    useGuideStore.getState().startTour({
      id: 'TourScreen',
      drawerId: 'story-selection',
      steps: [
        { id: 's1', anchors: ['high'], titleKey: 't1', bodyKey: 'b1' },
        { id: 's2', anchors: ['low'], titleKey: 't2', bodyKey: 'b2' },
      ],
    });
    const screen = await render(<GuideHost />);
    await screen.findByTestId('guide-spotlight', {}, { timeout: 4000 });
    const placed = () => StyleSheet.flatten(screen.getByTestId('guide-card-wrap').props.style).top;
    expect(placed()).toBe(100 - 8 + 60 + 16 + 14 - 0);

    await fireEvent.press(screen.getByTestId('guide-next'));
    await waitFor(() => expect(placed()).toBe(1180 - 8 - 14 - 230));
  });

  it('says where the person is in the tour', async () => {
    useGuideStore.getState().startTour(twoStepGuide);
    const screen = await render(<GuideHost />);

    expect(screen.getByText('guide_progress')).toBeTruthy();
    expect(screen.getByTestId('guide-progress').children).toHaveLength(2);
  });

  it('has no progress to show in a tour of one step', async () => {
    useGuideStore.getState().startTour({
      id: 'Single',
      drawerId: 'story-selection',
      steps: [{ id: 's1', titleKey: 't', bodyKey: 'b' }],
    });
    const screen = await render(<GuideHost />);

    expect(screen.queryByTestId('guide-progress')).toBeNull();
  });

  it('keeps its plain margin where no bar overlaps the window', async () => {
    useGuideStore.getState().startTour(twoStepGuide);
    const screen = await render(<GuideHost />);

    const wrap = StyleSheet.flatten(screen.getByTestId('guide-card-wrap').props.style);
    expect(wrap.top).toBe(1334 - 20 - 230);
  });
});
