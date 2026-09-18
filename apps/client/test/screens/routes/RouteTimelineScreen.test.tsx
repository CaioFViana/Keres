import { cleanup, fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import RouteTimelineScreen from '../../../src/screens/routes/RouteTimelineScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockOpenEntity = jest.fn();
let mockRouteParams: any = { routeId: 'route-1' };
let mockChronology: any = null;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

jest.mock('../../../src/theme', () => ({
  useTheme: () => ({
    isDarkMode: false,
    colors: {
      background: '#fff',
      surface: '#fff',
      card: '#fff',
      text: '#111',
      textSecondary: '#555',
      border: '#ddd',
      primary: '#00f',
      primaryContainer: '#ddf',
      onPrimaryContainer: '#001',
      secondary: '#0a0',
      accent: '#a0a',
      error: '#f00',
    },
  }),
}));

jest.mock('../../../src/components/features/story-timeline/StoryTimelineCanvas', () => {
  const { Text } = require('react-native');
  const React = require('react');
  return {
    __esModule: true,
    default: React.forwardRef(({ layout, onPressScene }: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({
        zoomBy: jest.fn(),
        fitToScreen: jest.fn(),
      }));
      return (
        <>
          <Text testID="timeline-rows">{`rows:${layout.rows.length}`}</Text>
          <Text testID="timeline-scene" onPress={() => onPressScene('step-1')}>
            scene
          </Text>
        </>
      );
    }),
  };
});

jest.mock('../../../src/components/features/graphs/GraphNodeSheet/GraphNodeSheet', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ title, subtitle, badges, actionLabel, onAction, onClose }: any) => (
      <>
        <Text testID="sheet-title">{title}</Text>
        <Text testID="sheet-subtitle">{subtitle.text}</Text>
        <Text testID="sheet-badges">{`badges:${badges.length}`}</Text>
        <Text testID="sheet-action" onPress={onAction}>
          {actionLabel}
        </Text>
        <Text testID="sheet-close" onPress={onClose}>
          close
        </Text>
      </>
    ),
  };
});

jest.mock('../../../src/hooks/useRouteChronology', () => ({
  useRouteChronology: () => mockChronology,
}));

jest.mock('../../../src/hooks/useStoryCalendar', () => ({
  useStoryCalendar: () => ({ definition: null }),
}));

jest.mock('../../../src/hooks/useNavigateToEntityDetail', () => ({
  useNavigateToEntityDetail: () => mockOpenEntity,
}));

jest.mock('../../../src/utils/sceneTiming', () => ({
  formatSceneGap: () => 'gap',
  formatSceneUniverseDuration: () => 'dur',
}));

jest.mock('../../../src/hooks/useScreenHeader', () => ({ useScreenHeader: jest.fn() }));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({ useBackButtonHandler: jest.fn() }));
jest.mock('../../../src/hooks/useFormScrollBottomPadding', () => ({
  useFormScrollBottomPadding: () => 32,
}));

function chronology(overrides: any = {}) {
  const steps = [{ id: 'step-1', sceneId: 'scene-1', position: 1 }];
  return {
    route: { id: 'route-1', name: 'North Path' },
    story: { timelineEpochDay: null },
    steps,
    validation: [],
    layout: { rows: [{ id: 'row-1' }] },
    dateForRow: () => null,
    sceneForStep: (id: string) => (id === 'step-1' ? { id: 'scene-1', name: 'Gate' } : undefined),
    loading: false,
    ...overrides,
  };
}

describe('RouteTimelineScreen', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  beforeEach(() => {
    mockRouteParams = { routeId: 'route-1' };
    mockChronology = chronology();
  });

  it('shows loading state', async () => {
    mockChronology = chronology({ loading: true });
    const view = await render(<RouteTimelineScreen />);
    expect(view.getByText('loading_routes')).toBeTruthy();
  });

  it('shows not found without the route', async () => {
    mockChronology = chronology({ route: undefined });
    const view = await render(<RouteTimelineScreen />);
    expect(view.getByText('route_not_found')).toBeTruthy();
  });

  it('refuses invalid routes', async () => {
    mockChronology = chronology({ validation: ['broken'] });
    const view = await render(<RouteTimelineScreen />);
    expect(view.getByText('route_cannot_read_invalid')).toBeTruthy();
  });

  it('renders the timeline with scale modes', async () => {
    const view = await render(<RouteTimelineScreen />);
    expect(view.getByText('route_timeline_scope')).toBeTruthy();
    expect(view.getByText('route_timeline_relative')).toBeTruthy();
    expect(view.getByTestId('timeline-rows').props.children).toBe('rows:1');
    await fireEvent.press(view.getByText('story_timeline_scale_proportional'));
    expect(view.getByText('story_timeline_scale_compact')).toBeTruthy();
  });

  it('shows the empty state without rows', async () => {
    mockChronology = chronology({ layout: { rows: [] } });
    const view = await render(<RouteTimelineScreen />);
    expect(view.getByText('no_route_steps')).toBeTruthy();
  });

  it('opens a step sheet and navigates to the scene', async () => {
    const view = await render(<RouteTimelineScreen />);
    await fireEvent.press(view.getByTestId('timeline-scene'));
    expect(view.getByTestId('sheet-title').props.children).toBe('Gate');
    expect(view.getByTestId('sheet-badges').props.children).toBe('badges:2');
    await fireEvent.press(view.getByTestId('sheet-action'));
    expect(mockOpenEntity).toHaveBeenCalledWith(
      'Scene',
      'scene-1',
      expect.objectContaining({ onReturn: expect.any(Function) }),
    );
  });

  it('closes the step sheet', async () => {
    const view = await render(<RouteTimelineScreen />);
    await fireEvent.press(view.getByTestId('timeline-scene'));
    await fireEvent.press(view.getByTestId('sheet-close'));
    expect(view.queryByTestId('sheet-title')).toBeNull();
  });

  it('drives zoom controls', async () => {
    const view = await render(<RouteTimelineScreen />);
    await fireEvent.press(view.getByLabelText('zoom_in'));
    await fireEvent.press(view.getByLabelText('zoom_out'));
    await fireEvent.press(view.getByLabelText('fit_to_screen'));
    expect(view.getByTestId('timeline-rows')).toBeTruthy();
  });
});
