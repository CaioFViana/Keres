export type LauncherArgs =
  | { kind: 'help' }
  | { kind: 'version' }
  | {
      kind: 'backup';
      configPath?: string;
      destinationParent?: string;
    }
  | {
      kind: 'run';
      setup: boolean;
      nonInteractive: boolean;
      configPath?: string;
    };

export function parseLauncherArgs(argv: string[]): LauncherArgs {
  if (argv.includes('--help') || argv.includes('-h')) {
    return { kind: 'help' };
  }
  if (argv.includes('--version') || argv.includes('-v')) {
    return { kind: 'version' };
  }

  let configPath: string | undefined;
  let setup = false;
  let nonInteractive = false;
  let backup = false;
  let destinationParent: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--setup') {
      setup = true;
      continue;
    }
    if (token === '--non-interactive') {
      nonInteractive = true;
      continue;
    }
    if (token === '--backup') {
      backup = true;
      const next = argv[index + 1];
      if (next && !next.startsWith('-')) {
        destinationParent = next;
        index += 1;
      }
      continue;
    }
    if (token.startsWith('--backup=')) {
      backup = true;
      destinationParent = token.slice('--backup='.length);
      continue;
    }
    if (token === '--config') {
      const next = argv[index + 1];
      if (!next || next.startsWith('-')) {
        throw new Error('--config requires a path');
      }
      configPath = next;
      index += 1;
      continue;
    }
    if (token.startsWith('--config=')) {
      configPath = token.slice('--config='.length);
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  if (backup) {
    if (setup) {
      throw new Error('--backup cannot be combined with --setup');
    }
    return { kind: 'backup', configPath, destinationParent };
  }

  return { kind: 'run', setup, nonInteractive, configPath };
}
