import * as dotenv from 'dotenv';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// Independente do diretório em que `bun run` foi chamado; o `.env` da API fica em apps/api.
const environmentDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(environmentDirectory, '..', '..', '.env') });

// Docker Compose expande variáveis não configuradas como string vazia. Para os campos S3
// opcionais, vazio deve significar "não configurado", não um endpoint/segredo inválido no
// modo local.
const optionalEnvironmentString = z.preprocess(
  (value) => value === '' ? undefined : value,
  z.string().min(1).optional(),
);

const envSchema = z.object({
  DATABASE_URL: z.url(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  JWT_SECRET_REFRESH: z.string().min(32, 'JWT_SECRET_REFRESH must be at least 32 characters long'),
  PORT: z.string().optional().default('3000'),
  SERVER_VERSION: z.string().optional().default('1.0.0'),
  NODE_ENV: z.string().optional().default("development"),
  /** Backend físico da galeria. Não altere em um banco que já possua mídia sem migrá-la. */
  MEDIA_STORAGE_DRIVER: z.enum(['local', 's3']).optional().default('local'),
  /** Raiz onde os arquivos de mídia da galeria são gravados (endereçados por hash). */
  MEDIA_STORAGE_PATH: z.string().optional().default('./media-storage'),
  /** Endpoint opcional para provedores S3 compatíveis; ausente usa o endpoint da AWS. */
  MEDIA_S3_ENDPOINT: z.preprocess((value) => value === '' ? undefined : value, z.url().optional()),
  MEDIA_S3_REGION: z.string().min(1).optional().default('us-east-1'),
  MEDIA_S3_BUCKET: optionalEnvironmentString,
  MEDIA_S3_ACCESS_KEY_ID: optionalEnvironmentString,
  MEDIA_S3_SECRET_ACCESS_KEY: optionalEnvironmentString,
  MEDIA_S3_PREFIX: z.string().optional().default('keres'),
  MEDIA_S3_FORCE_PATH_STYLE: z.enum(['true', 'false']).optional().default('false').transform((value) => value === 'true'),
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

if (env.MEDIA_STORAGE_DRIVER === 's3') {
  const missing = [
    ['MEDIA_S3_BUCKET', env.MEDIA_S3_BUCKET],
    ['MEDIA_S3_ACCESS_KEY_ID', env.MEDIA_S3_ACCESS_KEY_ID],
    ['MEDIA_S3_SECRET_ACCESS_KEY', env.MEDIA_S3_SECRET_ACCESS_KEY],
  ].filter(([, value]) => !value).map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`MEDIA_STORAGE_DRIVER=s3 requires: ${missing.join(', ')}.`);
  }
}
