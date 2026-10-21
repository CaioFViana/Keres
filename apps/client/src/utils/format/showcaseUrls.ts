/**
 * An author's public page. The showcase is served by the same process and on the same origin as the API, under
 * `/showcase`, so it is assembled from `servers.url` and there is nothing to ask the server (see
 * `buildStoryPublicUrl` for a story's).
 */
export function buildAuthorPublicUrl(serverUrl: string, username: string): string {
  return `${serverUrl.replace(/\/+$/, '')}/showcase/author/${encodeURIComponent(username)}`;
}
