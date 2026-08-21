import bcrypt from 'bcryptjs';
import { env } from './env';

/**
 * Custo de produção em todo lugar, exceto sob teste: um único `registerUser()` em teste de
 * integração hasheia a senha e 8 códigos de recuperação (`RecoveryCodeService.generateCodes`),
 * ~570ms a custo 12 - tempo que não valida nada além de "bcrypt funciona". Custo 4 cai isso
 * para ~2ms sem tocar o valor usado em produção.
 *
 * `bcryptjs` (JS puro) em vez do addon nativo `bcrypt`: o `bun build --compile` do Keres
 * Server precisa carregar o módulo no runner do GitHub Actions (Node 24 / ABI 137 no
 * Windows), e o nativo não publica prebuild para essa combinação. Os hashes `$2b$` são
 * os mesmos - senhas já gravadas continuam válidas.
 */
export const BCRYPT_COST = env.NODE_ENV === 'test' ? 4 : 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export function comparePassword(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}
