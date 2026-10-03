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

## Seeing it work: the demo provider

`bun run payments:demo` (in `apps/api`) starts a Keres server of its own with a **fake payment provider**, to see the
whole flow in a real application. It is isolated - its own SQLite file (`payments-demo.db`), port 3100 and media
folder, whatever the `.env` says - and creates two plans (Plus, Pro) and two users (`demo`, `demo2`, password
`demo-pass-123`) on the first run; the administrator is `root` / `demo-root-pass`. Delete `payments-demo.db` to start
over. To turn the demo on in a server of your own, set `PAYMENT_DEMO=true` (it installs the demo plugin, wins over
`PAYMENT_PLUGIN`, and sets `PAYMENT_DEMO_BASE_URL` for the address the app opens - from a phone, the machine's LAN
address). **Anyone signed in can then grant themselves a paid plan: never on a server people really use.**

The provider's page is at `/buy`. Signed in with a Keres account (the login sets the cookie), it shows the current
plan, the plans on sale (the current one marked; paying for it again renews, a different one switches and converts the time left by value), the ways to
pay, and creates the attempt through the same `/api/payments` the app uses. The payment itself, `/buy?charge=...`,
is what the app's "pay" opens (the card, as a `redirect`) or what its instructions name (PIX and boleto): a made-up
code, and buttons that stand in for the bank - *confirm that this was paid*, *failed*, *let it expire*. Confirming
makes the provider call `POST /api/payments/webhook` on this very server, signed (HMAC-SHA256 of the body, header
`x-demopay-signature`), so the notice takes the road a real one takes: the plugin verifies it, Keres applies it once,
and the plan shows in the admin panel under **Payments**. A section on the page, "At the provider", holds what the
provider does on its own: charge a renewal (a saved card works or is declined; a PIX or boleto is offered to be paid
again), cancel the subscription, and - not something a provider does - make the paid period run out now, to see the
`due` side (the plan goes back to the default one and the plugin's `onSubscriptionDue` puts a renewal in front of the
person).

The code, to copy from when writing a real plugin: `src/services/payments/demo/DemoPayPlugin.ts` is the plugin (ask
for a payment, verify a notice, translate `charge.paid` into `payment.succeeded`); `DemoProvider.ts` is the provider it
fronts - in memory, so it forgets everything on a restart, while Keres keeps its own side; `DemoPayService.ts` wires
it to the server. A real plugin makes HTTP calls to the provider's API in the places the demo calls `DemoProvider`.

## What the person is told to do

`createCheckout` answers with an action; the client has one generic screen for all of them, so a plugin never
needs code in the app:

- `redirect` - open this `https` address (the provider's hosted checkout);
- `instructions` - a title and text, and optionally a `copyText` (a PIX code, a reference);
- `none` - nothing to do: the provider charges a method it already has and reports by webhook.

The server refuses anything else (a redirect that is not `https`, an unknown action) and bounds every text.

## Methods that renew, and methods that do not

A method option may say `recurring: false` (the default is `true`). It means the provider does **not** charge it
again by itself - PIX, boleto, a bank transfer: the person has to pay each period. The server looks up the method of
the person's last paid attempt and sends the subscription with `autoRenews`, and the app changes accordingly: it tells
them the date to pay again before, and the button that says "Stop renewing" for a saved card says "I won't renew" -
it still ends the plan on its date without offering a new payment, but it does not pretend there is a charge to stop.
A plugin that says nothing is read as recurring, which is what the app assumed before.

## Periods and renewals

Renewals are the provider's: it keeps the subscription, charges when due, and tells Keres through the webhook.
Keres keeps the date up to which each period is paid:

- a month paid on the 3rd lasts until the 3rd of the next month (a year, the same day of the next year; a period
  that starts on the 31st ends on the last day of a shorter month);
- a payment that arrives before that date extends **from it** (paying early loses nothing); one that arrives after
  starts **from the payment** (a late payment does not buy time that already went by);
- paying for **another plan** while time is left on the current one switches at once, and the time left is
  **converted by value**, not day for day: it is worth what it cost (the old plan's list price per day) and buys days
  of the new plan at its price per day. Twenty days of a R$ 25 plan become about seven days of a R$ 70 one, added to
  the period just paid for; a year of the cheap plan does not become a year of the expensive one. The app says it
  before paying (`GET /api/payments/switch-quote`, the same calculation), and the ledger line says what converted;
- when the date passes with no payment the subscription becomes `due`: the person goes back to the plan they had
  before subscribing (the one an administrator assigned, else the server's default plan - the date itself decides,
  not the periodic job) and `onSubscriptionDue` is called once so the provider can chase it. Nothing they created
  is removed or locked: plan limits only refuse creating more, and the app says so ("your plan is on hold")
  instead of treating a late payment as a loss;
- a `due` subscription left unpaid for 60 days ends; one the person (or the provider) cancelled ends when its paid
  period does, with the plan kept until then.

The plan a person is entitled to is, in order: the one their paid subscription grants, the one an administrator
assigned, the server's default plan, and - if there is none of those - no limits at all. That last step is why a
server that sells plans must have a **default plan**: without one, a lapsed subscription is worth more than a free
plan. The server says so in its log at every start and in the administrators' **Payments** page. The default plan is
one setting with two ways to set it - the "default" box on the plan, or the choice in Registration - kept together; a
server that only has a plan ticked treats that plan as the default. A plan cannot be
deleted while somebody is subscribed to it.

### Plans given by an administrator

An administrator can give a person a plan for 1 to 24 months (the user's page in the admin panel, **Give a plan**;
`POST /api/admin/payments/users/:id/gift`). It is a payment of zero, by the same rules as one made with money: for
the plan the person is already on it extends the running period from where it ends (or opens one now); for another
plan it switches at once, converting the time left by value; and what the person pays afterwards starts where the gift
ends. It is stored as a subscription with `providerId` `admin`: nothing charges it, so it never renews and ends on
its date (without being called late, and without telling the plugin). It is no income - amount 0, not in the
recurring value or the sums - and shows in the ledger as *Plan given* and in the activity record, with who gave it.
It works on a server with no payment plugin too.

What cannot be done silently is giving a *different* plan to somebody a provider is still charging for the old one:
the provider would go on charging the old price. The administrator then has to choose **Cancel their renewal and
give**, and confirm that the person agreed to it (the server refuses without `consent`, and the activity record
keeps that the administrator confirmed it). The renewal is cancelled at the provider through the plugin's
`cancelSubscription`; if the plugin cannot, the confirmation also asks for the administrator's word that the provider
stopped charging, because Keres cannot know. Giving the plan they already pay for just extends it, and the provider
goes on charging.

## In the app

Only while the server answers and only if it sells plans:

- the server's own screen shows the plan and its dates (for a paid plan, or one an administrator gave, which is shown as a gift) and a **Plan and payment** row;
- that screen lists the plans on sale, lets the person choose how often to pay and a method, follows the payment
  until it is paid, failed or expired, and stops a renewal;
- Settings has **Warn when a payment is due** (on by default): once per paid period the app reminds the person
  that a payment is within 5 days, or overdue. It never repeats and never runs on a timer.

A user working offline, or on a server with no plugin, is never shown or asked anything about payments.
