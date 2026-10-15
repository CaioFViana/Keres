import {
  AccountVerificationResponseSchema,
  AgeVerificationInfoSchema,
  type AccountVerificationResponse,
  type AgeVerificationInfo,
} from '@keres/shared';
import type { ServerSelect } from '@/src/db/schemas/servers';
import apiClient, { apiUrl, createKeresAxiosInstance } from './apiClient';
import { authTokenManager } from '@/src/services/auth/AuthTokenManager';

const INFO_TIMEOUT_MS = 5000;

/**
 * The server refuses the request in the state the account is in: a retry that is not allowed (409). Nothing is
 * wrong with the connection; the screen says the sending cannot be repeated right now.
 */
export class AgeVerificationConflictError extends Error {
  constructor() {
    super('age verification: not allowed in this state');
    this.name = 'AgeVerificationConflictError';
  }
}

/** The server cannot reach its verification service right now (503). Trying again later can work. */
export class AgeVerificationUnavailableError extends Error {
  constructor() {
    super('age verification: service unavailable');
    this.name = 'AgeVerificationUnavailableError';
  }
}

/**
 * `GET /api/age-verification/info`, public: asked before a person starts an account. Answers `null` when the
 * server cannot be read or does not answer as this contract says (an older server has no such route).
 */
export async function fetchAgeVerificationInfo(
  serverUrl: string,
): Promise<AgeVerificationInfo | null> {
  try {
    const response = await apiClient.get(apiUrl(serverUrl, '/age-verification/info'), {
      timeout: INFO_TIMEOUT_MS,
      validateStatus: () => true,
    });
    if (response.status !== 200) return null;
    const parsed = AgeVerificationInfoSchema.safeParse(response.data);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// The verification endpoints are authenticated with the server's own session, like the payments: the same client
// shape as PaymentApiService, bound to the server it talks to.
function clientFor(server: ServerSelect) {
  const client = createKeresAxiosInstance({ baseURL: server.url });
  client.setTokenProvider(authTokenManager);
  client.setActiveServer(server);
  return client;
}

function mapVerificationError(error: unknown): unknown {
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  if (status === 409) return new AgeVerificationConflictError();
  if (status === 503) return new AgeVerificationUnavailableError();
  return error;
}

function readAnswer(data: unknown): AccountVerificationResponse {
  const parsed = AccountVerificationResponseSchema.safeParse(data);
  if (!parsed.success) throw new Error('age verification: unreadable answer');
  return parsed.data;
}

/** `GET /api/auth/verification`: where the account stands, and the session once it is approved. */
export async function fetchVerificationStatus(
  server: ServerSelect,
): Promise<AccountVerificationResponse> {
  try {
    const response = await clientFor(server).get('/auth/verification');
    return readAnswer(response.data);
  } catch (error) {
    throw mapVerificationError(error);
  }
}

/**
 * `POST /api/auth/verification/retry`: sends the documents again after a refusal or an expiry. The upload page the
 * answer names is written in the language sent here: the app's own, not the browser's.
 */
export async function retryVerification(
  server: ServerSelect,
  language: string,
): Promise<AccountVerificationResponse> {
  try {
    const response = await clientFor(server).post('/auth/verification/retry', undefined, {
      headers: { 'Accept-Language': language || 'en' },
    });
    return readAnswer(response.data);
  } catch (error) {
    throw mapVerificationError(error);
  }
}
