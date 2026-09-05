import { APP_RELEASE, canTalkToServer } from '@keres/shared';
import apiClient, { apiUrl } from '../services/apiClient';

export type KeresAuthFailure = {
  ok: false;
  alertKey:
    | 'invalid_keres_server'
    | 'server_version_mismatch'
    | 'password_required_for_url_change'
    | 'invalid_credentials'
    | 'user_already_exists'
    | 'registration_closed'
    | 'server_error'
    | 'user_not_identified_on_server';
  params?: { serverVersion: string; appVersion: string };
  status?: number;
};

export type KeresAuthSuccess = {
  ok: true;
  accessToken: string;
  refreshToken: string;
  userId: string;
  tag: string | null;
  recoveryCodes: string[] | null;
  tokensChanged: boolean;
};

/**
 * Reachability and login/register against a Keres server.
 *
 * A server that cannot speak this build's synchronization protocol is refused here rather than after
 * the account exists. The server refuses the sync itself (that protects old apps, which do not have
 * this check) - finding out at registration is the difference between "this will not work, here is
 * why" and an account that appears to work until the first sync fails forever. It gates on the
 * protocol, not the release: two versions that never changed the wire stay compatible.
 */
export async function authenticateWithKeresServer(input: {
  address: string;
  username: string;
  password: string;
  isRegistering: boolean;
  needsAuth: boolean;
  urlChangedWithoutPassword: boolean;
  existingUserId: string | null;
  existingTag: string | null;
}): Promise<KeresAuthSuccess | KeresAuthFailure> {
  const checkResponse = await apiClient.get(apiUrl(input.address, '/kerescheck'), {
    timeout: 5000,
    validateStatus: () => true,
  });

  if (
    checkResponse.status !== 200 ||
    !checkResponse.data ||
    typeof checkResponse.data.version !== 'string'
  ) {
    return { ok: false, alertKey: 'invalid_keres_server' };
  }

  if (!canTalkToServer(checkResponse.data.syncProtocol)) {
    return {
      ok: false,
      alertKey: 'server_version_mismatch',
      params: {
        serverVersion: checkResponse.data.version,
        appVersion: APP_RELEASE.version,
      },
    };
  }

  if (input.urlChangedWithoutPassword) {
    return { ok: false, alertKey: 'password_required_for_url_change' };
  }

  if (!input.needsAuth) {
    if (!input.existingUserId) return { ok: false, alertKey: 'user_not_identified_on_server' };
    return {
      ok: true,
      accessToken: '',
      refreshToken: '',
      userId: input.existingUserId,
      tag: input.existingTag,
      recoveryCodes: null,
      tokensChanged: false,
    };
  }

  const authResponse = await apiClient.post(
    apiUrl(input.address, input.isRegistering ? '/auth/register' : '/auth/login'),
    { username: input.username, password: input.password },
    { timeout: 5000, validateStatus: () => true },
  );

  if (
    authResponse.status !== 200 ||
    !authResponse.data ||
    !authResponse.data.accessToken ||
    !authResponse.data.refreshToken ||
    !authResponse.data.userId
  ) {
    if (authResponse.status === 401) return { ok: false, alertKey: 'invalid_credentials' };
    if (authResponse.status === 409) return { ok: false, alertKey: 'user_already_exists' };
    if (authResponse.status === 403) return { ok: false, alertKey: 'registration_closed' };
    return { ok: false, alertKey: 'server_error', status: authResponse.status };
  }

  return {
    ok: true,
    accessToken: authResponse.data.accessToken,
    refreshToken: authResponse.data.refreshToken,
    userId: authResponse.data.userId,
    tag: authResponse.data.tag ?? input.existingTag,
    recoveryCodes:
      input.isRegistering && Array.isArray(authResponse.data.recoveryCodes)
        ? authResponse.data.recoveryCodes
        : null,
    tokensChanged: true,
  };
}

export function keresAuthAlertMessage(
  t: (key: string, params?: Record<string, string>) => string,
  failure: KeresAuthFailure,
): string {
  if (failure.alertKey === 'server_version_mismatch' && failure.params) {
    return t('server_version_mismatch', failure.params);
  }
  if (failure.alertKey === 'server_error') {
    return `${t('server_error')}: ${failure.status}`;
  }
  return t(failure.alertKey);
}
