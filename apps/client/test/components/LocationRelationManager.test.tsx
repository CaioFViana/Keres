import { act, fireEvent, render } from '@testing-library/react-native';
import LocationRelationManager from '../../src/components/features/relations/LocationRelationManager/LocationRelationManager';
import type { LocationRelationSelect, LocationSelect } from '../../src/db/schema';

jest.mock('../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      card: '#fff',
      error: '#f00',
      onPrimary: '#fff',
      primary: '#00f',
      surface: '#eee',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));

jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@expo/vector-icons', () => {
  const ReactActual = require('react');
  const { Text } = jest.requireActual('react-native');
  return {
    Ionicons: ({ name, onPress }: { name: string; onPress?: () => void }) =>
      ReactActual.createElement(Text, { testID: `icon-${name}`, onPress }, name),
  };
});

const mockNavigate = jest.fn();
jest.mock('../../src/hooks/useNavigateToEntityDetail', () => ({
  __esModule: true,
  useNavigateToEntityDetail: () => mockNavigate,
}));

const mockAlert = jest.fn();
jest.mock('../../src/utils/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));

const mockPickerProps = { current: null as Record<string, any> | null };
jest.mock(
  '../../src/components/features/relations/LocationRelationManager/LocationPickerModal',
  () => {
    const ReactActual = require('react');
    const { View } = jest.requireActual('react-native');
    return {
      __esModule: true,
      default: (props: Record<string, unknown>) => {
        mockPickerProps.current = props as Record<string, any>;
        return ReactActual.createElement(View, { testID: 'location-picker' });
      },
    };
  },
);

const location = (overrides: Partial<LocationSelect> = {}): LocationSelect =>
  ({
    id: 'loc-current',
    storyId: 'story-1',
    name: 'Current',
    ...overrides,
  }) as LocationSelect;

const relation = (overrides: Partial<LocationRelationSelect> = {}): LocationRelationSelect =>
  ({
    id: 'rel-1',
    storyId: 'story-1',
    relationType: 'contains',
    locationAId: 'loc-parent',
    locationBId: 'loc-current',
    isDeleted: false,
    ...overrides,
  }) as LocationRelationSelect;

const locations = () => [
  location({ id: 'loc-parent', name: 'Parent' }),
  location(),
  location({ id: 'loc-child', name: 'Child' }),
  location({ id: 'loc-friend', name: 'Friend' }),
  location({ id: 'loc-other', name: 'Other' }),
];

const relations = () => [
  relation({ id: 'r-parent', locationAId: 'loc-parent', locationBId: 'loc-current' }),
  relation({ id: 'r-child', locationAId: 'loc-current', locationBId: 'loc-child' }),
  relation({
    id: 'r-conn',
    relationType: 'connected_to',
    locationAId: 'loc-current',
    locationBId: 'loc-friend',
  }),
];

const baseProps = () => ({
  currentLocationId: 'loc-current',
  allLocations: locations(),
  allLocationRelations: relations(),
  onSetParent: jest.fn(),
  onAddChild: jest.fn(),
  onAddConnection: jest.fn(),
  onRemoveRelation: jest.fn(),
  editable: true,
});

const candidateIds = () =>
  (mockPickerProps.current?.candidates as LocationSelect[]).map((candidate) => candidate.id);

beforeEach(() => {
  jest.clearAllMocks();
  mockPickerProps.current = null;
});

describe('LocationRelationManager', () => {
  it('shows the parent with a way to change it', async () => {
    const screen = await render(<LocationRelationManager {...baseProps()} />);

    expect(screen.getByText('location_structure_title')).toBeTruthy();
    expect(screen.getByText('Parent')).toBeTruthy();
    expect(screen.getByText('change_parent')).toBeTruthy();
    expect(screen.getByText('Child')).toBeTruthy();
    expect(screen.getByText('Friend')).toBeTruthy();
  });

  it('offers to set a parent when there is none', async () => {
    const screen = await render(
      <LocationRelationManager
        {...baseProps()}
        allLocationRelations={relations().filter((rel) => rel.id !== 'r-parent')}
      />,
    );

    expect(screen.getByText('no_parent_location')).toBeTruthy();
    expect(screen.getByText('set_parent')).toBeTruthy();
  });

  it('shows the empty states for children and connections', async () => {
    const screen = await render(
      <LocationRelationManager
        {...baseProps()}
        allLocationRelations={relations().filter((rel) => rel.id === 'r-parent')}
      />,
    );

    expect(screen.getByText('no_child_locations')).toBeTruthy();
    expect(screen.getByText('no_connected_locations')).toBeTruthy();
  });

  it('ignores deleted relations', async () => {
    const screen = await render(
      <LocationRelationManager
        {...baseProps()}
        allLocationRelations={relations().map((rel) => ({ ...rel, isDeleted: true }))}
      />,
    );

    expect(screen.getByText('no_parent_location')).toBeTruthy();
    expect(screen.getByText('no_child_locations')).toBeTruthy();
    expect(screen.getByText('no_connected_locations')).toBeTruthy();
  });

  it('excludes itself, its parent and its descendants from the parent picker', async () => {
    const screen = await render(<LocationRelationManager {...baseProps()} />);
    // The section starts collapsed, which disables its controls; expand it first.
    await fireEvent.press(screen.getByText('location_structure_title'));
    await fireEvent.press(screen.getByText('change_parent').parent!);

    expect(mockPickerProps.current?.isVisible).toBe(true);
    expect(mockPickerProps.current?.title).toBe('select_parent_location');
    expect(candidateIds()).toEqual(['loc-friend', 'loc-other']);
  });

  it('keeps grandchildren out of the parent picker too', async () => {
    const props = baseProps();
    props.allLocations.push(location({ id: 'loc-grand', name: 'Grand' }));
    props.allLocationRelations.push(
      relation({ id: 'r-grand', locationAId: 'loc-child', locationBId: 'loc-grand' }),
    );
    const screen = await render(<LocationRelationManager {...props} />);
    // The section starts collapsed, which disables its controls; expand it first.
    await fireEvent.press(screen.getByText('location_structure_title'));
    await fireEvent.press(screen.getByText('change_parent').parent!);

    expect(candidateIds()).toEqual(['loc-friend', 'loc-other']);
  });

  it('sets the parent chosen in the picker', async () => {
    const props = baseProps();
    const screen = await render(<LocationRelationManager {...props} />);
    // The section starts collapsed, which disables its controls; expand it first.
    await fireEvent.press(screen.getByText('location_structure_title'));
    await fireEvent.press(screen.getByText('change_parent').parent!);

    await act(async () => {
      mockPickerProps.current?.onSelect('loc-other');
    });

    expect(props.onSetParent).toHaveBeenCalledWith('loc-other');
    expect(mockPickerProps.current?.isVisible).toBe(false);
  });

  it('removes the parent only after the confirmation', async () => {
    const props = baseProps();
    const screen = await render(<LocationRelationManager {...props} />);
    // The section starts collapsed, which disables its controls; expand it first.
    await fireEvent.press(screen.getByText('location_structure_title'));

    await fireEvent.press(screen.getAllByTestId('icon-trash-outline')[0]);
    expect(mockAlert).toHaveBeenCalledWith(
      'remove_parent_location_title',
      'remove_parent_location_message',
      expect.any(Array),
    );

    await act(async () => {
      mockAlert.mock.calls[0][2][1].onPress();
    });
    expect(props.onSetParent).toHaveBeenCalledWith(null);
  });

  it('excludes itself, its ancestors and its children from the child picker', async () => {
    const screen = await render(<LocationRelationManager {...baseProps()} />);
    // The section starts collapsed, which disables its controls; expand it first.
    await fireEvent.press(screen.getByText('location_structure_title'));
    await fireEvent.press(screen.getByText('add_child_location').parent!);

    expect(mockPickerProps.current?.title).toBe('select_child_location');
    expect(candidateIds()).toEqual(['loc-friend', 'loc-other']);
  });

  it('adds the child chosen in the picker', async () => {
    const props = baseProps();
    const screen = await render(<LocationRelationManager {...props} />);
    // The section starts collapsed, which disables its controls; expand it first.
    await fireEvent.press(screen.getByText('location_structure_title'));
    await fireEvent.press(screen.getByText('add_child_location').parent!);

    await act(async () => {
      mockPickerProps.current?.onSelect('loc-other');
    });

    expect(props.onAddChild).toHaveBeenCalledWith('loc-other');
  });

  it('removes a child only after the confirmation', async () => {
    const props = baseProps();
    const screen = await render(<LocationRelationManager {...props} />);
    // The section starts collapsed, which disables its controls; expand it first.
    await fireEvent.press(screen.getByText('location_structure_title'));

    await fireEvent.press(screen.getAllByTestId('icon-trash-outline')[1]);
    expect(mockAlert).toHaveBeenCalledWith(
      'remove_child_location_title',
      'remove_child_location_message',
      expect.any(Array),
    );

    await act(async () => {
      mockAlert.mock.calls[0][2][1].onPress();
    });
    expect(props.onRemoveRelation).toHaveBeenCalledWith('r-child');
  });

  it('excludes itself and its connections from the connection picker', async () => {
    const screen = await render(<LocationRelationManager {...baseProps()} />);
    // The section starts collapsed, which disables its controls; expand it first.
    await fireEvent.press(screen.getByText('location_structure_title'));
    await fireEvent.press(screen.getByText('add_connection').parent!);

    expect(mockPickerProps.current?.title).toBe('select_location_to_connect');
    expect(candidateIds()).toEqual(['loc-parent', 'loc-child', 'loc-other']);
  });

  it('adds the connection chosen in the picker', async () => {
    const props = baseProps();
    const screen = await render(<LocationRelationManager {...props} />);
    // The section starts collapsed, which disables its controls; expand it first.
    await fireEvent.press(screen.getByText('location_structure_title'));
    await fireEvent.press(screen.getByText('add_connection').parent!);

    await act(async () => {
      mockPickerProps.current?.onSelect('loc-other');
    });

    expect(props.onAddConnection).toHaveBeenCalledWith('loc-other');
  });

  it('removes a connection only after the confirmation', async () => {
    const props = baseProps();
    const screen = await render(<LocationRelationManager {...props} />);
    // The section starts collapsed, which disables its controls; expand it first.
    await fireEvent.press(screen.getByText('location_structure_title'));

    await fireEvent.press(screen.getAllByTestId('icon-trash-outline')[2]);
    expect(mockAlert).toHaveBeenCalledWith(
      'remove_connection_title',
      'remove_connection_message',
      expect.any(Array),
    );

    await act(async () => {
      mockAlert.mock.calls[0][2][1].onPress();
    });
    expect(props.onRemoveRelation).toHaveBeenCalledWith('r-conn');
  });

  it('navigates to relatives when read-only, without touching anything', async () => {
    const screen = await render(<LocationRelationManager {...baseProps()} editable={false} />);

    expect(screen.queryByText('change_parent')).toBeNull();
    expect(screen.queryByTestId('icon-trash-outline')).toBeNull();

    // The section starts collapsed, which disables its rows; expand it first like a reader would.
    await fireEvent.press(screen.getByText('location_structure_title'));
    await fireEvent.press(screen.getByText('Parent').parent!.parent!);

    expect(mockNavigate).toHaveBeenCalledWith('Location', 'loc-parent');
  });

  it('names unknown locations instead of crashing', async () => {
    const screen = await render(
      <LocationRelationManager
        {...baseProps()}
        allLocations={[location()]}
        allLocationRelations={[relation({ locationAId: 'loc-gone', locationBId: 'loc-current' })]}
      />,
    );

    expect(screen.getByText('unknown_location')).toBeTruthy();
  });
});
