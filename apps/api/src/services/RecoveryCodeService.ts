import * as bcrypt from 'bcrypt';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { users, userRecoveryCodes } from '../db/schema';

export class InvalidRecoveryCodeError extends Error {
  constructor() {
    super('Invalid username or recovery code.');
    this.name = 'InvalidRecoveryCodeError';
  }
}

/** Sem caracteres ambíguos (0/O, 1/I/L) - o código é lido e digitado à mão. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODES_PER_USER = 8;

const MAX_ATTEMPTS_PER_WINDOW = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

/**
 * Contador de tentativas por usuário, em memória do processo - suficiente para uma API
 * self-hosted de instância única (não sobrevive a restart nem escala pra múltiplas
 * réplicas, mas nenhum outro rate-limit existe no projeto hoje). Sem isto, o endpoint
 * seria o único da API que aceita tentativas ilimitadas sem sessão prévia.
 */
const attemptsByUsername = new Map<string, { count: number; windowStart: number }>();

function registerAttempt(username: string): boolean {
  const now = Date.now();
  const entry = attemptsByUsername.get(username);
  if (!entry || now - entry.windowStart > ATTEMPT_WINDOW_MS) {
    attemptsByUsername.set(username, { count: 1, windowStart: now });
    return true;
  }
  entry.count += 1;
  return entry.count <= MAX_ATTEMPTS_PER_WINDOW;
}

function clearAttempts(username: string): void {
  attemptsByUsername.delete(username);
}

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
        codeHash: await bcrypt.hash(code, 10),
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
    if (!registerAttempt(username)) {
      throw new InvalidRecoveryCodeError();
    }

    const user = await db.query.users.findFirst({ where: eq(users.username, username) });
    if (!user) {
      throw new InvalidRecoveryCodeError();
    }

    const candidates = await db.query.userRecoveryCodes.findMany({
      where: and(eq(userRecoveryCodes.userId, user.id), eq(userRecoveryCodes.isUsed, false)),
    });

    let matched: (typeof candidates)[number] | undefined;
    for (const candidate of candidates) {
      if (await bcrypt.compare(plainCode, candidate.codeHash)) {
        matched = candidate;
        break;
      }
    }

    if (!matched) {
      throw new InvalidRecoveryCodeError();
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
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

    clearAttempts(username);
    return { id: user.id, username: user.username, tag: user.tag };
  }
}

export const recoveryCodeService = new RecoveryCodeService();
