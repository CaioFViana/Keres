import apiClient, { apiUrl } from './apiClient';

const CONFIG_TIMEOUT_MS = 5000;

/**
 * Whether the server asks a new person to sign in or create an account before they reach their
 * stories: `requireAccountOnboarding` in `GET /api/public/config`. Anything short of a clear `true`
 * - an unreachable server, an older one with no such field, a malformed answer - is `false`: the gate
 * only closes when the server says so, so a flaky connection never locks anyone out of the app.
 */
export async function fetchAccountRequirement(serverUrl: string): Promise<boolean> {
  try {
    const response = await apiClient.get(apiUrl(serverUrl, '/public/config'), {
      timeout: CONFIG_TIMEOUT_MS,
      validateStatus: () => true,
    });
    if (response.status !== 200) return false;
    const data = response.data as { requireAccountOnboarding?: unknown } | null;
    return data?.requireAccountOnboarding === true;
  } catch {
    return false;
  }
}
