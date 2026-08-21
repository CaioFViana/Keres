import { afterEach, describe, expect, it } from 'vitest';
import {
  assertSafePathSegment,
  clearLocalSession,
  clearToken,
  getStoredUsername,
  getToken,
  setStoredUsername,
  setToken,
} from '../../src/api/apiClient';

afterEach(() => {
  clearLocalSession();
});

describe('admin token storage', () => {
  it('round-trips the access token through localStorage', () => {
    expect(getToken()).toBeNull();
    setToken('abc');
    expect(getToken()).toBe('abc');
    clearToken();
    expect(getToken()).toBeNull();
  });

  it('round-trips the stored username', () => {
    expect(getStoredUsername()).toBeNull();
    setStoredUsername('admin');
    expect(getStoredUsername()).toBe('admin');
    clearLocalSession();
    expect(getStoredUsername()).toBeNull();
    expect(getToken()).toBeNull();
  });
});

describe('assertSafePathSegment', () => {
  it('accepts ordinary ids and entity names', () => {
    expect(assertSafePathSegment('01ARZ3NDEKTSV4RRFFQ69G5FAV')).toBe('01ARZ3NDEKTSV4RRFFQ69G5FAV');
    expect(assertSafePathSegment('Character', 'entityType')).toBe('Character');
  });

  it('rejects absolute URLs and path traversal', () => {
    expect(() => assertSafePathSegment('http://evil.example')).toThrow('Invalid id');
    expect(() => assertSafePathSegment('https://evil.example/x')).toThrow('Invalid id');
    expect(() => assertSafePathSegment('../etc/passwd')).toThrow('Invalid id');
    expect(() => assertSafePathSegment('a/b')).toThrow('Invalid id');
    expect(() => assertSafePathSegment('')).toThrow('Invalid id');
  });
});
