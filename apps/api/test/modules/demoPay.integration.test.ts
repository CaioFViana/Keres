import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The flag is read when the configuration loads, which is before anything below is imported.
vi.hoisted(() => {
  process.env.PAYMENT_DEMO = 'true';
});

import { db } from '../../src/db';
import { paymentCheckouts, paymentEvents, paymentSubscriptions, tiers } from '../../src/db/schema';
import { sanitizeAction } from '../../src/services/payments/CheckoutService';
import {
  createConfiguredDemoPlugin,
  demoProvider,
  demoSecret,
  setDemoWebhookTransport,
} from '../../src/services/payments/demo/DemoPayService';
import {
  DEMO_SIGNATURE_HEADER,
  signDemoNotice,
} from '../../src/services/payments/demo/DemoPayPlugin';
import { setPaymentPlugin } from '../../src/services/payments/PaymentPluginRegistry';
import { subscriptionService } from '../../src/services/payments/SubscriptionService';
import { tierEnforcementService } from '../../src/services/TierEnforcementService';
import { getApp, newId, registerUser, request, type TestUser } from '../helpers/app';
import { promoteToAdmin, truncateAll } from '../helpers/database';

/**
 * The demo provider end to end, on the real application: what the `/buy` page does is these calls, and the
 * provider's notices reach Keres through the real webhook route, signed, as a real provider's would.
 */
let admin: TestUser;
let ana: TestUser;
let bia: TestUser;
let proId: string;

/** The root-level `/buy` routes, which the `/api` helper does not reach. */
async function buy(method: string, path: string, options: { token?: string; body?: unknown } = {}) {
  const app = await getApp();
  const response = await app.handle(
    new Request(`http://localhost${path}`, {
      method,
      headers: {
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
        ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    }),
  );
  const text = await response.text();
  let data: any = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // an HTML page
  }
  return { status: response.status, data, headers: response.headers, text };
}

const checkout = (user: TestUser, methodId: string, interval = 'monthly') =>
  request('POST', '/payments/checkout', {
    token: user.token,
    body: { tierId: proId, interval, methodId },
  });

const subscriptionOf = async (user: TestUser) =>
  (
    await db.select().from(paymentSubscriptions).where(eq(paymentSubscriptions.userId, user.userId))
  )[0];

/** Opens an attempt and pays it on the demo page: what a person does from the app to a confirmed plan. */
async function subscribe(user: TestUser, methodId = 'card', interval = 'monthly') {
  const opened = await checkout(user, methodId, interval);
  expect(opened.status).toBe(201);
  const paid = await buy('POST', `/buy/api/charge/${opened.data.id}/pay`);
  expect(paid.status).toBe(200);
  return { opened: opened.data, paid: paid.data };
}

beforeEach(async () => {
  await truncateAll();
  demoProvider.reset();
  admin = await registerUser('root');
  await promoteToAdmin(admin.userId);
  ana = await registerUser('ana');
  bia = await registerUser('bia');
  proId = newId();
  await db.insert(tiers).values({
    id: proId,
    name: 'Pro',
    maxStories: 50,
    priceMonthlyCents: 1990,
    priceYearlyCents: 19900,
    isPublicForSale: true,
  });
  setPaymentPlugin(createConfiguredDemoPlugin());
  // The provider reaches Keres by the real route; with no port to call in a test, the request goes in memory.
  const app = await getApp();
  setDemoWebhookTransport((rawBody, signature) =>
    app.handle(
      new Request('http://localhost/api/payments/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json', [DEMO_SIGNATURE_HEADER]: signature },
        body: rawBody,
      }),
    ),
  );
});

afterEach(() => {
  setDemoWebhookTransport(null);
  setPaymentPlugin(null);
  vi.restoreAllMocks();
});

describe('the demo page', () => {
  it('is served at /buy, as a page that keeps the server’s words out of its markup', async () => {
    const { status, headers, text } = await buy('GET', '/buy');

    expect(status).toBe(200);
    expect(headers.get('content-type')).toContain('text/html');
    expect(text).toContain('Demo Pay');
    expect(text).toContain('DEMO PAYMENT PROVIDER');
    // Nothing the server sends is put in as markup.
    expect(text).not.toContain('innerHTML');
  });

  it('puts the payment of a person in the open to anyone who has its id, and nothing of anybody else', async () => {
    const opened = await checkout(ana, 'card');

    const byReference = await buy('GET', `/buy/api/charge/${opened.data.id}`);
    expect(byReference.status).toBe(200);
    expect(byReference.data).toMatchObject({
      status: 'open',
      kind: 'first',
      methodId: 'card',
      tierName: 'Pro',
      payerName: 'ana',
      amountCents: 1990,
    });
    expect((await buy('GET', '/buy/api/charge/nothing')).status).toBe(404);
    // What belongs to a person needs them signed in.
    expect((await buy('GET', '/buy/api/mine')).status).toBe(401);
  });
});

describe('paying with the test card', () => {
  it('sends the person to the provider’s page, over plain http, and nowhere else', async () => {
    const { status, data } = await checkout(ana, 'card');

    expect(status).toBe(201);
    expect(data.action).toEqual({
      kind: 'redirect',
      url: expect.stringMatching(/^http:\/\/localhost:\d+\/buy\?charge=ch_/),
    });
    // The rule that keeps real plugins on https is only relaxed by the flag, and only for http.
    expect(() => sanitizeAction({ kind: 'redirect', url: 'http://x.test/' })).toThrow(/https/);
    expect(
      sanitizeAction({ kind: 'redirect', url: 'http://x.test/' }, { allowHttp: true }),
    ).toEqual({
      kind: 'redirect',
      url: 'http://x.test/',
    });
    expect(() =>
      sanitizeAction({ kind: 'redirect', url: 'javascript:alert(1)' }, { allowHttp: true }),
    ).toThrow(/https/);
  });

  it('confirming it tells the server by a signed notice, and the plan is granted and shown to the administrators', async () => {
    const { opened, paid } = await subscribe(ana);

    expect(paid.delivery).toEqual({ ok: true, status: 200, applied: 1 });
    expect(paid.charge).toMatchObject({ status: 'paid', payerName: 'ana', tierName: 'Pro' });
    expect(await subscriptionOf(ana)).toMatchObject({
      tierId: proId,
      status: 'active',
      providerId: 'demopay',
      amountCents: 1990,
    });
    expect((await tierEnforcementService.getEffectiveTier(ana.userId))?.id).toBe(proId);
    expect((await tierEnforcementService.getEffectiveTier(bia.userId))?.id).not.toBe(proId);
    expect((await db.select().from(paymentCheckouts))[0]).toMatchObject({
      id: opened.id,
      status: 'paid',
    });

    const asAdmin = await request('GET', '/admin/api/payments/subscriptions', {
      token: admin.token,
    });
    expect(asAdmin.data.items[0]).toMatchObject({
      tierName: 'Pro',
      providerId: 'demopay',
      user: { username: 'ana' },
    });
  });

  it('refuses a second confirmation of the same payment, and a payment that does not exist', async () => {
    const { opened } = await subscribe(ana);

    const again = await buy('POST', `/buy/api/charge/${opened.id}/pay`);

    expect(again.status).toBe(409);
    expect((await buy('POST', '/buy/api/charge/none/pay')).status).toBe(404);
    expect(await db.select().from(paymentEvents)).toHaveLength(1);
  });

  it('can fail or expire, which closes the attempt and grants nothing', async () => {
    const failed = await checkout(ana, 'card');
    const failure = await buy('POST', `/buy/api/charge/${failed.data.id}/fail`);
    expect(failure.data.charge).toMatchObject({ status: 'failed' });
    expect(failure.data.delivery.ok).toBe(true);

    const expiring = await checkout(ana, 'card');
    const expiry = await buy('POST', `/buy/api/charge/${expiring.data.id}/expire`);
    expect(expiry.data.charge.status).toBe('expired');

    expect(await subscriptionOf(ana)).toBeUndefined();
    const rows = await db.select().from(paymentCheckouts);
    expect(rows.map((row) => row.status).sort()).toEqual(['expired', 'failed']);
  });
});

describe('paying with PIX or boleto', () => {
  it.each([
    ['pix', /^DEMO-PIX-/],
    ['boleto', /^DEMO \d{5}\./],
  ])('tells the person what to pay with %s, and the page confirms it', async (method, pattern) => {
    const { status, data } = await checkout(ana, method);

    expect(status).toBe(201);
    expect(data.action).toMatchObject({
      kind: 'instructions',
      copyText: expect.stringMatching(pattern),
    });
    const page = await buy('GET', `/buy/api/charge/${data.id}`);
    expect(page.data.code).toBe(data.action.copyText);

    await buy('POST', `/buy/api/charge/${data.id}/pay`);

    expect((await subscriptionOf(ana)).status).toBe('active');
  });
});

describe('which methods renew by themselves', () => {
  it('says so for the card, and says the person has to pay again for PIX and boleto', async () => {
    const methods = (await request('GET', '/payments', { token: ana.token })).data.methods;
    expect(
      Object.fromEntries(
        methods.map((m: { id: string; recurring?: boolean }) => [m.id, m.recurring]),
      ),
    ).toEqual({ card: undefined, pix: false, boleto: false });

    await subscribe(ana, 'card');
    await subscribe(bia, 'pix');

    const wire = async (user: TestUser) =>
      (await request('GET', '/payments', { token: user.token })).data.subscription;
    expect((await wire(ana)).autoRenews).toBe(true);
    expect((await wire(bia)).autoRenews).toBe(false);
  });
});

describe('renewals', () => {
  it('charges a saved card by itself, and the period goes on from where it ended', async () => {
    await subscribe(ana);
    const before = (await subscriptionOf(ana)).paidUntil;
    const mine = (await buy('GET', '/buy/api/mine', { token: ana.token })).data;
    expect(mine.subscriptions[0]).toMatchObject({ autoCharge: true, status: 'active' });

    const renewed = await buy('POST', `/buy/api/subscription/${mine.subscriptions[0].id}/renew`, {
      token: ana.token,
      body: { outcome: 'paid' },
    });

    expect(renewed.data.delivery.applied).toBe(1);
    expect((await subscriptionOf(ana)).paidUntil.getTime()).toBeGreaterThan(before.getTime());
  });

  it('records a declined card against the subscription without touching what was paid', async () => {
    await subscribe(ana);
    const before = await subscriptionOf(ana);
    const mine = (await buy('GET', '/buy/api/mine', { token: ana.token })).data;

    await buy('POST', `/buy/api/subscription/${mine.subscriptions[0].id}/renew`, {
      token: ana.token,
      body: { outcome: 'failed' },
    });

    const after = await subscriptionOf(ana);
    expect(after.status).toBe('active');
    expect(after.paidUntil.getTime()).toBe(before.paidUntil.getTime());
    const failures = await db
      .select()
      .from(paymentEvents)
      .where(eq(paymentEvents.kind, 'payment_failed'));
    expect(failures).toHaveLength(1);
  });

  it('offers a PIX renewal to be paid, once however often it is asked, and pays it from the page', async () => {
    await subscribe(ana, 'pix');
    const sub = (await buy('GET', '/buy/api/mine', { token: ana.token })).data.subscriptions[0];
    expect(sub.autoCharge).toBe(false);
    const before = (await subscriptionOf(ana)).paidUntil;

    const first = await buy('POST', `/buy/api/subscription/${sub.id}/renew`, {
      token: ana.token,
      body: {},
    });
    const second = await buy('POST', `/buy/api/subscription/${sub.id}/renew`, {
      token: ana.token,
      body: {},
    });
    expect(first.data.charge.id).toBe(second.data.charge.id);
    expect(first.data.charge).toMatchObject({ status: 'open', kind: 'renewal' });
    expect(first.data.delivery).toEqual({ ok: true, status: 200, applied: 0 });
    expect((await buy('GET', '/buy/api/mine', { token: ana.token })).data.open).toHaveLength(1);

    await buy('POST', `/buy/api/charge/${first.data.charge.id}/pay`);

    expect((await subscriptionOf(ana)).paidUntil.getTime()).toBeGreaterThan(before.getTime());
  });

  it('only lets a person act on their own subscriptions', async () => {
    await subscribe(ana);
    const sub = (await buy('GET', '/buy/api/mine', { token: ana.token })).data.subscriptions[0];

    const asBia = await buy('POST', `/buy/api/subscription/${sub.id}/renew`, {
      token: bia.token,
      body: {},
    });
    const cancelAsBia = await buy('POST', `/buy/api/subscription/${sub.id}/cancel`, {
      token: bia.token,
      body: {},
    });

    expect(asBia.status).toBe(404);
    expect(cancelAsBia.status).toBe(404);
    expect((await buy('GET', '/buy/api/mine', { token: bia.token })).data.subscriptions).toEqual(
      [],
    );
  });
});

describe('cancelling', () => {
  it('lets the period that was paid run out when the provider cancels', async () => {
    await subscribe(ana);
    const sub = (await buy('GET', '/buy/api/mine', { token: ana.token })).data.subscriptions[0];

    const { data } = await buy('POST', `/buy/api/subscription/${sub.id}/cancel`, {
      token: ana.token,
      body: {},
    });

    expect(data.delivery.applied).toBe(1);
    expect(await subscriptionOf(ana)).toMatchObject({ status: 'active', cancelAtPeriodEnd: true });
    expect((await tierEnforcementService.getEffectiveTier(ana.userId))?.id).toBe(proId);
  });

  it('is told, by the plugin, when the person cancels in the app', async () => {
    await subscribe(ana);

    const { status } = await request('POST', '/payments/subscription/cancel', { token: ana.token });

    expect(status).toBe(200);
    const sub = (await buy('GET', '/buy/api/mine', { token: ana.token })).data.subscriptions[0];
    expect(sub.status).toBe('canceled');
    // A canceled subscription offers nothing to pay.
    const renew = await buy('POST', `/buy/api/subscription/${sub.id}/renew`, {
      token: ana.token,
      body: {},
    });
    expect(renew.status).toBe(409);
  });
});

describe('when the paid period runs out', () => {
  it('puts the plan on hold, has the plugin put a renewal in front of the person, and brings it back once paid', async () => {
    await subscribe(ana, 'pix');

    const lapsed = await buy('POST', '/buy/api/mine/lapse', { token: ana.token, body: {} });

    expect(lapsed.data).toEqual({ due: 1, ended: 0 });
    expect((await subscriptionOf(ana)).status).toBe('due');
    expect((await tierEnforcementService.getEffectiveTier(ana.userId))?.id).not.toBe(proId);
    const open = (await buy('GET', '/buy/api/mine', { token: ana.token })).data.open;
    expect(open).toHaveLength(1);
    expect(open[0]).toMatchObject({ kind: 'renewal', methodId: 'pix' });

    await buy('POST', `/buy/api/charge/${open[0].id}/pay`);

    expect((await subscriptionOf(ana)).status).toBe('active');
    expect((await tierEnforcementService.getEffectiveTier(ana.userId))?.id).toBe(proId);
    // Running the job again finds nothing new to say.
    expect(await subscriptionService.markDue()).toEqual({ due: 0, ended: 0 });
  });

  it('has nothing to lapse for somebody who never paid', async () => {
    const { data } = await buy('POST', '/buy/api/mine/lapse', { token: bia.token, body: {} });

    expect(data).toEqual({ due: 0, ended: 0 });
  });
});

describe('the notices, as a real provider’s would be treated', () => {
  const post = async (body: string, signature?: string) => {
    const app = await getApp();
    const response = await app.handle(
      new Request('http://localhost/api/payments/webhook', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(signature ? { [DEMO_SIGNATURE_HEADER]: signature } : {}),
        },
        body,
      }),
    );
    return response.status;
  };

  it('refuses one with no signature, a wrong one, or one signed for another body', async () => {
    const opened = await checkout(ana, 'card');
    const body = JSON.stringify({
      id: 'ch_forged:paid',
      type: 'charge.paid',
      data: {
        chargeId: 'ch_forged',
        reference: opened.data.id,
        subscriptionId: 'sub_forged',
        amountCents: 1,
        currency: 'BRL',
        paidAt: new Date().toISOString(),
      },
    });

    expect(await post(body)).toBe(400);
    expect(await post(body, 'sha256=00')).toBe(400);
    expect(await post(body, signDemoNotice('something else', demoSecret()))).toBe(400);
    expect(await post('not json', signDemoNotice('not json', demoSecret()))).toBe(400);
    expect(await subscriptionOf(ana)).toBeUndefined();
  });

  it('accepts a well-signed one, and ignores a kind it does not know', async () => {
    const body = JSON.stringify({ id: 'x:other', type: 'something.else', data: {} });

    expect(await post(body, signDemoNotice(body, demoSecret()))).toBe(200);
  });

  it('can still be told the outcome by asking, when the notice never arrived', async () => {
    const opened = await checkout(ana, 'card');
    const calls: string[] = [];
    // The provider cannot reach the server this time.
    setDemoWebhookTransport(async (rawBody) => {
      calls.push(rawBody);
      return new Response('down', { status: 503 });
    });
    const paid = await buy('POST', `/buy/api/charge/${opened.data.id}/pay`);
    expect(paid.data.delivery).toMatchObject({ ok: false, status: 503 });
    expect(await subscriptionOf(ana)).toBeUndefined();

    // The app follows the attempt, which asks the plugin, which asks the provider.
    const followed = await request('GET', `/payments/checkout/${opened.data.id}`, {
      token: ana.token,
    });

    expect(followed.data.status).toBe('paid');
    expect((await subscriptionOf(ana)).status).toBe('active');

    // And the notice, when the provider tries again, is the same fact: counted once.
    const app = await getApp();
    setDemoWebhookTransport((rawBody, signature) =>
      app.handle(
        new Request('http://localhost/api/payments/webhook', {
          method: 'POST',
          headers: { [DEMO_SIGNATURE_HEADER]: signature },
          body: rawBody,
        }),
      ),
    );
    const before = (await subscriptionOf(ana)).paidUntil.getTime();
    const retry = await post(calls[0], signDemoNotice(calls[0], demoSecret()));
    expect(retry).toBe(200);
    expect((await subscriptionOf(ana)).paidUntil.getTime()).toBe(before);
  });

  it('says so when the server cannot be reached at all', async () => {
    const opened = await checkout(ana, 'card');
    setDemoWebhookTransport(async () => {
      throw new Error('connection refused');
    });

    const paid = await buy('POST', `/buy/api/charge/${opened.data.id}/pay`);

    expect(paid.data.delivery).toEqual({ ok: false, status: 0, applied: 0 });
  });
});
