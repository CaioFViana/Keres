import * as dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: '../../.env' });

const envSchema = z.object({
  DATABASE_URL: z.url(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  JWT_SECRET_REFRESH: z.string().min(32, 'JWT_SECRET_REFRESH must be at least 32 characters long'),
  PORT: z.string().optional().default('3000'),
  SERVER_VERSION: z.string().optional().default('1.0.0'),
  NODE_ENV: z.string().optional().default("development"),
  /** Raiz onde os arquivos de mídia da galeria são gravados (endereçados por hash). */
  MEDIA_STORAGE_PATH: z.string().optional().default('./media-storage'),
  /** Teto por arquivo. Vídeo de celular passa fácil de 20 MB, daí o padrão de 50 MB. */
  MEDIA_MAX_BYTES: z.coerce.number().int().positive().optional().default(50 * 1024 * 1024),
  /**
   * Credenciais do admin "root", reconciliadas no banco a cada boot (ver `reconcileRootAdmin`
   * em `index.ts`). Resolve o problema de "e se ninguém for admin": em vez de um script de
   * bootstrap que só roda uma vez, esta conta é recriada/corrigida (isAdmin sempre forçado
   * para true, senha sempre re-hasheada a partir do valor atual da env) toda vez que a API
   * sobe. Ambas opcionais - se não definidas, a reconciliação é simplesmente pulada.
   */
  ROOT_ADMIN_USERNAME: z.string().min(1).optional(),
  ROOT_ADMIN_PASSWORD: z.string().min(8).optional(),
  /**
   * Valor para o qual o painel admin reseta a senha de um usuário (botão "Reset password").
   * Sem validação de tamanho mínimo de propósito: é uma escolha do operador via env, não uma
   * senha que um usuário está cadastrando - o schema não deveria opinar sobre ela.
   */
  DEFAULT_PASSWORD_RESET_VALUE: z.string().min(1).optional().default('abc123'),
});

export const env = envSchema.parse(process.env);
