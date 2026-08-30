import { describe, expect, it } from 'vitest';
import {
  canTalkToServer,
  isProtocolSupported,
  MIN_SUPPORTED_SYNC_PROTOCOL,
  SYNC_PROTOCOL_VERSION,
} from '../../metadata/SyncProtocol';

/**
 * The compatibility policy in one function.
 *
 * The point of a protocol number separate from the app's version is that most releases do not touch
 * it: 1.5 and 1.6 both speak protocol 1 and therefore talk to each other. These cases are the policy
 * rather than examples of it, because the alternative is three call sites each guessing.
 */
describe('serving a peer', () => {
  const range = { current: 4, minSupported: 2 };

  it.each([2, 3, 4])('serves protocol %i, inside the supported range', (version) => {
    expect(isProtocolSupported(version, range)).toBe(true);
  });

  it('refuses a peer older than the oldest supported', () => {
    expect(isProtocolSupported(1, range)).toBe(false);
  });

  /** A newer peer speaks something this build has never seen; being newer is not being compatible. */
  it('refuses a peer newer than this build', () => {
    expect(isProtocolSupported(5, range)).toBe(false);
  });

  it('serves only its own kind when the range is a single version', () => {
    const strict = { current: 4, minSupported: 4 };
    expect(isProtocolSupported(4, strict)).toBe(true);
    expect(isProtocolSupported(3, strict)).toBe(false);
  });

  /** Headers arrive as text; the comparison is numeric. */
  it('reads a version that arrived as a string', () => {
    expect(isProtocolSupported('3', range)).toBe(true);
    expect(isProtocolSupported('9', range)).toBe(false);
  });

  /**
   * Fails closed. A peer old enough not to announce a protocol predates the announcement, which is
   * precisely the peer the gate exists for.
   */
  it.each([[null], [undefined], ['nonsense'], [''], [2.5], [Number.NaN]])(
    'refuses %s',
    (version) => {
      expect(isProtocolSupported(version as never, range)).toBe(false);
    },
  );

  it('uses this build own range when none is given', () => {
    expect(isProtocolSupported(SYNC_PROTOCOL_VERSION)).toBe(true);
    expect(isProtocolSupported(SYNC_PROTOCOL_VERSION + 1)).toBe(false);
    expect(isProtocolSupported(MIN_SUPPORTED_SYNC_PROTOCOL - 1)).toBe(false);
  });
});

describe('a client deciding about a server', () => {
  it('accepts a server whose range covers this client', () => {
    expect(canTalkToServer({ current: 4, minSupported: 1 }, 2)).toBe(true);
  });

  it('refuses a server too old to know this protocol', () => {
    expect(canTalkToServer({ current: 1, minSupported: 1 }, 2)).toBe(false);
  });

  it('refuses a server that has dropped support for this client', () => {
    expect(canTalkToServer({ current: 5, minSupported: 4 }, 2)).toBe(false);
  });

  /** A server from before this mechanism publishes no range, and is refused for the same reason. */
  it.each([
    [null],
    [undefined],
    [{}],
    [{ current: 4 }],
    [{ minSupported: 1 }],
    [{ current: 'four', minSupported: 1 }],
  ])('refuses a server publishing %s', (serverRange) => {
    expect(canTalkToServer(serverRange as never, 2)).toBe(false);
  });

  it('accepts this build against itself', () => {
    expect(
      canTalkToServer({
        current: SYNC_PROTOCOL_VERSION,
        minSupported: MIN_SUPPORTED_SYNC_PROTOCOL,
      }),
    ).toBe(true);
  });
});
