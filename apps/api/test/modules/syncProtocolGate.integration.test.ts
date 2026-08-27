import {
  MIN_SUPPORTED_SYNC_PROTOCOL,
  SYNC_PROTOCOL_HEADER,
  SYNC_PROTOCOL_VERSION,
} from '@keres/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { newId, registerUser, request, type TestUser } from '../helpers/app';
import { truncateAll } from '../helpers/database';

/**
 * The synchronization protocol gate.
 *
 * This is the half of the version check that protects anybody, because the other half lives in the
 * client and an old client does not have it. A newer server can send a row an older client's local
 * schema refuses - a null in a `NOT NULL` column - and that insert fails on the device, wedging the
 * story's sync in a retry loop the writer cannot escape from inside the app.
 *
 * What these assert is the shape of that refusal: which routes are gated, which are deliberately
 * not, and that being *newer* is not the same as being compatible.
 */

let ana: TestUser;
let storyId: string;

const syncHeaders = (protocol: string | null) =>
  protocol === null ? { [SYNC_PROTOCOL_HEADER]: '' } : { [SYNC_PROTOCOL_HEADER]: protocol };

const pull = (protocol: string | null) =>
  request('GET', `/sync/${storyId}/pull`, {
    token: ana.token,
    headers: syncHeaders(protocol),
    query: { lastOperationVersion: 0 },
  });

const push = (protocol: string | null) =>
  request('POST', `/sync/${storyId}`, {
    token: ana.token,
    headers: syncHeaders(protocol),
    body: [],
  });

beforeEach(async () => {
  await truncateAll();
  ana = await registerUser('ana');
  storyId = newId();
});

describe('a client speaking a supported protocol', () => {
  it('is let through', async () => {
    const { status } = await pull(String(SYNC_PROTOCOL_VERSION));
    expect(status).not.toBe(426);
  });

  it('is let through at the oldest supported protocol too', async () => {
    const { status } = await pull(String(MIN_SUPPORTED_SYNC_PROTOCOL));
    expect(status).not.toBe(426);
  });
});

describe('a client that cannot be served', () => {
  /**
   * The case the gate exists for: a build old enough not to announce a protocol predates the
   * announcement, which is exactly the peer whose local schema may not survive what this server
   * sends.
   */
  it('is refused when it announces nothing at all', async () => {
    const { status } = await pull(null);
    expect(status).toBe(426);
  });

  it('is refused when it is older than the oldest supported', async () => {
    const { status } = await pull(String(MIN_SUPPORTED_SYNC_PROTOCOL - 1));
    expect(status).toBe(426);
  });

  /** Newer is not compatible: it speaks something this server has never seen. */
  it('is refused when it is newer than this server', async () => {
    const { status } = await pull(String(SYNC_PROTOCOL_VERSION + 1));
    expect(status).toBe(426);
  });

  it('is refused when what it announces is not a number', async () => {
    const { status } = await pull('nonsense');
    expect(status).toBe(426);
  });

  it('is refused on the push as well as the pull', async () => {
    expect((await push(null)).status).toBe(426);
  });

  /** The message has to say what to do, not merely that something is wrong. */
  it('says which protocols the server supports', async () => {
    const { data } = await pull(null);
    expect(JSON.stringify(data)).toContain(String(SYNC_PROTOCOL_VERSION));
  });

  /**
   * The gate runs before authentication is even considered. A mismatched client must not be told
   * "unauthorized" for a problem that has nothing to do with its credentials.
   */
  it('is refused with 426 rather than 401 when it also has no token', async () => {
    const { status } = await request('GET', `/sync/${storyId}/pull`, {
      headers: syncHeaders(null),
      query: { lastOperationVersion: 0 },
    });
    expect(status).toBe(426);
  });
});

/**
 * Only `/sync` is gated, on purpose. A mismatched client has to be able to find out *why*, and to
 * log in, so the app can say something better than "unauthorized" - or nothing at all.
 */
describe('what is deliberately not gated', () => {
  it('lets a mismatched client read the health check', async () => {
    const { status, data } = await request('GET', '/kerescheck', { headers: syncHeaders(null) });

    expect(status).toBe(200);
    expect(data).toMatchObject({
      syncProtocol: {
        current: SYNC_PROTOCOL_VERSION,
        minSupported: MIN_SUPPORTED_SYNC_PROTOCOL,
      },
    });
  });

  /** `version` is the release and stays first and unchanged: every existing client reads it. */
  it('still publishes the release alongside the protocol', async () => {
    const { data } = await request('GET', '/kerescheck');
    expect(typeof data.version).toBe('string');
  });

  it('lets a mismatched client log in', async () => {
    const { status } = await request('POST', '/auth/login', {
      headers: syncHeaders(null),
      body: { username: ana.username, password: ana.password },
    });

    expect(status).toBe(200);
  });
});

/**
 * The gate is only worth anything once a release bumps the number.
 *
 * At protocol 1 it refused nobody but builds predating the header, which is correct and also inert.
 * Making `Scene.locationId` nullable is what gave it teeth: a client on 1 declares
 * `location_id TEXT NOT NULL` locally, so a pull carrying a null fails the insert and wedges that
 * story with no way out from inside the app.
 *
 * These hold the *shape* of that rather than the number, so raising it again does not make them
 * lie - what must stay true is that a peer below the minimum is turned away.
 */
describe('once the protocol has moved on', () => {
  it('refuses every protocol below the oldest supported', async () => {
    for (let protocol = 1; protocol < MIN_SUPPORTED_SYNC_PROTOCOL; protocol += 1) {
      expect({ protocol, status: (await pull(String(protocol))).status }).toEqual({
        protocol,
        status: 426,
      });
    }
  });

  /** The whole point of the range: a build that speaks the current one is served. */
  it('serves the current protocol', async () => {
    expect((await pull(String(SYNC_PROTOCOL_VERSION))).status).not.toBe(426);
  });

  it('publishes the range it will actually serve', async () => {
    const { data } = await request('GET', '/kerescheck');
    expect(data.syncProtocol.minSupported).toBeLessThanOrEqual(data.syncProtocol.current);
  });
});
