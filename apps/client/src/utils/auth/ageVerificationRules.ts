import type { AgeVerificationInfo } from '@keres/shared';

/**
 * Whether a server refuses new accounts for want of a working age check. Only a server that said so: an unreadable
 * answer (null) never blocks, because the server itself answers the registration in that case.
 */
export function blocksNewAccounts(info: AgeVerificationInfo | null): boolean {
  return info !== null && info.mode === 'required' && !info.available;
}

/**
 * Whether a host is this device itself: `localhost`, `*.localhost`, `127.0.0.1` or `[::1]`. Only these may be opened
 * over plain `http`: a person who runs their own server on this machine reaches its verification page that way, in
 * the hosted build as much as in development. A LAN address is not loopback, even if it is "local": it needs https.
 */
export function isLoopbackHost(hostname: string): boolean {
  // URL.hostname keeps the IPv6 brackets (`[::1]`); strip them and any trailing dot before comparing.
  const host = hostname
    .toLowerCase()
    .replace(/\.+$/, '')
    .replace(/^\[(.*)\]$/, '$1');
  return (
    host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1' || host === '::1'
  );
}

/**
 * Whether the address a verification service hands the person may be opened: `https`, or plain `http` to this
 * device itself (see `isLoopbackHost`). The address comes from another party, so anything else - a `javascript:` or
 * `data:` URL, a plain `http` page on the local network or on the internet - is refused, not opened.
 */
export function isOpenableVerificationUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol === 'https:') return true;
  return parsed.protocol === 'http:' && isLoopbackHost(parsed.hostname);
}
