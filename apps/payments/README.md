# Keres payments microservice

The official payment service for keres.me. It speaks the connector contract
(`docs/payment_connectors.md`) to a Keres server on one side, and PayPal,
Google Pay (through Stripe Checkout) and Google Play Billing on the other.

It ships **alone**: its own image (`apps/payments/Dockerfile`), its own port,
its own compose file. It is deliberately not part of the `keres servers`
bundle (`bun run --cwd apps/api build`) nor of the API image - a webhook flood
or a provider hiccup must never touch stories, and this host holds no story
database at all.

## Running it

```
cp apps/payments/.env.example apps/payments/.env
# fill in the secrets, then:
docker compose -f apps/payments/docker-compose.yml up -d --build
```

Local development without Docker:

```
bun install
bun run --cwd apps/payments dev
```

The Keres server points at it with, in its own `.env`:

```
PAYMENT_CONNECTOR_URL=https://buy.keres.me
PAYMENT_CONNECTOR_SECRET=<same as KERES_CONNECTOR_SECRET here>
PAYMENT_EVENTS_SECRET=<same as KERES_EVENTS_SECRET here>
```

Behind nginx, see `apps/payments/nginx.buy-keres-me.conf.example` (`buy.keres.me`).

## What it implements

| Method id   | Provider                       | Recurring | Status | Cancel |
| ----------- | ------------------------------ | --------- | ------ | ------ |
| `paypal`    | PayPal Subscriptions           | yes       | yes    | yes    |
| `googlepay` | Google Pay via Stripe Checkout | yes       | yes    | yes    |

Mobile apps do not use either: the Play Store requires Google Play Billing for
digital goods. The app buys with the Play SDK and sends the purchase token to
`POST /v1/play/verify` (bearer `PLAY_ENDPOINT_SECRET`); the service asks
Google whether the purchase is real and reports `payment.succeeded` to Keres.
Mock mode is opt-in and off by default: `PLAY_MOCK=true` accepts any token -
homologation only, never production.

A provider whose keys are absent is not registered: its method is simply not
listed, and checkouts naming it are refused. With no provider at all the
service still answers `/v1/info` (empty methods) and the health check.

While `PLAY_ENDPOINT_SECRET` is set, `/v1/methods` also lists `playbilling` (`flow: 'native'`,
`store: 'play'`): it is not a provider - the Android app buys through the Play SDK and only the
token is verified at `POST /v1/play/verify` - so checkouts naming it are refused. The Android app
offers only that method and hides the web ones; web and desktop hide it.

## Selling in the Android app (Google Play Billing)

The web providers never run inside the app: the Play Store requires Play Billing for digital goods.
The round trip:

1. Play Console: one subscription product per plan and period (e.g. `plus_monthly`), with a base
   plan and an offer. The administrator copies each product id onto its tier
   (`playMonthlyProductId` / `playYearlyProductId`, in the admin tiers page).
2. The Android app (a dev build or production - never Expo Go) opens the Play purchase sheet for
   that product id, takes the purchase token, and calls `POST /api/payments/play/verify`.
3. The Keres server checks the plan, the price and the product itself, opens a native attempt
   (no provider page), and asks this service at `POST /v1/play/verify` (bearer
   `PLAY_ENDPOINT_SECRET` - the server also holds it as `PAYMENT_PLAY_ENDPOINT_SECRET`).
4. This service checks the token with Google (and that the token is really for the named product),
   reports `payment.succeeded` naming the attempt, and the server grants the plan.
5. The app finishes the purchase with the store only after the server confirmed it; unfinished
   purchases are reconciled on the plan screen so Google never refunds them.

Live verification needs a service-account key with the Android Publisher scope
(`PLAY_SERVICE_ACCOUNT_JSON`); `PLAY_MOCK=true` accepts any token - homologation only, never
production.

**Renewals and store-side cancellations** arrive by Google's real-time developer notifications, not
by the app: without them a subscription that renews while the app is closed lapses on Keres. Set
them up once:

1. Play Console > Monetization setup > Real-time developer notifications: create a Pub/Sub topic
   (grant `google-play-developer-notifications@system.gserviceaccount.com` the Publisher role).
2. Pub/Sub: a **push** subscription on that topic to
   `https://buy.keres.me/v1/play/notifications?token=<PLAY_NOTIFICATION_SECRET>`.
3. Set `PLAY_NOTIFICATION_SECRET` (32+ characters) here. The query string is the secret, so do not
   log it at the proxy.

Each push is only a pointer: the service asks Google about the token before reporting anything.

## Homologation checklist (needs real PSP accounts)

1. PayPal sandbox: create a checkout, approve it, confirm `payment.succeeded`
   reaches Keres (`/api/payments/events` answers 200) and the plan applies.
2. PayPal sandbox webhooks: same flow without opening the return page.
3. Stripe test mode: Google Pay button in the Checkout Session, `invoice.payment_succeeded`
   renews, deleting the subscription reports `subscription.canceled`.
4. Play Billing: closed-testing track purchase (mock off by default), relay grants the plan;
   a token for another product with this product's id is refused; a grace-period subscription
   counts as paid, held/paused/cancelled/expired do not.
5. Play notifications: send a test from Play Console, renew a test subscription with the app closed
   and confirm `payment.succeeded` reaches Keres; cancel it in the Play Store and confirm
   `subscription.canceled`.
6. A first PayPal and a first Stripe payment each grant **one** period (not two), and cancelling a
   PayPal and a Stripe subscription from the app ends each at its own provider.
7. Key rotation: set `*_PREVIOUS`, switch the primary, remove the previous.
