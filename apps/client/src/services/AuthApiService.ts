import apiClient, { apiUrl } from './apiClient';

export interface RecoveryCodeLoginResult {
  accessToken: string;
  refreshToken: string;
  userId: string;
  username: string;
  tag: string | null;
}

export type RedeemRecoveryCodeOutcome =
  | { success: true; result: RecoveryCodeLoginResult }
  | { success: false; reason: 'invalid_code' | 'server_error'; status?: number };

/**
 * Troca um recovery code por uma sessão nova em `serverAddress` - usado tanto para entrar
 * numa conta pela primeira vez (`ServerRegistrationScreen`) quanto para trocar a senha de um
 * servidor já cadastrado sem saber a senha atual (`ChangePasswordScreen`). `validateStatus`
 * segue o mesmo padrão do resto do fluxo de auth: status não-2xx é lido aqui, não vira
 * exceção, para diferenciar "código inválido" (401) de qualquer outra falha do servidor.
 */
export async function redeemRecoveryCode(
  serverAddress: string,
  username: string,
  recoveryCode: string,
  newPassword: string,
): Promise<RedeemRecoveryCodeOutcome> {
  const response = await apiClient.post(
    apiUrl(serverAddress, '/auth/forgot-password'),
    { username, recoveryCode: recoveryCode.trim(), newPassword },
    { timeout: 5000, validateStatus: () => true },
  );

  if (response.status === 401) {
    return { success: false, reason: 'invalid_code' };
  }
  if (
    response.status !== 200 ||
    !response.data?.accessToken ||
    !response.data?.refreshToken ||
    !response.data?.userId
  ) {
    return { success: false, reason: 'server_error', status: response.status };
  }

  return {
    success: true,
    result: {
      accessToken: response.data.accessToken,
      refreshToken: response.data.refreshToken,
      userId: response.data.userId,
      username: response.data.username ?? username,
      tag: response.data.tag ?? null,
    },
  };
}
