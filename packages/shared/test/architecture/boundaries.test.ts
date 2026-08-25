import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * O que o `@keres/shared` pode saber.
 *
 * Ele é importado pelo cliente, pela API, pelo admin e pelo site - qualquer coisa que ele
 * conheça de um desses vira dependência dos outros quatro. As duas regras aqui passam hoje;
 * estão escritas para a primeira violação falhar num teste, e não virar hábito.
 */

const ROOT = resolve(__dirname, '../..');
const SKIP = new Set(['node_modules', 'test', 'dist', 'coverage']);

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    if (SKIP.has(entry)) return [];
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return listSourceFiles(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

const IMPORT = /(?:from|import)\s+['"]([^'"]+)['"]/g;
const sourceFiles = listSourceFiles(ROOT);
const relativeOf = (path: string) => relative(ROOT, path).split('\\').join('/');

function importsOf(path: string): string[] {
  return Array.from(readFileSync(path, 'utf8').matchAll(IMPORT), (match) => match[1]);
}

function offenders(forbidden: RegExp, files = sourceFiles): string[] {
  return files
    .flatMap((path) =>
      importsOf(path)
        .filter((specifier) => forbidden.test(specifier))
        .map((specifier) => `${relativeOf(path)} -> ${specifier}`),
    )
    .sort();
}

describe('fronteiras do pacote compartilhado', () => {
  /**
   * Dependência para cima: o compartilhado sabendo de um app faz o pacote deixar de ser
   * compartilhado - e leva o cliente inteiro junto para dentro do build da API.
   */
  it('não importa de nenhum app', () => {
    expect(offenders(/(^|\/)apps\//)).toEqual([]);
  });

  /**
   * `graphs/` calcula posições e devolve SVG como texto. É o que permite os mesmos módulos
   * desenharem na tela do app, na exportação de imagem e num script Node. Um import de React
   * ou de React Native ali dentro amarraria tudo isso a uma árvore de componentes.
   */
  it('mantém os módulos de gráfico livres de React e React Native', () => {
    const graphFiles = sourceFiles.filter((path) => relativeOf(path).startsWith('graphs/'));

    expect(graphFiles.length).toBeGreaterThan(10);
    expect(
      offenders(/^(react|react-native|react-native-.*|expo|expo-.*|@expo\/.*)$/, graphFiles),
    ).toEqual([]);
  });
});
