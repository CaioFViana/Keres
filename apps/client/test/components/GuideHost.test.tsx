import { fireEvent, render } from '@testing-library/react-native';
import { DrawerActions } from '@react-navigation/native';
import React from 'react';
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

    // The card never waits for the measurement.
    expect(screen.getByTestId('guide-card')).toBeTruthy();
    expect(await screen.findByTestId('guide-spotlight')).toBeTruthy();
  });

  it('stays card-only when anchors cannot be measured', async () => {
    registerGuideAnchor('target', async () => null);
    useGuideStore.getState().startTour({
      id: 'TourScreen',
      drawerId: 'story-selection',
      steps: [{ id: 's1', anchors: ['target', 'missing'], titleKey: 't', bodyKey: 'b' }],
    });
    const screen = await render(<GuideHost />);

    expect(screen.getByTestId('guide-card')).toBeTruthy();
    expect(screen.queryByTestId('guide-spotlight')).toBeNull();
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
    registerGuideAnchor('item', async () => ({ x: 0, y: 400, width: 200, height: 40 }));
    useGuideStore.getState().startTour({
      id: 'TourScreen',
      drawerId: 'story-selection',
      steps: [
        { id: 's1', drawerId: 'story-selection', anchors: ['item'], titleKey: 't', bodyKey: 'b' },
      ],
    });
    const screen = await render(<GuideHost />);

    expect(await screen.findByTestId('guide-spotlight')).toBeTruthy();
    expect(dispatch).toHaveBeenCalledWith(DrawerActions.openDrawer());
    expect(scrollTo).toHaveBeenCalledWith(400 - 96);
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

    expect(await screen.findByTestId('guide-spotlight')).toBeTruthy();
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
