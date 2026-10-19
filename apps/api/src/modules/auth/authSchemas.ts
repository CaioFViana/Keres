import { t } from 'elysia';

/** Every rejection branch across this file returns exactly this shape. */
export const MessageResponseSchema = t.Object({ message: t.String() });

/** A refusal that carries a fixed code the app acts on (`verification_unavailable`). */
export const CodedMessageResponseSchema = t.Object({
  message: t.String(),
  code: t.Optional(t.String()),
});

/** What the app's one generic verification screen is told (see `AccountVerificationStatusSchema`). */
export const AccountVerificationStatusResponseSchema = t.Object({
  status: t.Union([
    t.Literal('not_required'),
    t.Literal('pending'),
    t.Literal('approved'),
    t.Literal('rejected'),
    t.Literal('expired'),
  ]),
  action: t.Optional(
    t.Union([
      t.Object({ kind: t.Literal('redirect'), url: t.String() }),
      t.Object({ kind: t.Literal('instructions'), title: t.String(), text: t.String() }),
    ]),
  ),
  expiresAt: t.Optional(t.String()),
  reason: t.Optional(t.String()),
  canRetry: t.Optional(t.Boolean()),
});
