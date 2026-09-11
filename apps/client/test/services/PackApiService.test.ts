const mockClient = {
  setTokenProvider: jest.fn(),
  setActiveServer: jest.fn(),
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn(),
};
jest.mock('../../src/services/apiClient', () => ({
  __esModule: true,
  createKeresAxiosInstance: jest.fn(() => mockClient),
}));
jest.mock('../../src/services/AuthTokenManager', () => ({
  __esModule: true,
  authTokenManager: {},
}));
jest.mock('@keres/shared', () => ({
  __esModule: true,
  validatePackContent: jest.fn((content) => ({ ...content, valid: true })),
}));

import { PackApiService } from '../../src/services/PackApiService';

const server = { url: 'https://server.test' } as never;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PackApiService', () => {
  it('configures the target server and lists, uploads, and withdraws packs', async () => {
    mockClient.get.mockResolvedValueOnce({ data: [{ id: 'pack-1' }] });
    mockClient.post.mockResolvedValue({ data: { id: 'pack-1' } });
    const service = new PackApiService();
    await expect(service.list(server)).resolves.toEqual([{ id: 'pack-1' }]);
    await expect(service.upload(server, { id: 'pack-1' } as never)).resolves.toEqual({
      id: 'pack-1',
    });
    await service.withdraw(server, 'pack-1');
    expect(mockClient.setActiveServer).toHaveBeenCalledWith(server);
    expect(mockClient.post).toHaveBeenCalledWith('/packs/', { id: 'pack-1' });
    expect(mockClient.delete).toHaveBeenCalledWith('/packs/pack-1');
  });

  it('validates the opaque payload downloaded from a server', async () => {
    mockClient.get.mockResolvedValue({ data: { id: 'pack-1', content: { stories: [] } } });
    await expect(new PackApiService().download(server, 'pack-1')).resolves.toEqual({
      id: 'pack-1',
      content: { stories: [], valid: true },
    });
    expect(mockClient.get).toHaveBeenCalledWith('/packs/pack-1');
  });
});
