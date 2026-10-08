/**
 * The showcase's own session, deliberately separate from everything else.
 *
 * Adults-only stories are visible only to signed-in age-verified readers, so the public site has
 * a sign-in of its own: username + password against `/api/auth/login`, with the token in
 * `sessionStorage` (gone when the tab closes). It never touches the panel's axios token in
 * `localStorage` nor the story unlock tokens - a visitor's login must not leak into (or out of)
 * the administration session, even when both live on the same origin.
 */

const SESSION_KEY = 'keres_showcase_session';

export interface ShowcaseViewer {
  userId: string;
  username: string;
  tag: string;
  isAdultVerified: boolean;
}

export function readSessionToken(): string | null {
  return sessionStorage.getItem(SESSION_KEY);
}

function storeSessionToken(token: string): void {
  sessionStorage.setItem(SESSION_KEY, token);
}

export function clearSessionToken(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return typeof body?.message === 'string'
      ? body.message
      : `Request failed (${response.status}).`;
  } catch {
    return `Request failed (${response.status}).`;
  }
}

/** The signed-in viewer behind a token, or null when the token is missing or stale. */
export async function fetchViewer(token: string): Promise<ShowcaseViewer | null> {
  const response = await fetch('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    return null;
  }
  return response.json();
}

/**
 * Signs in with a site account and remembers the session for this tab. Resolves to the viewer -
 * callers decide what an unverified account may see (nothing adults-only, like anonymous).
 */
export async function login(username: string, password: string): Promise<ShowcaseViewer> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Token only: the session cookies are the web client's, one pair per origin.
    body: JSON.stringify({ username, password, session: 'token' }),
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  const { accessToken } = (await response.json()) as { accessToken: string };
  storeSessionToken(accessToken);
  const viewer = await fetchViewer(accessToken);
  if (!viewer) {
    clearSessionToken();
    throw new Error('Could not open this session.');
  }
  return viewer;
}

export async function logout(): Promise<void> {
  // The sign-in set no cookie, so forgetting the token is the whole sign-out - and asking the server to
  // clear cookies would end the web client's session on this origin.
  clearSessionToken();
}
