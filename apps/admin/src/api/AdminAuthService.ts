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
 * O login em si (`POST /auth/login`) não diz se a conta é admin - o JWT nunca carrega essa
 * claim (ver apps/api/src/utils/adminAuth.ts). Por isso, depois de logar, este serviço
 * sonda um endpoint só-admin; se vier 403, a conta é real mas não é admin, e o token é
 * descartado antes de qualquer tela do painel aparecer.
 *
 * O interceptor do apiClient já transforma erros axios em `Error` com a mensagem da API,
 * então a distinção 403 vs outro é pela mensagem (`Admin access required.`).
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
