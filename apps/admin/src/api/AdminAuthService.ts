import { apiClient, clearLocalSession, setStoredUsername, setToken } from './apiClient';

export interface LoginResult {
  userId: string;
  username: string;
}

/**
 * Best-effort clear of httpOnly session cookies set by `/auth/login`. Network failures are
 * ignored so local logout still completes.
 */
export async function clearServerSession(): Promise<void> {
  try {
    await apiClient.post('/auth/logout');
  } catch {
    // Cookie clear is best-effort; local token is the admin SPA's source of truth.
  }
}

/**
 * The login itself (`POST /auth/login`) does not say whether the account is an admin - the JWT
 * never carries that claim (see apps/api/src/utils/adminAuth.ts). So after logging in, this
 * service probes an admin-only endpoint; if it answers 403, the account is real but not an admin,
 * and the token is discarded before any panel screen appears.
 *
 * The apiClient's interceptor already turns axios errors into an `Error` carrying the API's
 * message, so telling 403 from anything else is done by the message (`Admin access required.`).
 */
export async function login(username: string, password: string): Promise<LoginResult> {
  const { data } = await apiClient.post('/auth/login', { username, password });
  setToken(data.accessToken);

  try {
    await apiClient.get('/admin/users', { params: { pageSize: 1 } });
  } catch (err) {
    clearLocalSession();
    await clearServerSession();
    const message = err instanceof Error ? err.message : '';
    if (message === 'Admin access required.' || /admin access/i.test(message)) {
      throw new Error('This account does not have admin access.');
    }
    throw new Error(message || 'Could not verify admin access. Try again.');
  }

  setStoredUsername(data.username);
  return { userId: data.userId, username: data.username };
}

export async function logout(): Promise<void> {
  clearLocalSession();
  await clearServerSession();
}

/** Cheap probe used on bootstrap to confirm a persisted token still has admin access. */
export async function probeAdminAccess(): Promise<void> {
  await apiClient.get('/admin/users', { params: { pageSize: 1 } });
}
