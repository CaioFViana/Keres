import { apiClient, clearToken, setToken } from './apiClient';

export interface LoginResult {
  userId: string;
  username: string;
}

/**
 * O login em si (`POST /auth/login`) não diz se a conta é admin - o JWT nunca carrega essa
 * claim (ver apps/api/src/utils/adminAuth.ts). Por isso, depois de logar, este serviço
 * sonda um endpoint só-admin; se vier 403, a conta é real mas não é admin, e o token é
 * descartado antes de qualquer tela do painel aparecer.
 */
export async function login(username: string, password: string): Promise<LoginResult> {
  const { data } = await apiClient.post('/auth/login', { username, password });
  setToken(data.accessToken);

  try {
    await apiClient.get('/admin/api/users', { params: { pageSize: 1 } });
  } catch (error) {
    clearToken();
    throw new Error('This account does not have admin access.');
  }

  return { userId: data.userId, username: data.username };
}

export function logout(): void {
  clearToken();
}
