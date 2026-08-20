import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { parseLauncherArgs } from './args';
import {
  applyLauncherEnv,
  loadPublicConfig,
  loadSecrets,
  saveLauncherFiles,
  type LauncherPublicConfig,
  type LauncherSecrets,
} from './config';
import { describeLanAddresses, startLanAddressHeartbeat } from './heartbeat';
import { createTranslator } from './i18n';
import { createStdio, type LauncherIo } from './io';
import { detectSystemLanguage } from './language';
import { configPathFor, defaultDataDir } from './paths';
import { assertDriverNotChanged, runSetupWizard } from './wizard';
import apiPackage from '../../package.json';

const PACKAGE_VERSION = apiPackage.version;

function resolveConfigPath(configPath: string | undefined): string {
  return path.resolve(configPath ?? configPathFor(defaultDataDir()));
}

export async function runLauncher(
  argv: string[],
  options: {
    io?: LauncherIo;
    boot?: () => Promise<void>;
    version?: string;
  } = {},
): Promise<void> {
  const io = options.io ?? createStdio();
  const version = options.version ?? PACKAGE_VERSION;

  let args;
  try {
    args = parseLauncherArgs(argv);
  } catch (error) {
    io.print(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
    return;
  }

  const systemLanguage = detectSystemLanguage();
  const t0 = createTranslator(systemLanguage);

  if (args.kind === 'help') {
    io.print(t0('help'));
    return;
  }
  if (args.kind === 'version') {
    io.print(t0('version', { version }));
    return;
  }

  const configFilePath = resolveConfigPath(args.configPath);
  const existing = existsSync(configFilePath) ? loadPublicConfig(configFilePath) : undefined;
  const needsWizard = args.setup || !existing;

  if (needsWizard && (args.nonInteractive || !io.isInteractive())) {
    io.print(t0('missing_config'));
    process.exitCode = 1;
    return;
  }

  let publicConfig: LauncherPublicConfig;
  let secrets: LauncherSecrets;

  if (needsWizard) {
    const result = await runSetupWizard({
      io,
      translateFor: createTranslator,
      existing,
    });
    if (existing) {
      assertDriverNotChanged(existing, result.config, createTranslator(result.config.language));
      const previousSecrets = loadSecrets(existing.dataDir);
      result.secrets.jwtSecret = previousSecrets.jwtSecret;
      result.secrets.jwtSecretRefresh = previousSecrets.jwtSecretRefresh;
    }
    const saved = saveLauncherFiles(result.config, result.secrets);
    publicConfig = result.config;
    secrets = result.secrets;
    const t = createTranslator(publicConfig.language);
    io.print(t('saved', { path: saved.configPath }));
    if (result.generatedPassword) {
      io.print(t('generated_password', { password: result.generatedPassword }));
    }
  } else {
    if (!existing) {
      io.print(t0('missing_config'));
      process.exitCode = 1;
      return;
    }
    publicConfig = existing;
    secrets = loadSecrets(publicConfig.dataDir);
  }

  const t = createTranslator(publicConfig.language);
  applyLauncherEnv(publicConfig, secrets);
  process.env.SERVER_VERSION = version;
  io.print(t('starting'));

  const boot =
    options.boot ??
    (async () => {
      const { bootAndListen } = await import('../boot');
      await bootAndListen({
        onListening: ({ port }) => {
          const localUrl = `http://127.0.0.1:${port}`;
          io.print(t('listening', { url: localUrl }));
          io.print(t('admin', { url: `${localUrl}/admin` }));
          io.print(t('swagger', { url: `${localUrl}/swagger` }));
          io.print(t('data_dir', { path: publicConfig.dataDir }));
          io.print(t('backup_hint'));
          for (const line of describeLanAddresses(publicConfig.port, publicConfig.host, t)) {
            io.print(line);
          }
          io.print(t('stop_hint'));
          startLanAddressHeartbeat({
            port: publicConfig.port,
            host: publicConfig.host,
            t,
            print: (message) => io.print(message),
          });
        },
      });
    });

  try {
    await boot();
  } catch (error) {
    io.print(t('fatal', { message: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 1;
  }
}

export function launcherVersion(): string {
  return PACKAGE_VERSION;
}
