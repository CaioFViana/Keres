import type { AccountVerificationResponse } from '@keres/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState } from 'react-native';
import type { ServerSelect } from '@/src/db/schemas/servers';
import {
  AgeVerificationConflictError,
  AgeVerificationUnavailableError,
  fetchVerificationStatus,
  retryVerification,
} from '@/src/services/AgeVerificationApiService';
import { authTokenManager } from '@/src/services/AuthTokenManager';
import { useUserSettingsStore } from '@/src/state/userSettingsStore';
import { entityEventEmitter } from '@/src/utils/EventEmitter';

/** How often the verification is asked about while the screen is in front. */
export const VERIFICATION_POLL_MS = 5000;

export type VerificationRetryError = 'conflict' | 'unavailable' | 'failed';

interface Session {
  accessToken: string;
  refreshToken: string;
}

/**
 * The session of an approved account, asked again when the approval was never delivered: a refresh of the pending
 * session comes back with the full one, because the server reads the account again on every refresh.
 */
async function refreshSession(target: ServerSelect): Promise<Session | null> {
  const tokens = await authTokenManager.getTokens(target.id);
  if (!tokens) return null;
  return authTokenManager.refreshAccessToken(target.id, tokens.refreshToken);
}

/**
 * Follows the verification of a pending account while the screen is in front: asked every few seconds, and at once
 * when the app comes back to the front. The server hands the session over once, at the approval; it is stored as this
 * server's session the way a login stores it, and `sessionStored` turns true so the screen can leave.
 */
export function useServerVerification(server: ServerSelect | undefined) {
  const [answer, setAnswer] = useState<AccountVerificationResponse | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<VerificationRetryError | null>(null);
  const [sessionStored, setSessionStored] = useState(false);
  const { i18n } = useTranslation();
  // The timers read the latest server row through this ref: the list of servers is read again every few seconds,
  // and a new row must not restart the polling.
  const latest = useRef(server);
  useEffect(() => {
    latest.current = server;
  }, [server]);
  const stored = useRef(false);
  const serverId = server?.id;

  const acceptAnswer = useCallback(
    async (target: ServerSelect, next: AccountVerificationResponse) => {
      setAnswer(next);
      setLoadFailed(false);
      if (stored.current) return;
      const session =
        next.session ?? (next.status === 'approved' ? await refreshSession(target) : null);
      // Once only: the session is stored before anything else can ask again.
      if (!session || stored.current) return;
      stored.current = true;
      await authTokenManager.updateTokens(target.id, session.accessToken, session.refreshToken);
      useUserSettingsStore.getState().setActiveServer(target);
      entityEventEmitter.emit('server_connection_changed');
      setSessionStored(true);
    },
    [],
  );

  useEffect(() => {
    if (!serverId) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const look = async () => {
      const target = latest.current;
      if (!target) return;
      try {
        await acceptAnswer(target, await fetchVerificationStatus(target));
      } catch {
        // A missed look is not a refusal: the last answer stays on screen and the next look tries again.
        setLoadFailed(true);
      }
    };
    const start = () => {
      if (timer === null) timer = setInterval(() => void look(), VERIFICATION_POLL_MS);
    };
    const stop = () => {
      if (timer !== null) clearInterval(timer);
      timer = null;
    };
    // Polling only while the app is in front: in the background nobody is waiting for the answer.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void look();
        start();
      } else {
        stop();
      }
    });
    start();
    void look();
    return () => {
      stop();
      subscription.remove();
    };
  }, [serverId, acceptAnswer]);

  const retry = useCallback(async () => {
    const target = latest.current;
    if (!target || retrying) return;
    setRetrying(true);
    setRetryError(null);
    try {
      await acceptAnswer(target, await retryVerification(target, i18n.language));
    } catch (error) {
      setRetryError(
        error instanceof AgeVerificationConflictError
          ? 'conflict'
          : error instanceof AgeVerificationUnavailableError
            ? 'unavailable'
            : 'failed',
      );
    } finally {
      setRetrying(false);
    }
  }, [acceptAnswer, retrying, i18n.language]);

  return { answer, loadFailed, retrying, retryError, retry, sessionStored };
}
