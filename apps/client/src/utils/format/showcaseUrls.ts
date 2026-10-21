/**
 * The public addresses of a server's showcase. It is served by the same process and on the same origin as the API,
 * under `/showcase` (the web client is under `/client`; see `SHOWCASE_PATH_PREFIX` and `HOSTED_CLIENT_PATH_PREFIX`
 * in apps/api/src/services/static-delivery/hostedClient.ts), so they are assembled from `servers.url` and there is
 * nothing to ask the server.
 */

/** An author's public page. */
export function buildAuthorPublicUrl(serverUrl: string, username: string): string {
  return `${serverUrl.replace(/\/+$/, '')}/showcase/author/${encodeURIComponent(username)}`;
}

/** A story's public page. */
export function buildStoryPublicUrl(serverUrl: string, storyId: string): string {
  return `${serverUrl.replace(/\/+$/, '')}/showcase/story/${storyId}`;
}
