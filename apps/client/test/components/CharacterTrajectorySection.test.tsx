import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import CharacterTrajectorySection from '../../src/components/features/trajectories/CharacterTrajectorySection';

const mockTrajectoryData = jest.fn();
jest.mock('../../src/hooks/useCharacterTrajectoryData', () => ({
  useCharacterTrajectoryData: (...args: unknown[]) => mockTrajectoryData(...args),
}));
jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      primary: '#85f',
      primaryContainer: '#223',
      text: '#fff',
      textSecondary: '#aaa',
      border: '#444',
    },
  }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count === undefined ? key : `${key}:${options.count}`,
  }),
}));
// The card itself animates; what matters here is the title it gets, and that it starts closed.
const mockCard = jest.fn();
jest.mock('../../src/components/common/display/CollapsibleCard/CollapsibleCard', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- mock factories cannot use imports.
  const ReactActual = require('react');
  const { View, Text } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ title, initialExpanded, children }: any) => {
      mockCard({ title, initialExpanded });
      return ReactActual.createElement(
        View,
        { testID: 'collapsible-card' },
        ReactActual.createElement(Text, null, title),
        children,
      );
    },
  };
});
jest.mock('../../src/components/common/inputs/MultiSelectPill/MultiSelectPill', () => {
  const { Text, TouchableOpacity } = jest.requireActual('react-native');
  const ReactActual = jest.requireActual('react');
  return {
    __esModule: true,
    SingleSelectPill: ({ options, value, onValueChange }: any) =>
      ReactActual.createElement(
        ReactActual.Fragment,
        null,
        options.map((option: any) =>
          ReactActual.createElement(
            TouchableOpacity,
            {
              key: option.value,
              testID: `route-${option.value}`,
              onPress: () => onValueChange(option.value),
            },
            ReactActual.createElement(
              Text,
              null,
              `${option.label}:${option.value === value ? 'on' : 'off'}`,
            ),
          ),
        ),
      ),
  };
});
const mockNavigate = jest.fn();
jest.mock('../../src/hooks/useNavigateToEntityDetail', () => ({
  useNavigateToEntityDetail: () => mockNavigate,
}));

const SCENES = [
  {
    id: 's-1',
    chapterId: 'ch-1',
    index: 1,
    locationId: 'loc-a',
    isDeleted: false,
    name: 'Arrival',
  },
  { id: 's-2', chapterId: 'ch-1', index: 2, locationId: 'loc-b', isDeleted: false, name: 'Flight' },
];
const APPEARANCES = [
  { characterId: 'char-1', sceneId: 's-1', isDeleted: false },
  { characterId: 'char-1', sceneId: 's-2', isDeleted: false },
];
const LOCATIONS = [
  { id: 'loc-a', name: 'Harbor' },
  { id: 'loc-b', name: 'Keep' },
];

const CHAPTERS = [{ id: 'ch-1', index: 1 }];
const ROUTES = [{ id: 'route-1', name: 'Main', isDeleted: false }];
const STEPS_BY_ROUTE = {
  'route-1': [
    { sceneId: 's-2', position: 1, isDeleted: false },
    { sceneId: 's-1', position: 2, isDeleted: false },
  ],
};

describe('CharacterTrajectorySection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTrajectoryData.mockReturnValue({ chapters: CHAPTERS, routes: [], stepsByRoute: {} });
  });

  it('lists linear stops in narrative order', async () => {
    const view = await render(
      <CharacterTrajectorySection
        characterId="char-1"
        storyId="story-1"
        storyType="linear"
        scenes={SCENES}
        appearances={APPEARANCES}
        locations={LOCATIONS}
      />,
    );
    expect(mockTrajectoryData).toHaveBeenCalledWith('story-1', 'linear');
    await waitFor(() => expect(view.getByText('Harbor')).toBeTruthy());
    expect(view.getByText('Arrival')).toBeTruthy();
    expect(view.getByText('Keep')).toBeTruthy();

    await act(async () => {
      await fireEvent.press(view.getByLabelText('Keep'));
    });
    expect(mockNavigate).toHaveBeenCalledWith('Location', 'loc-b');
  });

  it('sits in a collapsed card like the other sections, titled with how many stops it has', async () => {
    const view = await render(
      <CharacterTrajectorySection
        characterId="char-1"
        storyId="story-1"
        storyType="linear"
        scenes={SCENES}
        appearances={APPEARANCES}
        locations={LOCATIONS}
      />,
    );

    await waitFor(() => expect(view.getByText('trajectory_section_title:2')).toBeTruthy());
    expect(mockCard).toHaveBeenLastCalledWith({
      title: 'trajectory_section_title:2',
      initialExpanded: false,
    });
  });

  it('orders branching stops by the picked route', async () => {
    mockTrajectoryData.mockReturnValue({
      chapters: CHAPTERS,
      routes: ROUTES,
      stepsByRoute: STEPS_BY_ROUTE,
    });
    const view = await render(
      <CharacterTrajectorySection
        characterId="char-1"
        storyId="story-1"
        storyType="branching"
        scenes={SCENES}
        appearances={APPEARANCES}
        locations={LOCATIONS}
      />,
    );
    // The route walks s-2 before s-1, against chapter order; the first route is picked.
    await waitFor(() => expect(view.getByText('Keep')).toBeTruthy());
    const keepRow = view.getByLabelText('Keep') as any;
    const keepBadge = keepRow.children[0].children[0];
    expect(keepBadge.props.children).toBe(1);
    expect(view.getByTestId('route-route-1')).toBeTruthy();
  });

  it('explains empty states', async () => {
    const view = await render(
      <CharacterTrajectorySection
        characterId="char-9"
        storyId="story-1"
        storyType="linear"
        scenes={SCENES}
        appearances={APPEARANCES}
        locations={LOCATIONS}
      />,
    );
    await waitFor(() => expect(view.getByText('trajectory_empty')).toBeTruthy());
  });
});
