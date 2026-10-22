# Payments: how it works and how to test it end to end

## The three pieces

```
 App / purchase site             Keres server  (apps/api)            Payments service (apps/payments)             Provider
 ─────────────────────           ───────────────────────────          ─────────────────────────────────────         ────────
 picks plan and method   ──────▶ checks price/plan, opens an    ──▶  creates the payment at the provider   ──────▶  PayPal / Stripe
                                 "attempt" (checkout)                 and returns "open this page"                  (sandbox or real)
 opens the provider page ◀────── returns the action (redirect)  ◀──
 pays there (the card never goes                                                                                    charges
 through Keres or the service)
                                 applies the event, extends the  ◀──  reports "payment X happened"          ◀──────  webhook / return
                                 subscription period                  (signed event, POST /api/payments/events)
```

- **Keres never charges and never stores a card.** It keeps only: plan, paid period, status, amount and the provider's references.
- **The payments service is separate** (another process, another port, and in production another machine: `buy.keres.me`). It speaks
  the "connector contract" with Keres (`docs/compliance/payment_connectors.md`) and each provider's API on the other side.
- **Buying in the Android app does not use PayPal/Stripe:** it uses Google Play Billing. The app buys from the store and sends the
  *purchase token* to Keres, Keres asks the service, and the service asks Google. Renewals and cancellations made in the store
  arrive through Google notifications (`/v1/play/notifications`).

## The keys (all 32+ characters, all made up by you)

Two HMAC keys, **different from each other**, one per direction, and each must be identical on both sides:

| Direction | Keres server (`apps/api/.env`) | Service (`apps/payments/.env`) |
| --- | --- | --- |
| Keres → service (`/v1/*`) | `PAYMENT_CONNECTOR_SECRET` | `KERES_CONNECTOR_SECRET` |
| service → Keres (`/api/payments/events`) | `PAYMENT_EVENTS_SECRET` | `KERES_EVENTS_SECRET` |
| Keres → service, Play only (`/v1/play/verify`) | `PAYMENT_PLAY_ENDPOINT_SECRET` | `PLAY_ENDPOINT_SECRET` |
| Google → service (Pub/Sub push) | — | `PLAY_NOTIFICATION_SECRET` (goes in the push URL) |

Addresses: the server points at the service (`PAYMENT_CONNECTOR_URL`) and the service points at the server (`KERES_BASE_URL`).
`PUBLIC_BASE_URL` is the address **of the service itself** as the browser and the provider see it (return pages and webhooks).
Off your own machine everything must be `https`; the clocks on both sides must be right (5-minute tolerance).

## Test everything together, on one machine, with no real provider

```
bun run payments:local            # starts both, creates the Free and Pro plans, keeps running (Ctrl+C stops it)
bun run payments:local --smoke    # starts both, runs the whole flow once and exits (12 checks)
```

What it does (none of this touches your `.env` files):

- server at `http://127.0.0.1:3300` (not 3000, so it can live next to a server you already run), temporary SQLite database,
  administrator `root` / `local-root-password-123`;
- service at `http://127.0.0.1:3101` with the **mock** provider (a fake bank page, no money) and Play in mock mode;
- the six keys above, made up and already matched; plans **Free** (default) and **Pro** (R$ 25/month, R$ 250/year, store product
  `pro_monthly`).

### With your own `.env` files (the test ones already in the repository)

`apps/api/.env` (the `PAYMENT_*` block at the end) and `apps/payments/.env` already hold matched test values. Two commands prove it:

```
bun run payments:env-check                        # reads both files and checks the pair (keys, addresses, mock only on loopback)
bun run payments:local --smoke --env-files        # starts both READING those files and runs the whole flow
```

The second swaps only the database, the media folder and the server port (3300), so it does not touch your API on 3000. For
everyday use: restart your API (it only reads `.env` at startup; the new payment tables are created by the migration at boot) and run
`bun run payments:start` (port 3101). `apps/api/.env` is versioned: only test values belong in it.

### To see it in the interface

1. Run `bun run payments:local` and leave it open.
2. In the app (web/desktop), register a server `http://localhost:3300` (http is accepted on a local machine/network) and create an account.
   Alternative without the app: the purchase site at `http://127.0.0.1:3101`, signing in with that same account.
3. Server screen → **Plan and payment** → choose *Pro*, method *Mock card (test only)* → **Pay**.
4. The "Mock payment" page opens: **Confirm payment**. The app screen switches to "paid" and the plan shows with its date.
5. In the admin panel (`http://127.0.0.1:3300/admin`) → *Payments* shows the subscription and the ledger.

The *Google Play* method appears in the API's list but the web/desktop app hides it (only Android uses it).

## With a real provider (sandbox), without changing code

1. `cp apps/payments/.env.example apps/payments/.env` and fill in the keys from the table (`.env` is in `.gitignore`).
2. PayPal sandbox: `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`, `PAYPAL_SANDBOX=true`, `PAYPAL_WEBHOOK_ID` (webhook pointing to
   `<PUBLIC_BASE_URL>/v1/paypal/webhook`, events `PAYMENT.SALE.COMPLETED` and `BILLING.SUBSCRIPTION.CANCELLED`).
3. Stripe test: `STRIPE_SECRET_KEY` (`sk_test_…`), `STRIPE_WEBHOOK_SECRET` (webhook to `<PUBLIC_BASE_URL>/v1/stripe/webhook`,
   events `checkout.session.completed`, `invoice.payment_succeeded`, `customer.subscription.deleted`).
4. The providers call your service over the internet: use an https tunnel (ngrok, cloudflared) and put its address in
   `PUBLIC_BASE_URL`. Without a webhook the *return* still works (the page the provider sends the person back to), but it is the
   webhook that guarantees renewals.
5. On the server: `PAYMENT_CONNECTOR_URL` = the same public address (or `http://127.0.0.1:3101` if local) and the keys.
6. Real Play: see `apps/payments/README.md` (service account, Pub/Sub topic, closed testing track).

## When something does not work

- **The service does not start:** the message says which variable is missing or shorter than 32 characters; the two HMAC keys being
  equal is also refused.
- **Server says "payments are not enabled":** the connector did not answer. The API log shows `The payment connector is not
  available yet (...)` and retries on its own (2 s, 4 s … 60 s). Common causes: a different key on each side, a wrong port,
  `http` outside localhost (needs `PAYMENT_CONNECTOR_ALLOW_INSECURE=true`).
- **Paid and nothing changed:** the event did not arrive or was refused. In the service look for `refused`/`failed` in the log; in the
  API, `A payment event request was refused (signature|stale|replay…)`. `stale` = clocks differ.
- **The "Pay" button opens an `http` address and nothing happens:** the server refuses `http` redirects by default; in
  development use `PAYMENT_ALLOW_INSECURE_REDIRECTS=true` (`payments:local` already does).
- **"no default plan" shows in the log:** create a plan marked as default (an expired subscription falls back to it; with no default, no limits).
