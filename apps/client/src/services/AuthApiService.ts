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
 * Exchanges a recovery code for a new session on `serverAddress` - used both for entering
 * an account for the first time (`ServerRegistrationScreen`) and for changing the password of a
 * server already registered without knowing the current password (`ChangePasswordScreen`). `validateStatus`
 * follows the same pattern as the rest of the auth flow: a non-2xx status is read here, it does not become
 * an exception, so as to tell "invalid code" (401) apart from any other server failure.
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
