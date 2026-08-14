import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn(),
  setToken: vi.fn(),
  clearToken: vi.fn(),
}));

vi.mock('../../src/api/apiClient', () => ({
  apiClient: { post: mocks.post, get: mocks.get },
  setToken: mocks.setToken,
  clearToken: mocks.clearToken,
}));

import { login } from '../../src/api/AdminAuthService';

describe('admin login', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps the token only after confirming admin access', async () => {
    mocks.post.mockResolvedValue({
      data: { accessToken: 'token', userId: 'user-1', username: 'admin' },
    });
    mocks.get.mockResolvedValue({ data: [] });

    await expect(login('admin', 'password')).resolves.toEqual({
      userId: 'user-1',
      username: 'admin',
    });
    expect(mocks.setToken).toHaveBeenCalledWith('token');
    expect(mocks.get).toHaveBeenCalledWith('/admin/api/users', { params: { pageSize: 1 } });
    expect(mocks.clearToken).not.toHaveBeenCalled();
  });

  it('clears the token when the authenticated account is not an admin', async () => {
    mocks.post.mockResolvedValue({
      data: { accessToken: 'token', userId: 'user-1', username: 'reader' },
    });
    mocks.get.mockRejectedValue(new Error('Forbidden'));

    await expect(login('reader', 'password')).rejects.toThrow(
      'This account does not have admin access.',
    );
    expect(mocks.clearToken).toHaveBeenCalledOnce();
  });
});
