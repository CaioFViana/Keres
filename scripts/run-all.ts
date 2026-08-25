import { PACKAGES, run, runInPackage, scriptsOf } from './lib/packages';

/**
 * Roda o mesmo script em todos os pacotes que o declaram.
 *
 *   bun scripts/run-all.ts typecheck
 *
 * Existe para a raiz não ter seis correntes de `bun run --cwd ... && bun run --cwd ...` que
 * ninguém consegue ler nem manter em ordem. Quem não declara o script é pulado - só a `api`
 * tem testes de integração, só o cliente tem `db:generate` - e a primeira falha interrompe:
 * numa cadeia em ordem de dependência, o segundo erro costuma ser consequência do primeiro.
 */
const script = process.argv[2];
if (!script) {
  console.error('Uso: bun scripts/run-all.ts <script>, por exemplo "typecheck".');
  process.exit(1);
}

const targets = PACKAGES.filter((pkg) => scriptsOf(pkg).includes(script));
if (targets.length === 0) {
  console.error(`Nenhum pacote declara o script "${script}".`);
  process.exit(1);
}

for (const pkg of targets) {
  console.log(`\n=== ${pkg.name}: ${script}`);
  const code = runInPackage(pkg, script);
  if (code !== 0) {
    console.error(`\n${pkg.name}: "${script}" falhou (código ${code}).`);
    process.exit(code);
  }
}

// Os scripts do próprio repositório não são um pacote, mas são TypeScript: entram na checagem
// de tipos junto com o resto, senão seriam a única parte do repositório sem rede nenhuma.
if (script === 'typecheck') {
  console.log('\n=== scripts do repositório: typecheck');
  const code = run('bunx', ['tsc', '--noEmit', '-p', 'scripts/tsconfig.json']);
  if (code !== 0) process.exit(code);
}
