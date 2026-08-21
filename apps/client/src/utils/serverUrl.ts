/**
 * Canonical form used to decide whether two server addresses are the same connection.
 *
 * Trailing slashes, default ports and host case must not create a second local row —
 * sync, auth and the hosted cookie session all look up a server by URL.
 */
export function normalizeServerUrl(url: string): string {
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    parsed.hash = '';
    parsed.hostname = parsed.hostname.toLowerCase();
    parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    if (
      (parsed.protocol === 'https:' && parsed.port === '443') ||
      (parsed.protocol === 'http:' && parsed.port === '80')
    ) {
      parsed.port = '';
    }
    return parsed.href.replace(/\/+$/, '');
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}
