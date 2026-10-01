/**
 * @jest-environment node
 */
const mockGetServerById = jest.fn();
const mockGet = jest.fn();
const mockIsOffline = jest.fn();

jest.mock('../../src/services/ServerService', () => ({
  __esModule: true,
  createServerService: () => ({ getServerById: mockGetServerById }),
}));
jest.mock('../../src/services/AuthTokenManager', () => ({
  __esModule: true,
  authTokenManager: {},
}));
jest.mock('../../src/services/apiClient', () => ({
  __esModule: true,
  isOfflineError: (error: unknown) => mockIsOffline(error),
  createKeresAxiosInstance: () => ({
    setTokenProvider: jest.fn(),
    setActiveServer: jest.fn(),
    get: (...args: unknown[]) => mockGet(...args),
  }),
}));

import { createStoryPlanService } from '../../src/services/StoryPlanService';

const service = createStoryPlanService({} as never);
const plan = {
  tierName: 'Pro',
  maxEntitiesPerStory: 500,
  maxEntitiesTotal: null,
  entitiesUsedTotal: 0,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetServerById.mockResolvedValue({ id: 'server-1', url: 'https://keres.test' });
  mockIsOffline.mockReturnValue(false);
});

describe('createStoryPlanService', () => {
  it('has no plan to show for a story that is not on a server', async () => {
    await expect(service.getPlan(null, 'story-1')).resolves.toBeNull();
    await expect(service.getPlan(undefined, 'story-1')).resolves.toBeNull();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('has none when the server is no longer registered', async () => {
    mockGetServerById.mockResolvedValue(undefined);

    await expect(service.getPlan('server-1', 'story-1')).resolves.toBeNull();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("reads the owner's plan from the story's server", async () => {
    mockGet.mockResolvedValue({ data: plan });

    await expect(service.getPlan('server-1', 'story-1')).resolves.toEqual(plan);
    expect(mockGet).toHaveBeenCalledWith('/stories/story-1/plan');
  });

  it('shows nothing, quietly, when the device is offline', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockGet.mockRejectedValue(new Error('offline'));
    mockIsOffline.mockReturnValue(true);

    await expect(service.getPlan('server-1', 'story-1')).resolves.toBeNull();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('shows nothing, with a log, when the server answers an error', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockGet.mockRejectedValue(new Error('404'));

    await expect(service.getPlan('server-1', 'story-1')).resolves.toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
