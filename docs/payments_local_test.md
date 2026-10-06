# Pagamentos: como funciona e como testar tudo junto

## As três peças

```
 App / site de compra            Servidor Keres  (apps/api)           Serviço de pagamentos (apps/payments)        Provedor
 ─────────────────────           ───────────────────────────          ─────────────────────────────────────         ────────
 escolhe plano e método  ──────▶ checa preço/plano, abre uma     ──▶  cria o pagamento no provedor        ──────▶  PayPal / Stripe
                                 "tentativa" (checkout)               e devolve "abra esta página"                  (sandbox ou real)
 abre a página do provedor ◀──── devolve a ação (redirect)       ◀──
 paga lá (cartão nunca passa                                                                                        cobra
 pela Keres nem pelo serviço)
                                 aplica o evento, estende o      ◀──  avisa "pagamento X aconteceu"        ◀──────  webhook / retorno
                                 período da assinatura                (evento assinado, POST /api/payments/events)
```

- **Keres nunca cobra e nunca guarda cartão.** Só guarda: plano, período pago, status, valor e as referências do provedor.
- **O serviço de pagamentos é separado** (outro processo, outra porta, em produção outra máquina: `buy.keres.me`). Ele fala o
  "contrato do conector" com a Keres (`docs/payment_connectors.md`) e a API de cada provedor do outro lado.
- **Compra no app Android não usa PayPal/Stripe:** usa Google Play Billing. O app compra na loja, manda o *purchase token* à
  Keres, a Keres pergunta ao serviço, o serviço pergunta ao Google. Renovações e cancelamentos feitos na loja chegam por
  notificações do Google (`/v1/play/notifications`).

## As chaves (todas com 32+ caracteres, todas inventadas por você)

Duas chaves HMAC, **diferentes entre si**, uma por direção, e cada uma precisa ser igual dos dois lados:

| Direção | Servidor Keres (`apps/api/.env`) | Serviço (`apps/payments/.env`) |
| --- | --- | --- |
| Keres → serviço (`/v1/*`) | `PAYMENT_CONNECTOR_SECRET` | `KERES_CONNECTOR_SECRET` |
| serviço → Keres (`/api/payments/events`) | `PAYMENT_EVENTS_SECRET` | `KERES_EVENTS_SECRET` |
| Keres → serviço, só Play (`/v1/play/verify`) | `PAYMENT_PLAY_ENDPOINT_SECRET` | `PLAY_ENDPOINT_SECRET` |
| Google → serviço (Pub/Sub push) | — | `PLAY_NOTIFICATION_SECRET` (vai na URL do push) |

Endereços: o servidor aponta para o serviço (`PAYMENT_CONNECTOR_URL`) e o serviço aponta para o servidor (`KERES_BASE_URL`).
`PUBLIC_BASE_URL` é o endereço **do próprio serviço** como o navegador e o provedor o enxergam (páginas de retorno e webhooks).
Fora do próprio computador tudo precisa ser `https`; os relógios dos dois lados precisam estar certos (tolerância de 5 min).

## Testar tudo junto, em uma máquina, sem provedor real

```
bun run payments:local            # sobe os dois, cria os planos Free e Pro, fica rodando (Ctrl+C encerra)
bun run payments:local --smoke    # sobe os dois, roda o fluxo inteiro uma vez e sai (12 checagens)
```

O que ele faz (nada disso mexe nos seus `.env`):

- servidor em `http://127.0.0.1:3300` (não 3000, para conviver com um servidor que você já tenha), banco SQLite temporário,
  administrador `root` / `local-root-password-123`;
- serviço em `http://127.0.0.1:3101` com o provedor **mock** (uma página de banco falsa, sem dinheiro) e Play em modo mock;
- as seis chaves acima, inventadas, já casadas; planos **Free** (padrão) e **Pro** (R$ 25/mês, R$ 250/ano, produto de loja
  `pro_monthly`).

### Com os seus `.env` (os de teste que já estão no repositório)

`apps/api/.env` (bloco `PAYMENT_*` no fim) e `apps/payments/.env` já têm valores de teste casados. Dois comandos provam isso:

```
bun run payments:env-check                        # lê os dois arquivos e confere o par (chaves, endereços, mock só em loopback)
bun run payments:local --smoke --env-files        # sobe os dois LENDO esses arquivos e roda o fluxo inteiro
```

O segundo troca só banco, pasta de mídia e a porta do servidor (3300), para não encostar na sua API da 3000. Para usar no dia a dia:
reinicie a sua API (ela só lê o `.env` ao subir; as tabelas novas de pagamento são criadas pela migração no boot) e rode
`bun run payments:start` (porta 3101). O `apps/api/.env` é versionado: só valores de teste cabem nele.

### Para ver na interface


1. `bun run payments:local` e deixe aberto.
2. No app (web/desktop), cadastre um servidor `http://localhost:3300` (http é aceito em máquina/rede local) e crie uma conta.
   Alternativa sem o app: o site de compra em `http://127.0.0.1:3101`, entrando com essa mesma conta.
3. Tela do servidor → **Plano e pagamento** → escolha *Pro*, método *Mock card (test only)* → **Pagar**.
4. A página "Mock payment" abre: **Confirm payment**. A tela do app passa para "pago" e o plano aparece com a data.
5. No painel admin (`http://127.0.0.1:3300/admin`) → *Payments* mostra a assinatura e o extrato.

O método *Google Play* aparece na lista da API mas o app web/desktop o esconde (só o Android o usa).

## Com provedor de verdade (sandbox), sem alterar o código

1. `cp apps/payments/.env.example apps/payments/.env` e preencha as chaves da tabela (o `.env` está no `.gitignore`).
2. PayPal sandbox: `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`, `PAYPAL_SANDBOX=true`, `PAYPAL_WEBHOOK_ID` (webhook apontando para
   `<PUBLIC_BASE_URL>/v1/paypal/webhook`, eventos `PAYMENT.SALE.COMPLETED` e `BILLING.SUBSCRIPTION.CANCELLED`).
3. Stripe test: `STRIPE_SECRET_KEY` (`sk_test_…`), `STRIPE_WEBHOOK_SECRET` (webhook para `<PUBLIC_BASE_URL>/v1/stripe/webhook`,
   eventos `checkout.session.completed`, `invoice.payment_succeeded`, `customer.subscription.deleted`).
4. Os provedores chamam o seu serviço pela internet: use um túnel https (ngrok, cloudflared) e ponha o endereço dele em
   `PUBLIC_BASE_URL`. Sem webhook ainda funciona o *retorno* (a página para onde o provedor devolve a pessoa), mas é o webhook
   que garante renovações.
5. No servidor: `PAYMENT_CONNECTOR_URL` = o mesmo endereço público (ou `http://127.0.0.1:3101` se for local) e as chaves.
6. Play de verdade: ver `apps/payments/README.md` (conta de serviço, tópico Pub/Sub, faixa de teste fechado).

## Quando algo não funciona

- **O serviço não sobe:** a mensagem diz qual variável falta ou tem menos de 32 caracteres; as duas chaves HMAC iguais também
  são recusadas.
- **Servidor diz "payments are not enabled":** o conector não respondeu. O log da API mostra `The payment connector is not
  available yet (...)` e tenta de novo sozinho (2 s, 4 s … 60 s). Causas comuns: chave diferente nos dois lados, porta errada,
  `http` fora de localhost (precisa `PAYMENT_CONNECTOR_ALLOW_INSECURE=true`).
- **Pagou e nada mudou:** o evento não chegou ou foi recusado. No serviço procure `refused`/`failed` no log; na API,
  `A payment event request was refused (signature|stale|replay…)`. `stale` = relógios diferentes.
- **O botão "Pagar" abre um endereço `http` e nada acontece:** o servidor recusa redirecionamento `http` por padrão; em
  desenvolvimento use `PAYMENT_ALLOW_INSECURE_REDIRECTS=true` (o `payments:local` já usa).
- **Aparece "no default plan" no log:** crie um plano marcado como padrão (assinatura vencida cai nele; sem padrão, sem limites).
