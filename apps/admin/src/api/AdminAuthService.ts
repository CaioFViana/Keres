import { apiClient, clearLocalSession, setStoredUsername, setToken } from './apiClient';

export interface LoginResult {
  userId: string;
  username: string;
}

/**
 * The login itself (`POST /auth/login`) does not say whether the account is an admin - the JWT
 * never carries that claim (see apps/api/src/utils/adminAuth.ts). So after logging in, this
 * service probes an admin-only endpoint; if it answers 403, the account is real but not an admin,
 * and the token is discarded before any panel screen appears.
 *
 * The apiClient's interceptor already turns axios errors into an `Error` carrying the API's
 * message, so telling 403 from anything else is done by the message (`Admin access required.`).
 *
 * The panel shares its origin with the web client the server hosts, and the session cookies are that
 * client's: it signs in for the token only (`session: 'token'`) and signs out by forgetting it, so
 * neither swaps nor ends the account the web client is using.
 */
export async function login(username: string, password: string): Promise<LoginResult> {
  const { data } = await apiClient.post('/auth/login', { username, password, session: 'token' });
  setToken(data.accessToken);

  try {
    await apiClient.get('/admin/users', { params: { pageSize: 1 } });
  } catch (err) {
    clearLocalSession();
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
}

/** Cheap probe used on bootstrap to confirm a persisted token still has admin access. */
export async function probeAdminAccess(): Promise<void> {
  await apiClient.get('/admin/users', { params: { pageSize: 1 } });
}
