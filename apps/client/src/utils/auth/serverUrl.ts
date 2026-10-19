/**
 * Whether the host is this device or the local network: `localhost`, a loopback address,
 * or an RFC 1918 / IPv6 local address. Anything else is the internet, whatever its name.
 */
export function isLocalServerHost(hostname: string): boolean {
  // URL.hostname keeps the IPv6 brackets (`[::1]`); strip them before comparing.
  const host = hostname
    .toLowerCase()
    .replace(/\.+$/, '')
    .replace(/^\[(.*)\]$/, '$1');
  if (host === 'localhost') return true;
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const octets = ipv4.slice(1).map(Number);
    if (octets.some((octet) => octet > 255)) return false;
    if (octets[0] === 127) return true;
    if (octets[0] === 10) return true;
    if (octets[0] === 192 && octets[1] === 168) return true;
    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
    return false;
  }
  if (host === '::1') return true;
  // IPv6 unique-local (fc00::/7, so fc.. and fd..) and link-local (fe80::/10),
  // with or without a zone id.
  const bare = host.split('%')[0];
  if (/^f[cd]/i.test(bare)) return true;
  if (/^fe[89ab]/i.test(bare)) return true;
  return false;
}

/**
 * Whether a server address may be registered: `https` anywhere, plain `http` only on this
 * device or the local network. Anything else (other schemes, unparseable input) is refused -
 * credentials must never cross the internet in the clear.
 */
export function isAllowedServerUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return false;
  }
  if (parsed.protocol === 'https:') return true;
  if (parsed.protocol === 'http:') return isLocalServerHost(parsed.hostname);
  return false;
}

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
