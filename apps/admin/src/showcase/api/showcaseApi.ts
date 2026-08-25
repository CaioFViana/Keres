import type { ShowcaseStoryCard, ShowcaseStoryDetail, ShowcaseStoryResponse } from '@keres/shared';

/**
 * The public site's HTTP client.
 *
 * Plain `fetch` instead of the panel's axios: there is no session here, no 401 interceptor and no
 * token in `localStorage` - mixing the two would bring in exactly what this site must not have.
 * The only credential that circulates is the unlock token for a protected story, kept in
 * `sessionStorage` (gone when the tab closes) and scoped to a single story.
 */

const UNLOCK_TOKEN_PREFIX = 'keres_showcase_unlock_';

export function readUnlockToken(storyId: string): string | null {
  return sessionStorage.getItem(`${UNLOCK_TOKEN_PREFIX}${storyId}`);
}

export function storeUnlockToken(storyId: string, token: string): void {
  sessionStorage.setItem(`${UNLOCK_TOKEN_PREFIX}${storyId}`, token);
}

export function clearUnlockToken(storyId: string): void {
  sessionStorage.removeItem(`${UNLOCK_TOKEN_PREFIX}${storyId}`);
}

function unlockHeaders(storyId: string): Record<string, string> {
  const token = readUnlockToken(storyId);
  return token ? { Authorization: `Showcase ${token}` } : {};
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

export interface ShowcaseConfig {
  showcaseEnabled: boolean;
  serverVersion: string;
}

export async function fetchConfig(): Promise<ShowcaseConfig> {
  const response = await fetch('/api/public/config');
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json();
}

export interface StoryListResult {
  /** `null` when the server answered 304 - the list in hand is still valid. */
  stories: ShowcaseStoryCard[] | null;
  etag: string | null;
}

/**
 * The listing, with `If-None-Match`. The page polls, and without this every poll would download
 * the whole catalog again just to find out nothing changed.
 */
export async function fetchStories(previousEtag: string | null): Promise<StoryListResult> {
  const response = await fetch('/api/public/stories', {
    headers: previousEtag ? { 'If-None-Match': previousEtag } : {},
  });
  if (response.status === 304) {
    return { stories: null, etag: previousEtag };
  }
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return { stories: await response.json(), etag: response.headers.get('etag') };
}

export async function fetchStory(storyId: string): Promise<ShowcaseStoryResponse> {
  const response = await fetch(`/api/public/stories/${encodeURIComponent(storyId)}`, {
    headers: unlockHeaders(storyId),
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json();
}

export async function unlockStory(storyId: string, password: string): Promise<ShowcaseStoryDetail> {
  const response = await fetch(`/api/public/stories/${encodeURIComponent(storyId)}/unlock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  const { token } = (await response.json()) as { token: string };
  storeUnlockToken(storyId, token);

  const detail = await fetchStory(storyId);
  if ('protected' in detail) {
    // Should not happen: the token was just issued for this story.
    clearUnlockToken(storyId);
    throw new Error('Could not open this story.');
  }
  return detail;
}

/**
 * A version's download address.
 *
 * An `<a download>` sends no headers, so for a protected story the server returns a link with a
 * 60-second token embedded, rather than accepting the one-hour token in a URL that would end up in
 * the browser's history.
 */
export async function fetchDownloadUrl(storyId: string, publicationId: string): Promise<string> {
  const response = await fetch(
    `/api/public/stories/${encodeURIComponent(storyId)}/publications/${encodeURIComponent(
      publicationId,
    )}/download-url`,
    { method: 'POST', headers: unlockHeaders(storyId) },
  );
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  const { url } = (await response.json()) as { url: string };
  return url;
}
