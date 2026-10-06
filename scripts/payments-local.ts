/**
 * Raises the Keres server and the payments service side by side, with throwaway test values, so the
 * whole payment path can be tried on one machine without touching any `.env`:
 *
 *   bun run payments:local            start both, create two plans, stay up (Ctrl+C stops both)
 *   bun run payments:local --smoke    start both, run the flow once (pay, repeat, cancel, store), exit
 *   bun run payments:local --smoke --env-files
 *       the same, but each service reads its REAL .env (apps/api/.env, apps/payments/.env) instead of
 *       the made-up values below; only the database, the media folder and the server's port are
 *       replaced, so a running server of yours is left alone. Proves those two files work together.
 *
 * What it sets up (see docs/payments_local_test.md for the picture):
 *   - the server on :3300 (not :3000, so it can run next to a server you already have) with a
 *     temporary SQLite file and an administrator `root`;
 *   - the payments service on :3101 with the MOCK provider (a fake bank page, no real money) and Play
 *     verification in mock mode;
 *   - the six secrets, matched in pairs, all made up here.
 * Nothing leaves the machine: both listen on loopback.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as dotenv from 'dotenv';

const root = fileURLToPath(new URL('..', import.meta.url));
const useFiles = process.argv.includes('--env-files');
const fromFile = (relative: string): Record<string, string> =>
  dotenv.parse(readFileSync(join(root, relative), 'utf8'));
const apiFile = useFiles ? fromFile('apps/api/.env') : {};
const payFile = useFiles ? fromFile('apps/payments/.env') : {};

const API_PORT = Number(process.env.LOCAL_API_PORT ?? 3300);
const API = `http://127.0.0.1:${API_PORT}`;
// With the real files the service lives where its own .env says.
const PAY = useFiles
  ? (payFile.PUBLIC_BASE_URL ?? 'http://127.0.0.1:3101').replace(/\/$/, '')
  : `http://127.0.0.1:${Number(process.env.LOCAL_PAY_PORT ?? 3101)}`;
const PAY_PORT = Number(new URL(PAY).port || 80);

const CONNECTOR_SECRET = 'local-connector-secret-0123456789abcdef-AAAA';
const EVENTS_SECRET = 'local-events-secret-0123456789abcdef-BBBBBB';
const PLAY_SECRET = 'local-play-endpoint-secret-0123456789-CCCC';
const NOTIFICATION_SECRET = useFiles
  ? (payFile.PLAY_NOTIFICATION_SECRET ?? '')
  : 'local-notification-secret-0123456789-DDDD';
const ADMIN_USER = useFiles ? (apiFile.ROOT_ADMIN_USERNAME ?? 'root') : 'root';
const ADMIN_PASSWORD = useFiles ? (apiFile.ROOT_ADMIN_PASSWORD ?? '') : 'local-root-password-123';
const USER_PASSWORD = 'local-user-password-123';

const workDir = mkdtempSync(join(tmpdir(), 'keres-payments-local-'));
const children: Array<ReturnType<typeof Bun.spawn>> = [];

function start(name: string, cwd: string, env: Record<string, string>): void {
  const child = Bun.spawn(['bun', 'run', name === 'api' ? 'src/server.ts' : 'src/index.ts'], {
    cwd: join(root, cwd),
    env: { ...process.env, ...env },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  children.push(child);
  const pipe = async (stream: ReadableStream<Uint8Array>) => {
    const decoder = new TextDecoder();
    for await (const chunk of stream) {
      for (const line of decoder.decode(chunk).split('\n')) {
        if (line.trim()) console.log(`[${name}] ${line}`);
      }
    }
  };
  void pipe(child.stdout as ReadableStream<Uint8Array>);
  void pipe(child.stderr as ReadableStream<Uint8Array>);
}

function stopAll(code = 0): never {
  for (const child of children) child.kill();
  try {
    rmSync(workDir, { recursive: true, force: true });
  } catch {
    // The database file may still be closing; the OS temp folder cleans it up.
  }
  process.exit(code);
}
process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));

async function waitFor(url: string, what: string): Promise<void> {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  console.error(`${what} did not come up at ${url}.`);
  stopAll(1);
}

async function call(
  method: string,
  url: string,
  options: { token?: string; body?: unknown; form?: Record<string, string> } = {},
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = {};
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  let body: string | undefined;
  if (options.form) {
    headers['content-type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams(options.form).toString();
  } else if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  const response = await fetch(url, { method, headers, body });
  const text = await response.text();
  try {
    return { status: response.status, data: JSON.parse(text) };
  } catch {
    return { status: response.status, data: text };
  }
}

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown): void {
  if (!ok) failures += 1;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} ${label}${ok || detail === undefined ? '' : ` -> ${JSON.stringify(detail)}`}`,
  );
}

const onlyWhatMustDiffer = {
  database: {
    PORT: String(API_PORT),
    DATABASE_DRIVER: 'sqlite',
    DATABASE_URL: `file:${join(workDir, 'keres.db').replace(/\\/g, '/')}`,
    MEDIA_STORAGE_PATH: join(workDir, 'media'),
  },
};

if (useFiles) {
  // The service finds the server at the port this run gave it; everything else is its own .env.
  start('payments', 'apps/payments', { KERES_BASE_URL: API });
  start('api', 'apps/api', onlyWhatMustDiffer.database);
} else {
  start('payments', 'apps/payments', {
    HOST: '127.0.0.1',
    PORT: String(PAY_PORT),
    KERES_CONNECTOR_SECRET: CONNECTOR_SECRET,
    KERES_EVENTS_SECRET: EVENTS_SECRET,
    KERES_BASE_URL: API,
    PUBLIC_BASE_URL: PAY,
    MOCK_METHODS: 'true',
    PLAY_ENDPOINT_SECRET: PLAY_SECRET,
    PLAY_MOCK: 'true',
    PLAY_NOTIFICATION_SECRET: NOTIFICATION_SECRET,
    // Not the real providers: whatever a stray apps/payments/.env says, the test stack uses none.
    PAYPAL_CLIENT_ID: '',
    PAYPAL_SECRET: '',
    STRIPE_SECRET_KEY: '',
    STRIPE_WEBHOOK_SECRET: '',
  });
  start('api', 'apps/api', {
    PORT: String(API_PORT),
    DATABASE_DRIVER: 'sqlite',
    DATABASE_URL: `file:${join(workDir, 'keres.db').replace(/\\/g, '/')}`,
    MEDIA_STORAGE_PATH: join(workDir, 'media'),
    JWT_SECRET: 'local-jwt-secret-0123456789abcdef-0123456789',
    JWT_SECRET_REFRESH: 'local-jwt-refresh-0123456789abcdef-0123456789',
    ROOT_ADMIN_USERNAME: ADMIN_USER,
    ROOT_ADMIN_PASSWORD: ADMIN_PASSWORD,
    PAYMENT_CONNECTOR_URL: PAY,
    PAYMENT_CONNECTOR_SECRET: CONNECTOR_SECRET,
    PAYMENT_EVENTS_SECRET: EVENTS_SECRET,
    PAYMENT_PLAY_ENDPOINT_SECRET: PLAY_SECRET,
    // The mock bank page is plain http on this machine.
    PAYMENT_ALLOW_INSECURE_REDIRECTS: 'true',
  });
}

await waitFor(`${PAY}/health`, 'The payments service');
await waitFor(`${API}/api/public/tiers`, 'The Keres server');

// The connector connects in the background: wait until the server has seen it.
async function adminToken(): Promise<string> {
  const login = await call('POST', `${API}/api/auth/login`, {
    body: { username: ADMIN_USER, password: ADMIN_PASSWORD },
  });
  return login.data.accessToken as string;
}
const admin = await adminToken();

const free = await call('POST', `${API}/api/admin/tiers`, {
  token: admin,
  body: { name: 'Free', isDefault: true },
});
const pro = await call('POST', `${API}/api/admin/tiers`, {
  token: admin,
  body: {
    name: 'Pro',
    isPublicForSale: true,
    priceMonthlyCents: 2500,
    priceYearlyCents: 25000,
    playMonthlyProductId: 'pro_monthly',
  },
});
if (free.status !== 201 || pro.status !== 201) {
  console.error('Could not create the plans:', free.data, pro.data);
  stopAll(1);
}

async function register(prefix: string): Promise<string> {
  const name = `${prefix}${Date.now() % 1_000_000}`;
  const created = await call('POST', `${API}/api/auth/register`, {
    body: { username: name, password: USER_PASSWORD },
  });
  return created.data.accessToken as string;
}

if (!process.argv.includes('--smoke')) {
  console.log(`
Both are up.
  Keres server   ${API}      (admin panel ${API}/admin, login ${ADMIN_USER} / ${ADMIN_PASSWORD})
  Buy site       ${PAY}      (sign in with any account created on the server)
  Mock bank page opens by itself after "Pay" with the "Mock card" method.
Plans created: Free (default) and Pro (R$ 25,00/month, R$ 250,00/year, store product "pro_monthly").
Register an account in the app/web client against ${API}, open the server's plan screen and pay.
Ctrl+C stops both and deletes the temporary database.`);
  await new Promise(() => undefined);
}

// --- smoke: the whole path, once ---
const ana = await register('ana');
const proId = pro.data.id as string;

const info = await call('GET', `${API}/api/payments`, { token: ana });
check(
  'server sees the connector and lists the mock method',
  info.data.enabled === true && info.data.methods.some((m: any) => m.id === 'mock'),
  info.data,
);

const checkout = await call('POST', `${API}/api/payments/checkout`, {
  token: ana,
  body: { tierId: proId, interval: 'monthly', methodId: 'mock' },
});
check(
  'checkout opens with a redirect to the mock bank',
  checkout.status === 201 && checkout.data.action?.kind === 'redirect',
  checkout.data,
);

const page = await call('GET', checkout.data.action.url);
check(
  'the mock bank page loads',
  page.status === 200 && String(page.data).includes('Confirm payment'),
);

const paid = await call('POST', `${PAY}/v1/mock/pay`, {
  form: { checkoutId: checkout.data.id, verdict: 'confirmed' },
});
check('confirming on the bank page answers 200', paid.status === 200);

const after = await call('GET', `${API}/api/payments`, { token: ana });
check(
  'the server now has an active subscription to Pro',
  after.data.subscription?.status === 'active' && after.data.subscription?.tierName === 'Pro',
  after.data.subscription,
);

await call('POST', `${PAY}/v1/mock/pay`, {
  form: { checkoutId: checkout.data.id, verdict: 'confirmed' },
});
const twice = await call('GET', `${API}/api/payments`, { token: ana });
check(
  'the same payment reported twice does not extend the period twice',
  twice.data.subscription?.paidUntil === after.data.subscription?.paidUntil,
);

const history = await call('GET', `${API}/api/payments/history`, { token: ana });
check(
  "the person's payment history has the payment once, with the server's id only",
  history.status === 200 &&
    history.data.items?.length === 1 &&
    history.data.items[0].kind === 'payment_succeeded' &&
    history.data.items[0].tierName === 'Pro' &&
    history.data.items[0].amountCents === 2500 &&
    !JSON.stringify(history.data).includes('mock-'),
  history.data,
);

const cancel = await call('POST', `${API}/api/payments/subscription/cancel`, { token: ana });
check(
  'stopping renewal marks it to end with the paid period',
  cancel.status === 200 && cancel.data.cancelAtPeriodEnd === true,
  cancel.data,
);

const bia = await register('bia');
const store = await call('POST', `${API}/api/payments/play/verify`, {
  token: bia,
  body: {
    tierId: proId,
    interval: 'monthly',
    productId: 'pro_monthly',
    purchaseToken: 'local-token-1',
    packageName: 'me.keres.app',
  },
});
check(
  'a store purchase is verified and granted',
  store.status === 200 && store.data.active === true,
  store.data,
);
check(
  'a store subscription can be stopped from here (the connector reaches the store)',
  store.data.subscription?.canCancelHere === true,
);
const storeCancel = await call('POST', `${API}/api/payments/subscription/cancel`, { token: bia });
check(
  'cancelling it here marks it to end with the paid period',
  storeCancel.status === 200 && storeCancel.data.cancelAtPeriodEnd === true,
  storeCancel.data,
);

const notice = {
  message: {
    messageId: 'local-1',
    data: Buffer.from(
      JSON.stringify({
        packageName: 'me.keres.app',
        eventTimeMillis: String(Date.now()),
        subscriptionNotification: {
          notificationType: 3,
          purchaseToken: 'local-token-1',
          subscriptionId: 'pro_monthly',
        },
      }),
    ).toString('base64'),
  },
};
const pushed = await call('POST', `${PAY}/v1/play/notifications?token=${NOTIFICATION_SECRET}`, {
  body: notice,
});
check("the store's cancel notification is accepted", pushed.status === 200, pushed.data);
const biaAfter = await call('GET', `${API}/api/payments`, { token: bia });
check(
  '...and ends the subscription with its period',
  biaAfter.data.subscription?.cancelAtPeriodEnd === true,
  biaAfter.data.subscription,
);

// Closing the account stops what would charge it: the provider is told, and the account closes.
const anaId = JSON.parse(Buffer.from(ana.split('.')[1], 'base64url').toString()).userId as string;
const closed = await call('DELETE', `${API}/api/admin/users/${anaId}`, { token: admin });
check(
  'an administrator can close an account that had a subscription',
  closed.status === 200,
  closed.data,
);

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
stopAll(failures === 0 ? 0 : 1);
