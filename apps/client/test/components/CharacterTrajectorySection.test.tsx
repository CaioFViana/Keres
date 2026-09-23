import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import CharacterTrajectorySection from '../../src/components/features/trajectories/CharacterTrajectorySection';

const mockDb = {};
jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: () => mockDb }));
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
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('../../src/services/storymanagement/ChapterService', () => ({
  createChapterService: () => ({ getAllByStoryId: async () => [{ id: 'ch-1', index: 1 }] }),
}));
const mockGetRoutes = jest.fn(async () => [{ id: 'route-1', name: 'Main', isDeleted: false }]);
const mockGetSteps = jest.fn(async () => [
  { sceneId: 's-2', position: 1, isDeleted: false },
  { sceneId: 's-1', position: 2, isDeleted: false },
]);
jest.mock('../../src/services/storymanagement/RouteService', () => ({
  createRouteService: () => ({ getAllByStoryId: mockGetRoutes, getSteps: mockGetSteps }),
}));
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
  { id: 's-1', chapterId: 'ch-1', index: 1, locationId: 'loc-a', isDeleted: false, name: 'Arrival' },
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

describe('CharacterTrajectorySection', () => {
  beforeEach(() => jest.clearAllMocks());

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
    await waitFor(() => expect(view.getByText('Harbor')).toBeTruthy());
    expect(view.getByText('Arrival')).toBeTruthy();
    expect(view.getByText('Keep')).toBeTruthy();
    expect(mockGetRoutes).not.toHaveBeenCalled();

    await act(async () => {
      await fireEvent.press(view.getByLabelText('Keep'));
    });
    expect(mockNavigate).toHaveBeenCalledWith('Location', 'loc-b');
  });

  it('orders branching stops by the picked route', async () => {
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
