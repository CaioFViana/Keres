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

import { login, logout, probeAdminAccess } from '../../src/api/AdminAuthService';

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
    // The session cookies are the web client's: the panel asks for the token only.
    expect(mocks.post).toHaveBeenCalledWith('/auth/login', {
      username: 'admin',
      password: 'password',
      session: 'token',
    });
    expect(mocks.setToken).toHaveBeenCalledWith('token');
    expect(mocks.setStoredUsername).toHaveBeenCalledWith('admin');
    expect(mocks.get).toHaveBeenCalledWith('/admin/users', { params: { pageSize: 1 } });
    expect(mocks.clearLocalSession).not.toHaveBeenCalled();
  });

  it('clears the local session, and touches no server session, when the account is not an admin', async () => {
    mocks.post.mockResolvedValueOnce({
      data: { accessToken: 'token', userId: 'user-1', username: 'reader' },
    });
    mocks.get.mockRejectedValue(new Error('Admin access required.'));

    await expect(login('reader', 'password')).rejects.toThrow(
      'This account does not have admin access.',
    );
    expect(mocks.clearLocalSession).toHaveBeenCalledOnce();
    expect(mocks.post).not.toHaveBeenCalledWith('/auth/logout');
  });

  it('surfaces a generic error when the admin probe fails for another reason', async () => {
    mocks.post.mockResolvedValueOnce({
      data: { accessToken: 'token', userId: 'user-1', username: 'admin' },
    });
    mocks.get.mockRejectedValue(new Error('Network Error'));

    await expect(login('admin', 'password')).rejects.toThrow('Network Error');
    expect(mocks.clearLocalSession).toHaveBeenCalledOnce();
  });
});

describe('admin access probe', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reuses the users listing as a cheap admin-only probe', async () => {
    mocks.get.mockResolvedValue({ data: [] });

    await probeAdminAccess();

    expect(mocks.get).toHaveBeenCalledWith('/admin/users', { params: { pageSize: 1 } });
  });

  it('lets the interceptor error through untouched for the caller to handle', async () => {
    mocks.get.mockRejectedValue(new Error('Admin access required.'));

    await expect(probeAdminAccess()).rejects.toThrow('Admin access required.');
  });

  it('still says something when the probe fails without a message', async () => {
    mocks.post.mockResolvedValueOnce({
      data: { accessToken: 'token', userId: 'user-1', username: 'admin' },
    });
    mocks.get.mockRejectedValue('boom');

    await expect(login('admin', 'password')).rejects.toThrow(
      'Could not verify admin access. Try again.',
    );
    expect(mocks.clearLocalSession).toHaveBeenCalledOnce();
  });
});

describe('admin logout', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forgets the token and leaves the cookies of the web client alone', async () => {
    await logout();
    expect(mocks.clearLocalSession).toHaveBeenCalledOnce();
    expect(mocks.post).not.toHaveBeenCalled();
  });
});
