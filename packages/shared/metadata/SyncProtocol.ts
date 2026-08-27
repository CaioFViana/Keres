/**
 * Version of the *synchronization protocol*: the shape of what client and server exchange, and the
 * rules each end assumes the other applies.
 *
 * Deliberately **not** the app's version, for the same reason `CURRENT_STORY_FORMAT_VERSION` is not:
 * releases happen for reasons that have nothing to do with the wire. Gating on `major.minor` would
 * refuse 1.5 against 1.6 even when nothing between them changed how a story travels, and the whole
 * point of a separate number is that most releases do not touch it.
 *
 * Bump `SYNC_PROTOCOL_VERSION` only when an official release changes something an older peer would
 * get wrong - a new entity in the payload, a column that starts arriving null, a rule the server
 * begins to enforce. Raise `MIN_SUPPORTED_SYNC_PROTOCOL` only when supporting the older shape stops
 * being possible: that is the release where old peers are cut off, and it should be a decision, not
 * a side effect.
 *
 * Both ends declare both numbers, so the same comparison answers "may I talk to this server?" and
 * "may I answer this client?".
 */

import { MIN_SUPPORTED_SYNC_PROTOCOL, SYNC_PROTOCOL_VERSION } from './ReleaseVersions';

/**
 * The numbers live in `ReleaseVersions.ts`, with the other constants a release bumps by hand; they
 * are re-exported here because this is the module that says what they mean and how they are read.
 */
export { MIN_SUPPORTED_SYNC_PROTOCOL, SYNC_PROTOCOL_VERSION };

/** What each end publishes about itself: `/kerescheck` on the server, a header on the client. */
export interface SyncProtocolRange {
  current: number;
  minSupported: number;
}

export const SYNC_PROTOCOL_RANGE: SyncProtocolRange = {
  current: SYNC_PROTOCOL_VERSION,
  minSupported: MIN_SUPPORTED_SYNC_PROTOCOL,
};

/** The header a client announces its protocol version in. Absent means a build predating this. */
export const SYNC_PROTOCOL_HEADER = 'x-keres-sync-protocol';

/**
 * Whether a peer speaking `peerVersion` can be served by a build supporting `range`.
 *
 * Fails closed on anything that is not a whole number, absent included: a peer old enough not to
 * announce a protocol predates the announcement, which is exactly the case being guarded against.
 */
export function isProtocolSupported(
  peerVersion: number | string | null | undefined,
  range: SyncProtocolRange = SYNC_PROTOCOL_RANGE,
): boolean {
  const version = typeof peerVersion === 'string' ? Number(peerVersion) : peerVersion;
  if (typeof version !== 'number' || !Number.isInteger(version)) return false;
  return version >= range.minSupported && version <= range.current;
}

/**
 * The mirror image, for the client deciding about a server it just probed.
 *
 * A server that publishes no range at all is one from before this existed, so it is refused for the
 * same reason a headerless client is.
 */
export function canTalkToServer(
  serverRange: Partial<SyncProtocolRange> | null | undefined,
  clientVersion: number = SYNC_PROTOCOL_VERSION,
): boolean {
  if (!serverRange) return false;
  const { current, minSupported } = serverRange;
  if (!Number.isInteger(current) || !Number.isInteger(minSupported)) return false;
  return isProtocolSupported(clientVersion, {
    current: current as number,
    minSupported: minSupported as number,
  });
}
