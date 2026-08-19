import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn(),
  setToken: vi.fn(),
  clearLocalSession: vi.fn(),
  setStoredUsername: vi.fn(),
}));

vi.mock('../../src/api/apiClient', () => ({
  apiClient: { post: mocks.post, get: mocks.get },
  setToken: mocks.setToken,
  clearLocalSession: mocks.clearLocalSession,
  setStoredUsername: mocks.setStoredUsername,
}));

import { login, logout } from '../../src/api/AdminAuthService';

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
    expect(mocks.setStoredUsername).toHaveBeenCalledWith('admin');
    expect(mocks.get).toHaveBeenCalledWith('/admin/api/users', { params: { pageSize: 1 } });
    expect(mocks.clearLocalSession).not.toHaveBeenCalled();
  });

  it('clears the local session and server cookies when the account is not an admin', async () => {
    mocks.post
      .mockResolvedValueOnce({
        data: { accessToken: 'token', userId: 'user-1', username: 'reader' },
      })
      .mockResolvedValueOnce({ data: { message: 'Logged out' } });
    mocks.get.mockRejectedValue(new Error('Admin access required.'));

    await expect(login('reader', 'password')).rejects.toThrow(
      'This account does not have admin access.',
    );
    expect(mocks.clearLocalSession).toHaveBeenCalledOnce();
    expect(mocks.post).toHaveBeenCalledWith('/auth/logout');
  });

  it('surfaces a generic error when the admin probe fails for another reason', async () => {
    mocks.post
      .mockResolvedValueOnce({
        data: { accessToken: 'token', userId: 'user-1', username: 'admin' },
      })
      .mockResolvedValueOnce({ data: { message: 'Logged out' } });
    mocks.get.mockRejectedValue(new Error('Network Error'));

    await expect(login('admin', 'password')).rejects.toThrow('Network Error');
    expect(mocks.clearLocalSession).toHaveBeenCalledOnce();
  });
});

describe('admin logout', () => {
  beforeEach(() => vi.clearAllMocks());

  it('clears local session then asks the API to drop cookies', async () => {
    mocks.post.mockResolvedValue({ data: { message: 'Logged out' } });
    await logout();
    expect(mocks.clearLocalSession).toHaveBeenCalledOnce();
    expect(mocks.post).toHaveBeenCalledWith('/auth/logout');
  });
});
