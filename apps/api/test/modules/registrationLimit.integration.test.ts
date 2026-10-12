import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { users } from '../../src/db/schema';
import { getApp, request } from '../helpers/app';
import { enterRequiredMode, leaveRequiredMode } from '../helpers/ageVerificationAccounts';
import { truncateAll } from '../helpers/database';

/**
 * The per-address limit on `POST /auth/register` (`registrationLimiter` in `auth.route.ts`). The suites run the app
 * in memory with no socket, so the address is handed to the route through the server the app reports: the same
 * `requestIP` a real listener provides. Each test starts with an empty limiter table (`truncateAll`).
 */

beforeEach(async () => {
  await truncateAll();
});

afterEach(() => {
  leaveRequiredMode();
});

const PASSWORD = 'senha-de-teste-123';

/** Registers from `address` (as the socket sees it), optionally with headers a reverse proxy would add. */
async function registerFrom(
  address: string,
  username: string,
  headers: Record<string, string> = {},
) {
  const app = await getApp();
  const previous = app.server;
  app.server = {
    requestIP: () => ({ address, family: 'IPv4', port: 0 }),
  } as unknown as typeof app.server;
  try {
    return await request('POST', '/auth/register', {
      body: { username, password: PASSWORD },
      headers,
    });
  } finally {
    app.server = previous;
  }
}

const accountNamed = (username: string) =>
  db.select().from(users).where(eq(users.username, username));

describe('POST /auth/register per-address limit', () => {
  it('lets ten registrations through from one address and refuses the eleventh without creating it', async () => {
    for (let i = 1; i <= 10; i++) {
      const { status } = await registerFrom('203.0.113.7', `flood${i}`);
      expect(status).toBe(200);
    }

    const refused = await registerFrom('203.0.113.7', 'flood11');

    expect(refused.status).toBe(429);
    expect(refused.data).toEqual({ message: 'Too many attempts. Try again later.' });
    expect(await accountNamed('flood11')).toHaveLength(0);
    expect(await accountNamed('flood10')).toHaveLength(1);
  });

  it('keeps another address registering while the first one is refused', async () => {
    for (let i = 1; i <= 10; i++) {
      await registerFrom('203.0.113.7', `flood${i}`);
    }
    expect((await registerFrom('203.0.113.7', 'flood11')).status).toBe(429);

    const other = await registerFrom('198.51.100.20', 'neighbour');

    expect(other.status).toBe(200);
    expect(await accountNamed('neighbour')).toHaveLength(1);
  });

  it('applies the same limit in required mode, before any sending is asked of the service', async () => {
    const fake = enterRequiredMode();

    for (let i = 1; i <= 10; i++) {
      const { status } = await registerFrom('203.0.113.7', `flood${i}`);
      expect(status).toBe(200);
    }
    expect(fake.requests).toHaveLength(10);

    const refused = await registerFrom('203.0.113.7', 'flood11');

    expect(refused.status).toBe(429);
    expect(fake.requests).toHaveLength(10);
    expect(await accountNamed('flood11')).toHaveLength(0);
  });

  it('counts the client behind a reverse proxy by its forwarded address, not the proxy', async () => {
    const proxied = { 'x-forwarded-for': '198.51.100.1' };
    for (let i = 1; i <= 10; i++) {
      await registerFrom('127.0.0.1', `proxied${i}`, proxied);
    }

    expect((await registerFrom('127.0.0.1', 'proxied11', proxied)).status).toBe(429);
    expect(
      (await registerFrom('127.0.0.1', 'otherClient', { 'x-forwarded-for': '198.51.100.2' }))
        .status,
    ).toBe(200);
  });

  it('ignores a forwarded header sent by a client that is not behind the proxy', async () => {
    for (let i = 1; i <= 10; i++) {
      // A new forged address each time: the limit must still follow the socket, which the client cannot change.
      const { status } = await registerFrom('203.0.113.7', `spoof${i}`, {
        'x-forwarded-for': `198.51.100.${i}`,
      });
      expect(status).toBe(200);
    }

    const refused = await registerFrom('203.0.113.7', 'spoof11', {
      'x-forwarded-for': '198.51.100.99',
    });

    expect(refused.status).toBe(429);
    expect(await accountNamed('spoof11')).toHaveLength(0);
  });
});
