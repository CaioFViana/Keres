const mockService = {
  getAllRelationsForStory: jest.fn(),
  addConnection: jest.fn(),
  removeRelation: jest.fn(),
  setParent: jest.fn(),
};
const mockT = (key: string) => key;

jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: jest.fn(() => ({ t: mockT })),
}));
jest.mock('../../src/services/storymanagement/LocationRelationService', () => ({
  __esModule: true,
  createLocationRelationService: jest.fn(() => mockService),
}));

import { act, renderHook } from '@testing-library/react-native';
import { useLocationMapRelations } from '../../src/hooks/useLocationMapRelations';

const relations = [
  {
    id: 'connection',
    relationType: 'connected_to',
    locationAId: 'a',
    locationBId: 'b',
    isDeleted: false,
  },
  { id: 'parent', relationType: 'contains', locationAId: 'a', locationBId: 'b', isDeleted: false },
  { id: 'child', relationType: 'contains', locationAId: 'b', locationBId: 'c', isDeleted: false },
] as never;
const locations = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Beta' },
  { id: 'c', name: 'Gamma' },
  { id: 'd', name: 'Delta' },
] as never;
const content = {
  nodes: [{ locationId: 'a' }, { locationId: 'b' }, { locationId: 'c' }],
  relationTexts: [
    { sourceLocationId: 'b', destinationLocationId: 'a', text: 'Road' },
    { sourceLocationId: 'a', destinationLocationId: 'b', text: 'Inside' },
  ],
} as never;

function buildOptions(overrides = {}) {
  return {
    db: {} as never,
    storyId: 'story',
    userId: 'user',
    relations,
    setRelations: jest.fn(),
    locations,
    content,
    selectedNode: { locationId: 'b' } as never,
    notify: jest.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockService.getAllRelationsForStory.mockResolvedValue([
    ...relations,
    {
      id: 'deleted',
      relationType: 'connected_to',
      locationAId: 'a',
      locationBId: 'd',
      isDeleted: true,
    },
  ]);
  mockService.addConnection.mockResolvedValue(undefined);
  mockService.removeRelation.mockResolvedValue(undefined);
  mockService.setParent.mockResolvedValue(undefined);
});

describe('useLocationMapRelations', () => {
  it('derives graph display data and excludes cyclic or existing candidates', async () => {
    const view = await renderHook(() => useLocationMapRelations(buildOptions()));

    expect(view.result.current.connections).toEqual([
      { locationAId: 'a', locationBId: 'b', label: 'Inside' },
    ]);
    expect(view.result.current.contains).toEqual([
      { parentLocationId: 'a', childLocationId: 'b', label: 'Inside' },
      { parentLocationId: 'b', childLocationId: 'c' },
    ]);
    expect(view.result.current.nodeConnections).toEqual([
      { relationId: 'connection', otherLocationId: 'a', otherName: 'Alpha' },
    ]);
    expect(view.result.current.nodeParent).toEqual({
      relationId: 'parent',
      locationId: 'a',
      name: 'Alpha',
    });
    expect(view.result.current.nodeChildren).toEqual([
      { relationId: 'child', locationId: 'c', name: 'Gamma' },
    ]);
    expect(view.result.current.parentCandidates).toEqual([{ id: 'd', name: 'Delta' }]);
    expect(view.result.current.childCandidates).toEqual([{ id: 'd', name: 'Delta' }]);
    expect(view.result.current.connectCandidates).toEqual([
      { id: 'c', name: 'Gamma' },
      { id: 'd', name: 'Delta' },
    ]);
  });

  it('persists every relation action and refreshes visible relations', async () => {
    const options = buildOptions();
    const view = await renderHook(() => useLocationMapRelations(options));
    await act(async () => {
      await view.result.current.handleAddConnection('d');
      await view.result.current.handleConnectLocations('a', 'd');
      await view.result.current.handleRemoveConnection('connection');
      await view.result.current.handleSetParent('d');
      await view.result.current.handleSetLocationParent('d', 'a');
      await view.result.current.handleRemoveParent();
      await view.result.current.handleAddChild('d');
      await view.result.current.handleRemoveRelation('child');
    });
    expect(mockService.addConnection).toHaveBeenCalledWith('user', 'story', 'b', 'd');
    expect(mockService.addConnection).toHaveBeenCalledWith('user', 'story', 'a', 'd');
    expect(mockService.setParent).toHaveBeenCalledWith('user', 'story', 'b', 'd');
    expect(mockService.setParent).toHaveBeenCalledWith('user', 'story', 'd', 'a');
    expect(mockService.setParent).toHaveBeenCalledWith('user', 'story', 'b', null);
    expect(mockService.removeRelation).toHaveBeenCalledWith('user', 'connection');
    expect(options.setRelations).toHaveBeenCalledWith(relations);
  });

  it('skips invalid operations and reports persistence errors', async () => {
    const noActor = buildOptions({ userId: null });
    const view = await renderHook(() => useLocationMapRelations(noActor));
    await act(async () => {
      await view.result.current.handleConnectLocations('a', 'a');
      await view.result.current.handleAddConnection('d');
    });
    expect(mockService.addConnection).not.toHaveBeenCalled();

    mockService.addConnection.mockRejectedValueOnce(new Error('offline'));
    const withError = buildOptions();
    const failed = await renderHook(() => useLocationMapRelations(withError));
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    await act(async () => failed.result.current.handleAddConnection('d'));
    expect(withError.notify).toHaveBeenCalledWith('failed_to_save_relation', 'error');
  });
});
