import { afterEach, describe, expect, it } from 'vitest';
import { clearToken, getToken, setToken } from '../../src/api/apiClient';

describe('admin authentication token storage', () => {
  afterEach(() => clearToken());

  it('returns null when no token was stored', () => {
    expect(getToken()).toBeNull();
  });

  it('stores and clears the admin token', () => {
    setToken('admin-token');
    expect(getToken()).toBe('admin-token');

    clearToken();
    expect(getToken()).toBeNull();
  });
});
