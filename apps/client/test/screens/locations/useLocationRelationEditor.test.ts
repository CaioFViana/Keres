/**
 * @jest-environment node
 */
const mockSetParent = jest.fn();
const mockAddConnection = jest.fn();
const mockRemoveRelation = jest.fn();
const mockAlert = jest.fn();

jest.mock('../../../src/services/storymanagement/LocationRelationService', () => ({
  __esModule: true,
  createLocationRelationService: () => ({
    setParent: (...args: unknown[]) => mockSetParent(...args),
    addConnection: (...args: unknown[]) => mockAddConnection(...args),
    removeRelation: (...args: unknown[]) => mockRemoveRelation(...args),
  }),
}));
jest.mock('../../../src/utils/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { act, renderHook } from '@testing-library/react-native';
import type { LocationRelationSelect, LocationSelect } from '../../../src/db/schema';
import { useLocationRelationEditor } from '../../../src/screens/locations/useLocationRelationEditor';

const place = (id: string) => ({ id, name: `Place ${id}` }) as LocationSelect;
const relation = (
  id: string,
  a: string,
  b: string,
  relationType: 'contains' | 'connected_to',
): LocationRelationSelect => ({ id, locationAId: a, locationBId: b, relationType }) as never;

// world > region > city, harbour connected to city, and a lone hermitage.
const LOCATIONS = ['world', 'region', 'city', 'harbour', 'hermitage'].map(place);
const RELATIONS = [
  relation('r1', 'world', 'region', 'contains'),
  relation('r2', 'region', 'city', 'contains'),
  relation('r3', 'city', 'harbour', 'connected_to'),
];

async function setup(overrides: { userId?: string | null; storyId?: string } = {}) {
  const reload = jest.fn().mockResolvedValue(undefined);
  const view = await renderHook(() =>
    useLocationRelationEditor({
      db: {} as never,
      storyId: 'storyId' in overrides ? overrides.storyId : 'story-1',
      userId: 'userId' in overrides ? overrides.userId : 'user-1',
      locations: LOCATIONS,
      relations: RELATIONS,
      reload,
    }),
  );
  return { reload, ...view };
}

const idsOf = (candidates: LocationSelect[]) => candidates.map((c) => c.id).sort();

beforeEach(() => {
  jest.clearAllMocks();
  mockSetParent.mockResolvedValue(undefined);
  mockAddConnection.mockResolvedValue(undefined);
  mockRemoveRelation.mockResolvedValue(true);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('the candidates of each kind of change', () => {
  it('has none while the picker is closed', async () => {
    const { result } = await setup();

    expect(result.current.picking).toBeNull();
    expect(result.current.candidates).toEqual([]);
    expect(result.current.pickerTitle).toBe('');
  });

  it('for a parent, leaves out the place itself, what it holds and the parent it already has', async () => {
    const { result } = await setup();

    await act(async () => result.current.open('parent', 'region'));

    // 'world' is already its parent, 'city' is inside it, 'region' is itself.
    expect(idsOf(result.current.candidates)).toEqual(['harbour', 'hermitage']);
    expect(result.current.pickerTitle).toBe('select_parent_location');
  });

  it('for a child, leaves out the place itself, what holds it and the children it already has', async () => {
    const { result } = await setup();

    await act(async () => result.current.open('child', 'region'));

    // 'world' holds it, 'city' is already a child.
    expect(idsOf(result.current.candidates)).toEqual(['harbour', 'hermitage']);
    expect(result.current.pickerTitle).toBe('select_child_location');
  });

  it('never offers a place that would close a loop', async () => {
    const { result } = await setup();

    await act(async () => result.current.open('parent', 'world'));
    // Region and city are inside the world, so it cannot sit inside them; the harbour is only
    // connected to the city, not held by it, so it is a fair parent.
    expect(idsOf(result.current.candidates)).toEqual(['harbour', 'hermitage']);

    await act(async () => result.current.open('child', 'city'));
    // Its ancestors cannot become its children.
    expect(idsOf(result.current.candidates)).toEqual(['harbour', 'hermitage']);
  });

  it('for a connection, leaves out the place itself and what it is already connected to', async () => {
    const { result } = await setup();

    await act(async () => result.current.open('connection', 'city'));

    expect(idsOf(result.current.candidates)).toEqual(['hermitage', 'region', 'world']);
    expect(result.current.pickerTitle).toBe('select_location_to_connect');
  });

  it('closes', async () => {
    const { result } = await setup();
    await act(async () => result.current.open('parent', 'city'));

    await act(async () => result.current.close());

    expect(result.current.picking).toBeNull();
  });
});

describe('picking a place', () => {
  it('sets the parent of the place in focus', async () => {
    const { result, reload } = await setup();
    await act(async () => result.current.open('parent', 'harbour'));

    await act(async () => result.current.pick('city'));

    expect(mockSetParent).toHaveBeenCalledWith('user-1', 'story-1', 'harbour', 'city');
    expect(reload).toHaveBeenCalledTimes(1);
    expect(result.current.picking).toBeNull();
  });

  it('puts the picked place inside the one in focus when adding a child', async () => {
    const { result } = await setup();
    await act(async () => result.current.open('child', 'region'));

    await act(async () => result.current.pick('hermitage'));

    expect(mockSetParent).toHaveBeenCalledWith('user-1', 'story-1', 'hermitage', 'region');
  });

  it('connects the two places', async () => {
    const { result } = await setup();
    await act(async () => result.current.open('connection', 'city'));

    await act(async () => result.current.pick('hermitage'));

    expect(mockAddConnection).toHaveBeenCalledWith('user-1', 'story-1', 'city', 'hermitage');
  });

  it('tells the author when the change cannot be written, and does not reload', async () => {
    mockSetParent.mockRejectedValueOnce(new Error('cycle'));
    const { result, reload } = await setup();
    await act(async () => result.current.open('parent', 'harbour'));

    await act(async () => result.current.pick('city'));

    expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_save_relation');
    expect(reload).not.toHaveBeenCalled();
  });

  it.each([
    ['no user', { userId: null }],
    ['no story', { storyId: undefined }],
  ])('writes nothing and says so with %s', async (_label, options) => {
    const { result } = await setup(options);
    await act(async () => result.current.open('parent', 'harbour'));

    await act(async () => result.current.pick('city'));

    expect(mockSetParent).not.toHaveBeenCalled();
    expect(mockAlert).toHaveBeenCalledWith('error', 'service_not_initialized');
  });

  it('does nothing when nothing is being picked', async () => {
    const { result } = await setup();

    await act(async () => result.current.pick('city'));

    expect(mockSetParent).not.toHaveBeenCalled();
    expect(mockAddConnection).not.toHaveBeenCalled();
  });
});

describe('taking a relation away', () => {
  const confirmButtons = () =>
    mockAlert.mock.calls[0][2] as { text: string; style?: string; onPress?: () => void }[];

  it('asks first, with the words of that relation, and writes nothing until agreed', async () => {
    const { result } = await setup();

    await act(async () => result.current.removeParent('region'));

    expect(mockAlert).toHaveBeenCalledWith(
      'remove_parent_location_title',
      'remove_parent_location_message',
      expect.any(Array),
    );
    expect(mockSetParent).not.toHaveBeenCalled();
    expect(confirmButtons().find((b) => b.text === 'cancel')?.style).toBe('cancel');
  });

  it('removes a parent by setting none, once confirmed', async () => {
    const { result, reload } = await setup();
    await act(async () => result.current.removeParent('region'));

    await act(async () => confirmButtons().find((b) => b.text === 'remove')!.onPress!());

    expect(mockSetParent).toHaveBeenCalledWith('user-1', 'story-1', 'region', null);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('removes a child by setting none on it, once confirmed', async () => {
    const { result } = await setup();
    await act(async () => result.current.removeChild('city'));
    expect(mockAlert).toHaveBeenCalledWith(
      'remove_child_location_title',
      'remove_child_location_message',
      expect.any(Array),
    );

    await act(async () => confirmButtons().find((b) => b.text === 'remove')!.onPress!());

    expect(mockSetParent).toHaveBeenCalledWith('user-1', 'story-1', 'city', null);
  });

  it('removes a connection by its relation, once confirmed', async () => {
    const { result } = await setup();
    await act(async () => result.current.removeConnection('r3'));
    expect(mockAlert).toHaveBeenCalledWith(
      'remove_connection_title',
      'remove_connection_message',
      expect.any(Array),
    );

    await act(async () => confirmButtons().find((b) => b.text === 'remove')!.onPress!());

    expect(mockRemoveRelation).toHaveBeenCalledWith('user-1', 'r3');
  });

  it('says so when removing fails', async () => {
    mockRemoveRelation.mockRejectedValueOnce(new Error('db down'));
    const { result, reload } = await setup();
    await act(async () => result.current.removeConnection('r3'));
    const buttons = confirmButtons();
    mockAlert.mockClear();

    await act(async () => buttons.find((b) => b.text === 'remove')!.onPress!());

    expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_save_relation');
    expect(reload).not.toHaveBeenCalled();
  });
});
