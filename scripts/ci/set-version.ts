import { assertSemver, readReleaseName, setAppRelease, setPackageVersions } from '../lib/version';

/**
 * Escreve a versão vinda da tag do Git em todo arquivo que declara uma.
 *
 *   bun scripts/ci/set-version.ts 1.2.3
 *
 * Sem o "v" da tag - o workflow tira antes de chamar (ver `.github/workflows/release.yml`).
 * Assim a tag é a única fonte da verdade, em vez de cada arquivo depender de alguém ter
 * lembrado de subir o número à mão.
 */
const version = process.argv[2];
if (!version) {
  console.error(`Uso: bun scripts/ci/set-version.ts <versão>, por exemplo "1.2.3".`);
  process.exit(1);
}

try {
  assertSemver(version);
  setPackageVersions(version);
  // A CI tira da tag só a versão. O nome da release continua sendo o que foi commitado por
  // `version:set`, e todo artefato passa a reportar a versão da tag.
  setAppRelease(version, readReleaseName());
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
