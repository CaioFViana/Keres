import * as path from 'path';

/**
 * Path resolution for the main process, isolated from Electron so it can be tested without
 * starting an app: both functions receive the root and the existence probe instead of reading
 * `app.getPath()`/`fs` on their own.
 */

/** Stops a relative path from escaping the root - `path.join` already normalises the `..`. */
function assertInsideRoot(
  root: string,
  resolved: string,
  relativePath: string,
  label: string,
): void {
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`Refusing to access path outside ${label}: "${relativePath}".`);
  }
}

/** Resolves a path in the form "media/<storyId>/<hash>.<ext>", rejecting any escape. */
export function resolveMediaPath(mediaRoot: string, relativePath: string): string {
  const resolved = path.join(mediaRoot, relativePath);
  assertInsideRoot(mediaRoot, resolved, relativePath, 'media storage');
  return resolved;
}

/**
 * Resolves an `app://` request to a file inside the client's web export. Expo Router's static
 * export organises routes as directories with their own index.html (Next.js style), but a flat
 * "route.html" export is accepted too; anything without a match falls back to the root's
 * index.html, so client-side navigation survives a refresh.
 */
export function resolveClientFile(
  clientDist: string,
  relativePath: string,
  exists: (filePath: string) => boolean,
): string {
  const candidates = path.extname(relativePath)
    ? [relativePath]
    : [path.join(relativePath, 'index.html'), `${relativePath}.html`];

  for (const candidate of candidates) {
    const filePath = path.join(clientDist, candidate);
    // The `path.sep` matters: without it, "../client-dist-anything/x" would pass the prefix check.
    if (
      (filePath === clientDist || filePath.startsWith(clientDist + path.sep)) &&
      exists(filePath)
    ) {
      return filePath;
    }
  }
  return path.join(clientDist, 'index.html');
}
