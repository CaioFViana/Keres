/**
 * `bun run payments:demo` - a Keres server of its own, with a fake payment provider, to see the payment flow
 * working in a real application.
 *
 * It is isolated on purpose: its own SQLite file (`apps/api/payments-demo.db`), its own port (3100) and its own
 * media folder, whatever the `.env` or the shell say, so it never touches the database a real server uses. The
 * plans and two users are created on the first run, and the page of the fake provider is at `/buy`.
 *
 * Plans are granted for nothing here: anyone signed in can confirm their own payment. For development only.
 */
import { mkdirSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const apiRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDirectory = path.join(apiRoot, 'payments-demo-data');
mkdirSync(dataDirectory, { recursive: true });

const ADMIN = { username: 'root', password: 'demo-root-pass' };
const USERS = [
  { username: 'demo', password: 'demo-pass-123' },
  { username: 'demo2', password: 'demo-pass-123' },
];

// Set before anything is imported: the configuration is read once, and `dotenv` never replaces what is set.
process.env.PAYMENT_DEMO = 'true';
process.env.DATABASE_DRIVER = 'sqlite';
process.env.DATABASE_URL = `file:${path.join(apiRoot, 'payments-demo.db')}`;
process.env.MEDIA_STORAGE_DRIVER = 'local';
process.env.MEDIA_STORAGE_PATH = path.join(dataDirectory, 'media');
process.env.PORT ??= '3100';
process.env.JWT_SECRET ??= 'payments-demo-jwt-secret-that-is-long-enough-1234';
process.env.JWT_SECRET_REFRESH ??= 'payments-demo-refresh-secret-that-is-long-enough-1234';
process.env.ROOT_ADMIN_USERNAME = ADMIN.username;
process.env.ROOT_ADMIN_PASSWORD = ADMIN.password;

const port = process.env.PORT;
const base = `http://127.0.0.1:${port}`;

const PLANS = [
  {
    name: 'Plus',
    maxStories: 10,
    priceMonthlyCents: 990,
    priceYearlyCents: 9900,
    isPublicForSale: true,
    sortOrder: 10,
  },
  {
    name: 'Pro',
    maxStories: 50,
    priceMonthlyCents: 1990,
    priceYearlyCents: 19900,
    isPublicForSale: true,
    sortOrder: 20,
  },
];

async function call(method: string, route: string, body?: unknown, token?: string) {
  const response = await fetch(`${base}${route}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: response.status, data: data as any };
}

/** The plans and the two users, created once: running again finds them and leaves them as they are. */
async function seed(): Promise<void> {
  const login = await call('POST', '/api/auth/login', ADMIN);
  if (login.status !== 200) {
    console.warn('Demo: could not sign in as the administrator; plans and users were not created.');
    return;
  }
  const token = login.data.accessToken as string;
  const existing = await call('GET', '/api/admin/tiers', undefined, token);
  const names = new Set<string>(
    Array.isArray(existing.data) ? existing.data.map((tier: { name: string }) => tier.name) : [],
  );
  for (const plan of PLANS) {
    if (!names.has(plan.name)) await call('POST', '/api/admin/tiers', plan, token);
  }
  for (const user of USERS) {
    await call('POST', '/api/auth/register', user);
  }
}

const { bootAndListen } = await import('../src/boot');
await bootAndListen({
  onListening: () => {
    void seed().then(() => {
      console.log(`
  Keres, with a fake payment provider
  -----------------------------------
  Provider's page ........ ${base.replace('127.0.0.1', 'localhost')}/buy
  Web client ............. ${base.replace('127.0.0.1', 'localhost')}/client/   (add this server: ${base.replace('127.0.0.1', 'localhost')})
  Admin panel ............ ${base.replace('127.0.0.1', 'localhost')}/admin/    (see Payments)
  Users .................. ${USERS.map((user) => `${user.username} / ${user.password}`).join('   ')}
  Administrator .......... ${ADMIN.username} / ${ADMIN.password}
  Data ................... ${path.join(apiRoot, 'payments-demo.db')} (delete it to start over)

  Nothing here is real: anyone signed in can confirm their own payment.
`);
    });
  },
});
