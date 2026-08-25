import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * As camadas da API, verificadas em vez de combinadas.
 *
 * A rota lê a requisição, chama um serviço e devolve a resposta. O serviço é quem fala com o
 * banco. Quando a rota monta a própria consulta, a regra passa a existir dentro de um handler
 * HTTP: não dá para reusar em outra rota, nem testar sem levantar servidor - e é assim que
 * duas rotas passam a filtrar "não apagado" de dois jeitos diferentes.
 */

const MODULES_ROOT = resolve(__dirname, '../../src/modules');

function listFiles(directory: string, suffix: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return listFiles(path, suffix);
    return entry.endsWith(suffix) ? [path] : [];
  });
}

const IMPORT = /(?:from|import)\s+['"]([^'"]+)['"]/g;
const routeFiles = listFiles(MODULES_ROOT, '.route.ts');
const relativeOf = (path: string) => relative(MODULES_ROOT, path).split('\\').join('/');

/**
 * Rotas que ainda montam a própria consulta. É dívida conhecida, não licença: a lista só pode
 * encolher, e `toEqual` recusa tanto uma rota nova aqui quanto um nome que ficou para trás
 * depois de a consulta ter descido para um serviço.
 */
const ROUTES_THAT_STILL_QUERY = ['auth/auth.route.ts', 'media/media.route.ts'];

describe('camadas da API', () => {
  it('encontra as rotas dos módulos', () => {
    expect(routeFiles.length).toBeGreaterThan(10);
  });

  it('mantém a consulta ao banco dentro dos serviços', () => {
    const offenders = routeFiles
      .filter((path) =>
        // O sinal é o construtor de consulta. Importar o schema sozinho é outra coisa e
        // continua valendo: `story.route.ts` tira dele os valores do enum para validar o
        // corpo da requisição, sem tocar no banco.
        Array.from(readFileSync(path, 'utf8').matchAll(IMPORT), (match) => match[1]).some(
          (specifier) => /^drizzle-orm(\/|$)/.test(specifier),
        ),
      )
      .map(relativeOf)
      .sort();

    expect(offenders).toEqual([...ROUTES_THAT_STILL_QUERY].sort());
  });
});
