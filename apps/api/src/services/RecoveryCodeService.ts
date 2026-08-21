import { and, eq } from 'drizzle-orm';
import { comparePassword, hashPassword } from '../config/bcrypt';
import { db } from '../db';
import { users, userRecoveryCodes } from '../db/schema';
import { createAttemptLimiter } from '../utils/rateLimiter';

export class InvalidRecoveryCodeError extends Error {
  constructor() {
    super('Invalid username or recovery code.');
    this.name = 'InvalidRecoveryCodeError';
  }
}

/** Sem caracteres ambíguos (0/O, 1/I/L) - o código é lido e digitado à mão. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODES_PER_USER = 8;

/** Sem isto, o endpoint seria o único da API que aceita tentativas ilimitadas sem sessão prévia. */
const recoveryAttemptLimiter = createAttemptLimiter({
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
});

function generatePlainCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  let raw = '';
  for (const byte of bytes) {
    raw += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  }
  return `${raw.slice(0, 5)}-${raw.slice(5, 10)}`;
}

/**
 * Backup codes para recuperar a conta sem saber a senha atual - a alternativa a exigir a
 * senha atual (`UserService.changeOwnPassword`), que derrota o propósito de "esqueci minha
 * senha". Mostrados em texto puro só uma vez (no registro ou ao regenerar); daí em diante
 * só o hash bcrypt de cada um é guardado, igual à senha.
 *
 * Sem tabela indexável por hash (bcrypt sala cada um diferente), a verificação compara o
 * código contra todo código não usado do usuário - aceitável para um lote de 8.
 */
export class RecoveryCodeService {
  /** Gera um novo lote, descartando qualquer código anterior (usado ou não). */
  async generateCodes(userId: string): Promise<string[]> {
    const plainCodes = Array.from({ length: CODES_PER_USER }, generatePlainCode);
    const rows = await Promise.all(
      plainCodes.map(async (code) => ({
        userId,
        codeHash: await hashPassword(code),
      })),
    );

    await db.transaction(async (tx) => {
      await tx.delete(userRecoveryCodes).where(eq(userRecoveryCodes.userId, userId));
      await tx.insert(userRecoveryCodes).values(rows);
    });

    return plainCodes;
  }

  async countRemaining(userId: string): Promise<number> {
    const rows = await db.query.userRecoveryCodes.findMany({
      where: and(eq(userRecoveryCodes.userId, userId), eq(userRecoveryCodes.isUsed, false)),
      columns: { id: true },
    });
    return rows.length;
  }

  /**
   * Consome um código válido e não usado e troca a senha. O código é marcado usado mesmo
   * dentro da mesma transação que a senha, para que uma falha no meio não deixe o código
   * "meio gasto" - ou os dois efeitos acontecem juntos, ou nenhum.
   */
  async redeemCode(
    username: string,
    plainCode: string,
    newPassword: string,
  ): Promise<{ id: string; username: string; tag: string }> {
    if (!recoveryAttemptLimiter.registerAttempt(username)) {
      throw new InvalidRecoveryCodeError();
    }

    // isDeleted excluded here too - otherwise a soft-deleted account could bypass the same
    // restriction on /auth/login simply by resetting its password through this endpoint instead.
    const user = await db.query.users.findFirst({
      where: and(eq(users.username, username), eq(users.isDeleted, false)),
    });
    if (!user) {
      throw new InvalidRecoveryCodeError();
    }

    const candidates = await db.query.userRecoveryCodes.findMany({
      where: and(eq(userRecoveryCodes.userId, user.id), eq(userRecoveryCodes.isUsed, false)),
    });

    let matched: (typeof candidates)[number] | undefined;
    for (const candidate of candidates) {
      if (await comparePassword(plainCode, candidate.codeHash)) {
        matched = candidate;
        break;
      }
    }

    if (!matched) {
      throw new InvalidRecoveryCodeError();
    }

    const hashedPassword = await hashPassword(newPassword);
    await db.transaction(async (tx) => {
      await tx
        .update(userRecoveryCodes)
        .set({ isUsed: true, usedAt: new Date() })
        .where(eq(userRecoveryCodes.id, matched!.id));
      await tx
        .update(users)
        .set({ password: hashedPassword, updatedAt: new Date() })
        .where(eq(users.id, user.id));
    });

    recoveryAttemptLimiter.clearAttempts(username);
    return { id: user.id, username: user.username, tag: user.tag };
  }
}

export const recoveryCodeService = new RecoveryCodeService();
