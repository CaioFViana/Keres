# Payment plugins

Keres does not charge anybody itself. A server that wants to sell its plans installs a **payment plugin**: a
module that speaks to one payment provider. Everything money-related happens between that provider and the person
paying; Keres asks the plugin for a way to pay and listens to what the provider reports.

The contract is `packages/shared/payments/PaymentPlugin.ts` (types only; import it as
`@keres/shared/payments/PaymentPlugin`). Keres ships **no** provider. Plugins are not part of Keres and are not
covered by its licence - each fork or operator brings its own.

A server with no plugin works exactly as before: plans are handed out by assigning them to users in the admin
panel, every payments route answers "not enabled", and no client shows anything about payments.

## What is never stored

No card number, expiry, security code, bank account or any other way to pay crosses the contract in either
direction or has a column anywhere (`payment_subscriptions`, `payment_checkouts`, `payment_events`). The person
enters those at the provider - the plugin sends them there with a `redirect`, or tells them what to do with
`instructions`. Keres keeps the plan, the period, the status, the amount and the provider's own references.
The plugin is never handed an e-mail address, only the user's id and name.

An administrator sees the situation and the key values (who is paid up, late or leaving; amounts; the provider's
references to look a payment up there) in **Payments**, read only.

## Enabling one

Set `PAYMENT_PLUGIN` to the plugin module: a path (relative to where the server is started, or absolute) or an
installed package name.

```
PAYMENT_PLUGIN=./plugins/acmepay.ts
```

The module's default export is either the plugin or a factory receiving `{ env, log }`; the plugin reads its own
keys from the environment - Keres never looks at them. A module that cannot be loaded, or breaks the contract, is
reported in the log and ignored: a mistyped path must not take the server down. With Docker, mount the plugin
into the container and pass its keys with `env_file` / `environment`.

The provider calls **`POST /api/payments/webhook`**. The plugin receives the body exactly as it came (a signature
is computed over those bytes) plus the headers, verifies it, and returns normalized events - or throws
`PaymentWebhookRejectedError`, answered with 400. Any other error answers 500 so the provider retries; applying a
notice is idempotent (the provider's `eventId` is unique), so a retry is always safe.

## A minimal plugin

```ts
import {
  PaymentWebhookRejectedError,
  type PaymentPlugin,
  type PaymentPluginFactory,
} from '@keres/shared/payments/PaymentPlugin';

const create: PaymentPluginFactory = ({ env }) => {
  const plugin: PaymentPlugin = {
    id: 'acmepay', // short and stable: kept with every subscription
    displayName: 'Acme Pay',
    listMethods: (currency) => (currency === 'BRL' ? [{ id: 'pix', label: 'PIX' }] : []),
    async createCheckout(request) {
      const session = await acme.createSession({
        reference: request.checkoutId, // idempotency key
        amount: request.amountCents,
        currency: request.currency,
        language: request.language,
      });
      return { providerReference: session.id, action: { kind: 'redirect', url: session.url } };
    },
    async handleWebhook({ headers, rawBody }) {
      if (!acme.verify(rawBody, headers['acme-signature'], env.ACME_WEBHOOK_SECRET)) {
        throw new PaymentWebhookRejectedError('bad signature');
      }
      return acme.toKeresEvents(JSON.parse(rawBody));
    },
  };
  return plugin;
};

export default create;
```

`test/helpers/fakePaymentPlugin.ts` in `apps/api` is a complete reference implementation (every optional part
included) and what the test suite runs against.

## What the person is told to do

`createCheckout` answers with an action; the client has one generic screen for all of them, so a plugin never
needs code in the app:

- `redirect` - open this `https` address (the provider's hosted checkout);
- `instructions` - a title and text, and optionally a `copyText` (a PIX code, a reference);
- `none` - nothing to do: the provider charges a method it already has and reports by webhook.

The server refuses anything else (a redirect that is not `https`, an unknown action) and bounds every text.

## Periods and renewals

Renewals are the provider's: it keeps the subscription, charges when due, and tells Keres through the webhook.
Keres keeps the date up to which each period is paid:

- a month paid on the 3rd lasts until the 3rd of the next month (a year, the same day of the next year; a period
  that starts on the 31st ends on the last day of a shorter month);
- a payment that arrives before that date extends **from it** (paying early loses nothing); one that arrives after
  starts **from the payment** (a late payment does not buy time that already went by);
- when the date passes with no payment the subscription becomes `due`: the person goes back to the server's default
  plan (the date itself decides, not the periodic job) and `onSubscriptionDue` is called once so the provider can
  chase it. Nothing they created is removed or locked: plan limits only refuse creating more, and the app says
  so ("your plan is on hold") instead of treating a late payment as a loss;
- a `due` subscription left unpaid for 60 days ends; one the person (or the provider) cancelled ends when its paid
  period does, with the plan kept until then.

The plan a person is entitled to is, in order: the one their paid subscription grants, the one an administrator
assigned, the server's default plan. A plan cannot be deleted while somebody is subscribed to it.

## In the app

Only while the server answers and only if it sells plans:

- the server's own screen shows the plan and its dates (for a paid plan) and a **Plan and payment** row;
- that screen lists the plans on sale, lets the person choose how often to pay and a method, follows the payment
  until it is paid, failed or expired, and stops a renewal;
- Settings has **Warn when a payment is due** (on by default): once per paid period the app reminds the person
  that a payment is within 5 days, or overdue. It never repeats and never runs on a timer.

A user working offline, or on a server with no plugin, is never shown or asked anything about payments.
