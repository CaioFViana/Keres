import * as path from 'node:path';
import type { Translate } from './i18n';
import type { LauncherIo } from './io';
import type { LauncherPublicConfig, LauncherSecrets } from './config';
import { generatePassword, generateSecret } from './config';
import { detectSystemLanguage } from './language';
import type { LauncherLanguage } from './locales';
import { defaultDataDir, defaultMediaPathFor, sqliteUrlFor } from './paths';

export function choiceMenuLines(
  t: Translate,
  title: string,
  option1: string,
  option2: string,
  fallback: '1' | '2',
): string[] {
  const mark = (which: '1' | '2') => (which === fallback ? `  ${t('default_marker')}` : '');
  return [title, `  1. ${option1}${mark('1')}`, `  2. ${option2}${mark('2')}`];
}

async function askChoice(
  io: LauncherIo,
  t: Translate,
  title: string,
  option1: string,
  option2: string,
  fallback: '1' | '2',
): Promise<'1' | '2'> {
  for (;;) {
    for (const line of choiceMenuLines(t, title, option1, option2, fallback)) {
      io.print(line);
    }
    const raw = (await io.prompt(t('choice_prompt'))) || fallback;
    if (raw === '1' || raw === '2') {
      return raw;
    }
    io.print(t('invalid_choice'));
  }
}

async function askValue(
  io: LauncherIo,
  t: Translate,
  question: string,
  fallback?: string,
): Promise<string> {
  for (;;) {
    io.print(question);
    if (fallback) {
      io.print(`  ${t('default_value', { value: fallback })}`);
    }
    const raw =
      (await io.prompt(fallback ? t('value_prompt') : t('input_prompt'))) || fallback || '';
    if (raw.length > 0) {
      return raw;
    }
    io.print(t('required'));
  }
}

export async function runSetupWizard(options: {
  io: LauncherIo;
  translateFor: (language: LauncherLanguage) => Translate;
  existing?: LauncherPublicConfig;
}): Promise<{
  config: LauncherPublicConfig;
  secrets: LauncherSecrets;
  generatedPassword?: string;
}> {
  const io = options.io;
  let language = options.existing?.language ?? detectSystemLanguage();
  let t = options.translateFor(language);

  const languageChoice = await askChoice(
    io,
    t,
    t('language_title'),
    t('language_en'),
    t('language_pt'),
    language === 'pt' ? '2' : '1',
  );
  language = languageChoice === '2' ? 'pt' : 'en';
  t = options.translateFor(language);

  const databaseChoice = await askChoice(
    io,
    t,
    t('database_title'),
    t('database_sqlite'),
    t('database_postgres'),
    options.existing?.databaseDriver === 'postgres' ? '2' : '1',
  );
  const databaseDriver = databaseChoice === '2' ? 'postgres' : 'sqlite';
  if (databaseDriver === 'postgres') {
    io.print(t('postgres_needed'));
  }

  const dataDir = path.resolve(
    await askValue(io, t, t('data_dir_prompt'), options.existing?.dataDir ?? defaultDataDir()),
  );

  let databaseUrl: string;
  if (databaseDriver === 'sqlite') {
    databaseUrl = sqliteUrlFor(dataDir);
  } else {
    databaseUrl = await askValue(io, t, t('postgres_url_prompt'), options.existing?.databaseUrl);
  }

  const storageChoice = await askChoice(
    io,
    t,
    t('storage_title'),
    t('storage_local'),
    t('storage_s3'),
    options.existing?.mediaStorageDriver === 's3' ? '2' : '1',
  );
  const mediaStorageDriver = storageChoice === '2' ? 's3' : 'local';

  let mediaStoragePath: string | undefined;
  let mediaS3: LauncherPublicConfig['mediaS3'];
  if (mediaStorageDriver === 'local') {
    mediaStoragePath = defaultMediaPathFor(dataDir);
  } else {
    mediaS3 = {
      bucket: await askValue(io, t, t('s3_bucket'), options.existing?.mediaS3?.bucket),
      accessKeyId: await askValue(
        io,
        t,
        t('s3_access_key'),
        options.existing?.mediaS3?.accessKeyId,
      ),
      secretAccessKey: await askValue(
        io,
        t,
        t('s3_secret'),
        options.existing?.mediaS3?.secretAccessKey,
      ),
      region: await askValue(
        io,
        t,
        t('s3_region'),
        options.existing?.mediaS3?.region ?? 'us-east-1',
      ),
      prefix: options.existing?.mediaS3?.prefix ?? 'keres',
      forcePathStyle: options.existing?.mediaS3?.forcePathStyle ?? false,
    };
    io.print(t('s3_endpoint'));
    const endpoint = await io.prompt(t('value_prompt'));
    if (endpoint) {
      mediaS3.endpoint = endpoint;
    }
  }

  const port = await askValue(io, t, t('port_prompt'), options.existing?.port ?? '3000');
  const bindChoice = await askChoice(
    io,
    t,
    t('bind_title'),
    t('bind_localhost'),
    t('bind_lan'),
    options.existing?.host === '0.0.0.0' ? '2' : '1',
  );
  if (bindChoice === '2') {
    io.print(t('bind_lan_note'));
  }
  const host = bindChoice === '2' ? '0.0.0.0' : '127.0.0.1';

  const rootAdminUsername = await askValue(
    io,
    t,
    t('admin_user_prompt'),
    options.existing?.rootAdminUsername ?? 'root',
  );
  io.print(t('admin_password_prompt'));
  const typedPassword = await io.prompt(t('input_prompt'));
  let rootAdminPassword = typedPassword;
  let generatedPassword: string | undefined;
  if (!rootAdminPassword) {
    generatedPassword = generatePassword();
    rootAdminPassword = generatedPassword;
  }

  const config: LauncherPublicConfig = {
    language,
    databaseDriver,
    databaseUrl,
    mediaStorageDriver,
    mediaStoragePath,
    host,
    port,
    dataDir,
    rootAdminUsername,
    mediaS3,
  };
  const secrets: LauncherSecrets = {
    jwtSecret: generateSecret(),
    jwtSecretRefresh: generateSecret(),
    rootAdminPassword,
  };

  return { config, secrets, generatedPassword };
}

export function assertDriverNotChanged(
  existing: LauncherPublicConfig,
  next: LauncherPublicConfig,
  t: Translate,
): void {
  if (existing.databaseDriver !== next.databaseDriver) {
    throw new Error(t('driver_locked', { current: existing.databaseDriver }));
  }
}
