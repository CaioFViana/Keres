import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export interface Package {
  /** Nome curto, como aparece nos relatórios e nos scripts da raiz (`api:start`). */
  name: string;
  /** Caminho a partir da raiz do repositório. */
  path: string;
}

/**
 * Os pacotes do monorepo, na ordem em que dependem uns dos outros.
 *
 * `shared` primeiro porque todo o resto o importa; o cliente antes do desktop porque o desktop
 * empacota o build web do cliente. Rodar em ordem faz a primeira falha ser a causa, e não uma
 * consequência dela três pacotes adiante.
 */
export const PACKAGES: Package[] = [
  { name: 'shared', path: 'packages/shared' },
  { name: 'client', path: 'apps/client' },
  { name: 'api', path: 'apps/api' },
  { name: 'admin', path: 'apps/admin' },
  { name: 'desktop', path: 'apps/desktop' },
  { name: 'site', path: 'apps/site' },
];

/** Os scripts declarados por um pacote - para pular quem não tem o que está sendo pedido. */
export function scriptsOf(pkg: Package): string[] {
  const manifest = join(repoRoot, pkg.path, 'package.json');
  if (!existsSync(manifest)) return [];
  const parsed = JSON.parse(readFileSync(manifest, 'utf8')) as { scripts?: Record<string, string> };
  return Object.keys(parsed.scripts ?? {});
}

/** Roda um comando na raiz do repositório, herdando a saída. Devolve o código de saída. */
export function run(command: string, args: string[]): number {
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

/** Roda um script de pacote (`bun run --cwd <pacote> <script>`). */
export function runInPackage(pkg: Package, script: string, args: string[] = []): number {
  return run('bun', ['run', '--cwd', pkg.path, script, ...args]);
}
