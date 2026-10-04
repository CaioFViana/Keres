# Payment connectors

Keres does not charge anybody itself. A server that wants to sell its plans talks to a **payment connector**: a
separate service that speaks to payment providers on one side and to Keres over HTTP on the other. Everything
money-related happens between the provider and the person paying; Keres asks the connector for a way to pay and
listens to what the provider reports.

The contract is `packages/shared/payments/PaymentConnector.ts` (types only) plus the wire schemas in
`packages/shared/schemas/PaymentConnectorSchemas.ts`, also published as JSON Schema under
`docs/payment_connector/` for implementations in any language. A connector imports nothing of Keres.

A server with no connector works exactly as before: plans are handed out by assigning them to users in the admin
panel, every payments route answers "not enabled", and no client shows anything about payments. A connector that
is down or wrong is reported in the log and ignored: payments must never take stories down.

## The protocol (`KERES-CONNECT-V1`)

Every request Keres sends and every answer the connector returns is HMAC-SHA256 signed over a canonical string
naming the direction (so the two directions use different keys), the method, the logical path (with query string -
not the address after a proxy rewrote it), a timestamp, a one-time nonce and the body hash. Answers also bind the
request nonce, so they cannot be replayed elsewhere. Nonces are accepted once inside a 300s window. Signatures
cover the path, not the host: a reverse proxy does not break them. What this buys is forgery and replay
resistance - not confidentiality: use TLS.

Keres calls, all JSON:

- `GET /v1/info` - `{ apiVersion: 1, id, displayName, capabilities }`. The optional parts
  (`status`, `cancel`, `due`) only exist when listed here.
- `GET /v1/methods?currency=BRL` - the ways to pay (cached for a minute by Keres).
- `POST /v1/checkouts` - starts a payment (`checkoutId` is the idempotency key); answers the provider
  reference plus what the person does next (`redirect` to an `https` page, `instructions`, or `none`).
- `GET /v1/checkouts/:id?providerReference=...` - how an attempt ended, or `null` while open (`status`).
- `POST /v1/subscriptions/:reference/cancel` (`cancel`), `POST /v1/subscriptions/due` (`due`).

The connector reports provider facts to `POST /api/payments/events`, signed with the events key (a different
key from the connector key), up to 100 events per push; Keres applies each `eventId` once, so retries are safe.

Keys, on the Keres side: `PAYMENT_CONNECTOR_URL`, `PAYMENT_CONNECTOR_SECRET` (rotation via
`PAYMENT_CONNECTOR_SECRET_PREVIOUS`), `PAYMENT_EVENTS_SECRET` (`_PREVIOUS` likewise, must differ from the
connector key). `https` is required unless loopback or `ALLOW_INSECURE_HTTP=true`.

## The official microservice (`apps/payments`)

`apps/payments` is the connector keres.me runs - and the reference implementation to copy. It sells through
PayPal (`paypal`: Subscriptions API) and Google Pay on the web (`googlepay`: Stripe Checkout, which offers
Google Pay by itself), and verifies Google Play Billing purchases for the mobile app (`POST /v1/play/verify`:
the app buys with the Play SDK, the service asks Google whether the token is real, then reports
`payment.succeeded`). `PLAY_MOCK=true` accepts any token - homologation only, never production.

It ships alone (own `Dockerfile`, own port, own compose; example nginx as `buy.keres.me`), holds no story
database, and is never part of the `keres servers` bundle. A provider whose keys are absent is simply not
listed. See `apps/payments/README.md` for setup and the homologation checklist.

## What is never stored

No card number, expiry, security code, bank account or any other way to pay crosses the contract in either
direction or has a column anywhere (`payment_subscriptions`, `payment_checkouts`, `payment_events`). The person
enters those at the provider - the connector sends them there with a `redirect`, or tells them what to do with
`instructions`. Keres keeps the plan, the period, the status, the amount and the provider's own references.
The connector is never handed an e-mail address, only the user's id and name.

An administrator sees the situation and the key values (who is paid up, late or leaving; amounts; the provider's
references to look a payment up there) in **Payments**, read only.

## Pointing a server at one

On the Keres server, set `PAYMENT_CONNECTOR_URL` to the connector's address plus the two keys (each with a
`_PREVIOUS` sibling for rotation). Keres connects in the background with retries, checks `/v1/info`, and from
then on sells through it. A third-party connector implements the protocol above - any language, the JSON Schemas
are the spec - and `apps/api/test/helpers/fakePaymentConnector.ts` is a complete reference implementation (every
optional part included) and what the server test suite runs against. The official microservice
(`apps/payments`) is the production one to copy from.

## What the person is told to do

`createCheckout` answers with an action; the client has one generic screen for all of them, so a connector never
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
A method that says nothing is read as recurring, which is what the app assumed before.

## How a method is paid: `flow`

A method option may say `flow: 'native'` with `store: 'play'` (or `'appstore'`); the default is
`flow: 'redirect'`, so a connector that predates the field keeps working and stays visible wherever
web checkouts run. A `redirect` method opens a provider page; a `native` one is bought inside the
mobile app through the device's store and never starts a connector checkout. Clients filter by it:
web and desktop offer only `redirect` methods, the Android app only the `play` one (the Play Store
policy forbids web checkouts for digital goods inside apps), and when the server sells methods the
device cannot run the app says they are unavailable instead of offering them.

A native purchase is checked by token, not by checkout: the app sends the store purchase token to
Keres (`POST /api/payments/play/verify`, with the plan, the period, the product and the package -
the user and the price are the server's own), Keres opens a native attempt and asks the connector at
`POST /v1/play/verify` (the endpoint's own Bearer, never the signed protocol), and the connector
checks the token with the store and reports `payment.succeeded` naming the attempt. Checking a
subscription token must also check the token is really for the named product (the subscriptions
endpoint's path carries no product, unlike one-time purchases). What each side may sell is per
plan and period: a tier says whether web checkouts sell it monthly/yearly (both on by default) and
names the store products selling it, or nothing when the store does not sell it; Keres refuses a
web checkout for a plan not sold on the web, and the relay refuses a token for a product that does
not sell the plan. A store product id names its plan: the same id on two plans is refused (409),
across either period, so a token always maps back to one plan. A native attempt costs no provider
session, so it never eats the hourly checkout quota - retrying a store purchase after a failure is
always allowed. Before opening the store sheet the app reconciles unfinished purchases first: one
the server already confirmed counts as paid instead of buying again (the store refuses an
already-owned subscription).
A store purchase token belongs to the first account that relays it: the server keeps only its
hash, another account relaying the same token gets 403, and the event application enforces the
same owner again before granting (so a token taken from someone else's unfinished purchase grants
nothing). The relay itself is capped per person per minute (5), and retrying reuses the plan's
live attempt instead of opening another - scripts can neither burn the store API quota nor grow
the ledger. A subscription in its grace period counts as paid (the store still entitles it while
retrying the renewal); held, paused, cancelled or expired do not. Mock mode is opt-in
(`PLAY_MOCK=true`) and off by default; live verification without `PLAY_SERVICE_ACCOUNT_JSON`
refuses to boot.

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
server that only has a plan ticked treats that plan as the default.

Keep a free plan there even if every one of its ceilings is **0**. A ceiling left blank is unlimited, and 0 allows
nothing (stories, entities, storage, publications, messages to other users), so a free plan with every ceiling at 0
makes the server **paid-only in practice**: people can register, sign in and write to the administrators (a cap of its
own, not the plan's), but create and upload nothing until they subscribe or are given a plan. Ceilings count against
the owner of a story, so they can still collaborate on stories of people who have a plan. The price of a plan changes
none of this: it is read only to charge, never to limit. A plan cannot be
deleted while somebody is subscribed to it.

### Plans given by an administrator

An administrator can give a person a plan for 1 to 24 months (the user's page in the admin panel, **Give a plan**;
`POST /api/admin/payments/users/:id/gift`). It is a payment of zero, by the same rules as one made with money: for
the plan the person is already on it extends the running period from where it ends (or opens one now); for another
plan it switches at once, converting the time left by value; and what the person pays afterwards starts where the gift
ends. It is stored as a subscription with `providerId` `admin`: nothing charges it, so it never renews and ends on
its date (without being called late, and without telling the connector). It is no income - amount 0, not in the
recurring value or the sums - and shows in the ledger as *Plan given* and in the activity record, with who gave it.
It works on a server with no payment connector too.

What cannot be done silently is giving a *different* plan to somebody a provider is still charging for the old one:
the provider would go on charging the old price. The administrator then has to choose **Cancel their renewal and
give**, and confirm that the person agreed to it (the server refuses without `consent`, and the activity record
keeps that the administrator confirmed it). The renewal is cancelled at the provider through the connector's
`cancelSubscription`; if the connector cannot, the confirmation also asks for the administrator's word that the provider
stopped charging, because Keres cannot know. Giving the plan they already pay for just extends it, and the provider
goes on charging.

## In the app

Only while the server answers and only if it sells plans:

- the server's own screen shows the plan and its dates (for a paid plan, or one an administrator gave, which is shown as a gift) and a **Plan and payment** row;
- that screen lists the plans on sale, lets the person choose how often to pay and a method, follows the payment
  until it is paid, failed or expired, and stops a renewal;
- Settings has **Warn when a payment is due** (on by default): once per paid period the app reminds the person
  that a payment is within 5 days, or overdue. It never repeats and never runs on a timer.

A user working offline, or on a server with no connector, is never shown or asked anything about payments.
