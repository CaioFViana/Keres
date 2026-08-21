// apps/api/src/db/schema/tables/userRecoveryCodes.ts
import { boolean, table, text, timestamp, timestampNow } from '../columns';
import { ulid } from 'ulid';
import { users } from './users';

/**
 * Backup codes para recuperar a conta sem a senha atual (ver RecoveryCodeService). Cada
 * usuário tem um lote fixo, gerado no registro e substituível a qualquer momento; código
 * usado nunca é reaproveitado, só marcado `isUsed` para preservar o histórico de quantos
 * restam sem precisar contar linhas deletadas.
 */
export const userRecoveryCodes = table('user_recovery_codes', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => ulid()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  /** bcrypt, nunca o código puro - ver comparação em RecoveryCodeService.redeemCode. */
  codeHash: text('code_hash').notNull(),
  isUsed: boolean('is_used').notNull().default(false),
  usedAt: timestamp('used_at'),
  createdAt: timestampNow('created_at'),
});
