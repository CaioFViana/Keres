import { isLocalServerHost, normalizeServerUrl } from '@/src/utils/auth/serverUrl';

/** What a link to a server's public site points at. */
export type ShowcaseLinkTarget =
  | { kind: 'server' }
  | { kind: 'stories' }
  | { kind: 'authors' }
  | { kind: 'packs' }
  | { kind: 'story'; storyId: string }
  | { kind: 'read'; storyId: string; publicationId: string }
  | { kind: 'author'; username: string }
  | { kind: 'pack'; packId: string };

/**
 * Why a pasted text is not a link the app can open: nothing there, not an address at all, a scheme that is not
 * the web's, plain `http` to somewhere that is not this device or the local network, or an address that is not
 * a page of a showcase.
 */
export type ShowcaseLinkProblem =
  | 'empty'
  | 'not_a_url'
  | 'unsupported_scheme'
  | 'insecure_http'
  | 'not_showcase';

export type ParsedShowcaseLink =
  | {
      ok: true;
      /** The server's address, in the form `normalizeServerUrl` gives: what it is compared by. */
      origin: string;
      target: ShowcaseLinkTarget;
      /** The address as it was understood, with the scheme the text may have lacked. */
      url: string;
    }
  | {
      ok: false;
      problem: ShowcaseLinkProblem;
      /** Set when the text was an address after all, so it can still be offered to the browser. */
      url?: string;
    };

const SHOWCASE_PREFIX = 'showcase';

/** The first thing in a pasted text that looks like an address: people paste a sentence, quotes, `<…>`. */
function candidateOf(text: string): string {
  const unwrapped = (token: string) => token.replace(/^[<"'(]+|[>"'),.;]+$/g, '');
  const stripped = unwrapped(text.trim());
  if (!/\s/.test(stripped)) return stripped;
  return (
    stripped
      .split(/\s+/)
      .map(unwrapped)
      .find((token) => token.includes('://')) ?? ''
  );
}

function hostOf(address: string): string {
  const afterScheme = address.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const authority = afterScheme.split(/[/?#]/)[0] ?? '';
  const withoutUser = authority.slice(authority.lastIndexOf('@') + 1);
  return withoutUser.startsWith('[')
    ? withoutUser.slice(0, withoutUser.indexOf(']') + 1)
    : withoutUser.replace(/:\d*$/, '');
}

function segmentsOf(pathname: string): string[] | null {
  try {
    return pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));
  } catch {
    return null;
  }
}

function targetOf(segments: string[]): ShowcaseLinkTarget | null {
  // The root of the server, and the hosted client's own address: the server itself.
  if (segments.length === 0 || (segments.length === 1 && segments[0] === 'client')) {
    return { kind: 'server' };
  }
  if (segments[0] !== SHOWCASE_PREFIX) return null;
  const [, section, id, action, publicationId] = segments;
  if (!section) return { kind: 'stories' };
  if (segments.length === 2) {
    if (section === 'authors') return { kind: 'authors' };
    if (section === 'packs') return { kind: 'packs' };
    if (section === 'about') return { kind: 'server' };
    return null;
  }
  if (section === 'story' && id) {
    if (segments.length === 3) return { kind: 'story', storyId: id };
    if (segments.length === 5 && action === 'read' && publicationId) {
      return { kind: 'read', storyId: id, publicationId };
    }
    return null;
  }
  if (segments.length === 3 && section === 'author' && id) return { kind: 'author', username: id };
  if (segments.length === 3 && section === 'pack' && id) return { kind: 'pack', packId: id };
  return null;
}

/**
 * Reads a pasted text as a link to a server's public site: `https://host/showcase/story/<id>`, an author's
 * page, a pack, the lists, or the bare address of the server. Forgiving about what surrounds the address
 * (a sentence, quotes, no scheme) and strict about what it is: only `https`, or `http` on this device or the
 * local network - the same rule servers are registered under - and only the pages the public site has.
 */
export function parseShowcaseLink(text: string): ParsedShowcaseLink {
  const candidate = candidateOf(text);
  if (!candidate) return { ok: false, problem: text.trim() ? 'not_a_url' : 'empty' };

  let address = candidate;
  if (!address.includes('://')) {
    const host = hostOf(address);
    // A bare address ("keres.example/showcase/…", "localhost:3000"): the web, secure unless it is local.
    if (!host || !(host.includes('.') || isLocalServerHost(host))) {
      return { ok: false, problem: 'not_a_url' };
    }
    address = `${isLocalServerHost(host) ? 'http' : 'https'}://${address}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(address);
  } catch {
    return { ok: false, problem: 'not_a_url' };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, problem: 'unsupported_scheme' };
  }
  const host = parsed.hostname;
  // `mailto:someone@host` and `user:pass@host` are not a page of anybody's showcase.
  if (parsed.username || parsed.password) return { ok: false, problem: 'not_a_url' };
  if (!(host.includes('.') || host.includes(':') || isLocalServerHost(host))) {
    return { ok: false, problem: 'not_a_url' };
  }
  if (parsed.protocol === 'http:' && !isLocalServerHost(host)) {
    return { ok: false, problem: 'insecure_http', url: parsed.href };
  }

  const segments = segmentsOf(parsed.pathname);
  const target = segments ? targetOf(segments) : null;
  if (!target) return { ok: false, problem: 'not_showcase', url: parsed.href };
  return { ok: true, origin: normalizeServerUrl(parsed.origin), target, url: parsed.href };
}

export type ResolvedShowcaseLink<S extends { url: string }> =
  | { kind: 'invalid'; problem: ShowcaseLinkProblem; url?: string }
  | { kind: 'registered'; server: S; target: ShowcaseLinkTarget; url: string }
  | { kind: 'guest'; origin: string; target: ShowcaseLinkTarget; url: string };

/**
 * Decides whose a pasted link is: one of the registered servers (compared the way server addresses are
 * everywhere, so a trailing slash or a default port does not make a stranger of it), or a server the person
 * has not registered, which can still be browsed as a guest.
 */
export function resolveShowcaseLink<S extends { url: string }>(
  text: string,
  servers: readonly S[],
): ResolvedShowcaseLink<S> {
  const parsed = parseShowcaseLink(text);
  if (!parsed.ok) return { kind: 'invalid', problem: parsed.problem, url: parsed.url };
  const server = servers.find((entry) => normalizeServerUrl(entry.url) === parsed.origin);
  return server
    ? { kind: 'registered', server, target: parsed.target, url: parsed.url }
    : { kind: 'guest', origin: parsed.origin, target: parsed.target, url: parsed.url };
}
