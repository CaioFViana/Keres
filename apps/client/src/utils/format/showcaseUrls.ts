/**
 * The public addresses of a server's showcase. It is served by the same process and on the same origin as the API,
 * under `/showcase` (the web client is under `/client`; see `SHOWCASE_PATH_PREFIX` and `HOSTED_CLIENT_PATH_PREFIX`
 * in apps/api/src/services/static-delivery/hostedClient.ts), so they are assembled from `servers.url` and there is
 * nothing to ask the server.
 */

function showcaseBase(serverUrl: string): string {
  return `${serverUrl.replace(/\/+$/, '')}/showcase`;
}

/** An author's public page. */
export function buildAuthorPublicUrl(serverUrl: string, username: string): string {
  return `${showcaseBase(serverUrl)}/author/${encodeURIComponent(username)}`;
}

/** A story's public page. */
export function buildStoryPublicUrl(serverUrl: string, storyId: string): string {
  return `${showcaseBase(serverUrl)}/story/${storyId}`;
}

/** A version's online reader, inside the site's own page. */
export function buildStoryReaderUrl(
  serverUrl: string,
  storyId: string,
  publicationId: string,
): string {
  return `${buildStoryPublicUrl(serverUrl, storyId)}/read/${publicationId}`;
}

/** A pack's public page. */
export function buildPackPublicUrl(serverUrl: string, packId: string): string {
  return `${showcaseBase(serverUrl)}/pack/${packId}`;
}

/** The front page of a server's showcase. */
export function buildShowcaseUrl(serverUrl: string): string {
  return showcaseBase(serverUrl);
}
