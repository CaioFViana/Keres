/** @jest-environment node */
const mockApi = { accept: jest.fn(), remove: jest.fn() };
const mockRefresh = jest.fn();
const mockImport = jest.fn();
const mockEngine = {};

jest.mock('../../src/services/StoryInvitationApiService', () => ({
  __esModule: true,
  storyInvitationApi: {
    accept: (...args: unknown[]) => mockApi.accept(...args),
    remove: (...args: unknown[]) => mockApi.remove(...args),
  },
}));
jest.mock('../../src/services/StoryInvitationService', () => ({
  __esModule: true,
  createStoryInvitationService: () => ({ syncWithServer: mockRefresh }),
}));
jest.mock('../../src/services/sync/appSyncEngine', () => ({
  __esModule: true,
  // A getter: the factory runs before `mockEngine` is initialized.
  get syncEngine() {
    return mockEngine;
  },
}));
jest.mock('../../src/services/sync/importNewServerStories', () => ({
  __esModule: true,
  importNewServerStories: (...args: unknown[]) => mockImport(...args),
}));

import {
  acceptStoryInvitation,
  closeStoryInvitation,
} from '../../src/services/storyInvitationActions';

const server = { id: 'server-1' } as never;
const db = {} as never;
const invitation = { id: 'inv-1' } as never;

beforeEach(() => jest.clearAllMocks());

describe('story invitation actions', () => {
  it('accepts, refreshes the open invitations and brings the story in, in that order', async () => {
    const order: string[] = [];
    mockApi.accept.mockImplementation(async () => order.push('accept'));
    mockRefresh.mockImplementation(async () => order.push('refresh'));
    mockImport.mockImplementation(async () => order.push('import'));

    await acceptStoryInvitation(db, server, invitation);

    expect(mockApi.accept).toHaveBeenCalledWith(server, 'inv-1');
    expect(mockImport).toHaveBeenCalledWith(db, mockEngine, server);
    expect(order).toEqual(['accept', 'refresh', 'import']);
  });

  it('downloads nothing when the server refuses the acceptance', async () => {
    mockApi.accept.mockRejectedValue(new Error('410'));

    await expect(acceptStoryInvitation(db, server, invitation)).rejects.toThrow('410');

    expect(mockImport).not.toHaveBeenCalled();
  });

  it('closes an invitation and refreshes the list', async () => {
    await closeStoryInvitation(db, server, invitation);

    expect(mockApi.remove).toHaveBeenCalledWith(server, 'inv-1');
    expect(mockRefresh).toHaveBeenCalledWith(server);
  });
});
