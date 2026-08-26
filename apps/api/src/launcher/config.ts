import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import * as crypto from 'node:crypto';
import * as path from 'node:path';
import type { LauncherLanguage } from './locales';
import { CONFIG_FILE_NAME, SECRETS_FILE_NAME, secretsPathFor } from './paths';

export interface LauncherS3Config {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  prefix: string;
  forcePathStyle: boolean;
}

export interface LauncherPublicConfig {
  language: LauncherLanguage;
  databaseDriver: 'sqlite' | 'postgres';
  databaseUrl: string;
  mediaStorageDriver: 'local' | 's3';
  mediaStoragePath?: string;
  host: string;
  port: string;
  dataDir: string;
  rootAdminUsername?: string;
  mediaS3?: LauncherS3Config;
}

export interface LauncherSecrets {
  jwtSecret: string;
  jwtSecretRefresh: string;
  rootAdminPassword?: string;
}

export function generateSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generatePassword(): string {
  return crypto.randomBytes(12).toString('base64url');
}

export function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

export function writeRestrictedJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8' });
  if (process.platform !== 'win32') {
    try {
      chmodSync(filePath, 0o600);
    } catch {
      // Better to write with broad permissions than to fail the boot on odd filesystems.
    }
  }
}

export function loadPublicConfig(configPath: string): LauncherPublicConfig {
  return readJsonFile<LauncherPublicConfig>(configPath);
}

export function loadSecrets(dataDir: string): LauncherSecrets {
  return readJsonFile<LauncherSecrets>(secretsPathFor(dataDir));
}

export function saveLauncherFiles(
  config: LauncherPublicConfig,
  secrets: LauncherSecrets,
): { configPath: string; secretsPath: string } {
  const configPath = path.join(config.dataDir, CONFIG_FILE_NAME);
  const secretsPath = path.join(config.dataDir, SECRETS_FILE_NAME);
  writeRestrictedJson(configPath, config);
  writeRestrictedJson(secretsPath, secrets);
  return { configPath, secretsPath };
}

export function applyLauncherEnv(config: LauncherPublicConfig, secrets: LauncherSecrets): void {
  process.env.DATABASE_DRIVER = config.databaseDriver;
  process.env.DATABASE_URL = config.databaseUrl;
  process.env.JWT_SECRET = secrets.jwtSecret;
  process.env.JWT_SECRET_REFRESH = secrets.jwtSecretRefresh;
  process.env.PORT = config.port;
  process.env.HOST = config.host;
  process.env.NODE_ENV ??= 'production';
  process.env.MEDIA_STORAGE_DRIVER = config.mediaStorageDriver;
  if (config.mediaStorageDriver === 'local' && config.mediaStoragePath) {
    process.env.MEDIA_STORAGE_PATH = config.mediaStoragePath;
  }
  if (config.mediaStorageDriver === 's3' && config.mediaS3) {
    const s3 = config.mediaS3;
    process.env.MEDIA_S3_BUCKET = s3.bucket;
    process.env.MEDIA_S3_ACCESS_KEY_ID = s3.accessKeyId;
    process.env.MEDIA_S3_SECRET_ACCESS_KEY = s3.secretAccessKey;
    process.env.MEDIA_S3_REGION = s3.region;
    process.env.MEDIA_S3_PREFIX = s3.prefix;
    process.env.MEDIA_S3_FORCE_PATH_STYLE = s3.forcePathStyle ? 'true' : 'false';
    if (s3.endpoint) {
      process.env.MEDIA_S3_ENDPOINT = s3.endpoint;
    }
  }
  if (config.rootAdminUsername && secrets.rootAdminPassword) {
    process.env.ROOT_ADMIN_USERNAME = config.rootAdminUsername;
    process.env.ROOT_ADMIN_PASSWORD = secrets.rootAdminPassword;
  }
}
