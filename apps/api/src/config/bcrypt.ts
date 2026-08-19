import { env } from './env';

/**
 * Custo de produção em todo lugar, exceto sob teste: um único `registerUser()` em teste de
 * integração hasheia a senha e 8 códigos de recuperação (`RecoveryCodeService.generateCodes`),
 * ~570ms de bcrypt puro a custo 12 - tempo que não valida nada além de "bcrypt funciona". Custo
 * 4 cai isso para ~2ms sem tocar o valor usado em produção.
 */
export const BCRYPT_COST = env.NODE_ENV === 'test' ? 4 : 12;
