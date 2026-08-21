import * as path from 'path';

/**
 * Resolução de caminho do processo main, isolada do Electron para poder ser testada sem subir
 * um app: as duas funções recebem a raiz e o probe de existência em vez de lerem
 * `app.getPath()`/`fs` por conta própria.
 */

/** Impede que um caminho relativo escape da raiz - `path.join` já normaliza os `..`. */
function assertInsideRoot(
  root: string,
  resolved: string,
  relativePath: string,
  label: string,
): void {
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`Refusing to access path outside ${label}: "${relativePath}".`);
  }
}

/** Resolve um caminho no formato "media/<storyId>/<hash>.<ext>", rejeitando qualquer escape. */
export function resolveMediaPath(mediaRoot: string, relativePath: string): string {
  const resolved = path.join(mediaRoot, relativePath);
  assertInsideRoot(mediaRoot, resolved, relativePath, 'media storage');
  return resolved;
}

/**
 * Resolve uma requisição `app://` para um arquivo dentro do export web do client. O export
 * estático do Expo Router organiza rotas como diretórios com index.html próprio (estilo
 * Next.js), mas um export plano "rota.html" também é aceito; qualquer coisa sem correspondência
 * cai no index.html da raiz, para que a navegação client-side sobreviva a um refresh.
 */
export function resolveClientFile(
  clientDist: string,
  relativePath: string,
  exists: (filePath: string) => boolean,
): string {
  const candidates = path.extname(relativePath)
    ? [relativePath]
    : [path.join(relativePath, 'index.html'), `${relativePath}.html`];

  for (const candidate of candidates) {
    const filePath = path.join(clientDist, candidate);
    // O `path.sep` importa: sem ele, "../client-dist-qualquer/x" passaria no prefixo.
    if (
      (filePath === clientDist || filePath.startsWith(clientDist + path.sep)) &&
      exists(filePath)
    ) {
      return filePath;
    }
  }
  return path.join(clientDist, 'index.html');
}
