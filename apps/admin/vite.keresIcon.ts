import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import pngToIco from 'png-to-ico';
import type { Plugin } from 'vite';

/**
 * O ícone do Keres, para os dois apps web deste projeto.
 *
 * A fonte é uma só - `apps/client/assets/images/desktop_icon.png`, a mesma que o
 * electron-builder converte para o ícone do app de desktop. Nada é copiado para dentro de
 * `apps/admin`: o painel já gerava o `favicon.ico` a partir dela em tempo de build, e o site
 * público faz o mesmo, mais uma versão reduzida para a marca no cabeçalho e no rodapé.
 *
 * Gerar em vez de versionar uma cópia mantém uma única verdade: trocar o desenho do ícone no
 * cliente atualiza favicon e marca do site no próximo build, sem ninguém precisar lembrar de
 * regerar arquivo nenhum.
 */

const adminDirectory = path.dirname(fileURLToPath(import.meta.url));

export const KERES_ICON_SOURCE = path.resolve(
  adminDirectory,
  '..',
  'client',
  'assets',
  'images',
  'desktop_icon.png',
);

/**
 * Lado da marca usada nas páginas. O original tem 1024px e quase 900 KB - peso que não se
 * justifica para um logo desenhado a 28px no cabeçalho. 128px cobre telas de alta densidade
 * (4x no cabeçalho, quase 6x no rodapé) por uma fração dos bytes.
 */
const LOGO_SIZE = 128;

/**
 * Reduz um PNG quadrado por média de blocos.
 *
 * A média é feita com alfa pré-multiplicado: sem isso, a cor de pixels totalmente
 * transparentes (que no PNG pode ser qualquer coisa, inclusive preto) entra na conta e deixa
 * uma auréola escura na borda do desenho - bem visível num logo recortado como este.
 */
function downscaleSquarePng(source: Buffer, size: number): Buffer {
  const image = PNG.sync.read(source);
  if (image.width === size && image.height === size) {
    return source;
  }

  const output = new PNG({ width: size, height: size });
  const blockX = image.width / size;
  const blockY = image.height / size;

  for (let y = 0; y < size; y++) {
    const fromY = Math.floor(y * blockY);
    const toY = Math.min(image.height, Math.ceil((y + 1) * blockY));

    for (let x = 0; x < size; x++) {
      const fromX = Math.floor(x * blockX);
      const toX = Math.min(image.width, Math.ceil((x + 1) * blockX));

      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 0;
      let samples = 0;

      for (let sourceY = fromY; sourceY < toY; sourceY++) {
        for (let sourceX = fromX; sourceX < toX; sourceX++) {
          const index = (image.width * sourceY + sourceX) << 2;
          const pixelAlpha = image.data[index + 3] / 255;
          red += image.data[index] * pixelAlpha;
          green += image.data[index + 1] * pixelAlpha;
          blue += image.data[index + 2] * pixelAlpha;
          alpha += pixelAlpha;
          samples += 1;
        }
      }

      const target = (size * y + x) << 2;
      if (alpha === 0) {
        output.data[target] = 0;
        output.data[target + 1] = 0;
        output.data[target + 2] = 0;
        output.data[target + 3] = 0;
        continue;
      }
      // Desfaz a pré-multiplicação: a cor volta a ser a cor, e o alfa vira a média das amostras.
      output.data[target] = Math.round(red / alpha);
      output.data[target + 1] = Math.round(green / alpha);
      output.data[target + 2] = Math.round(blue / alpha);
      output.data[target + 3] = Math.round((alpha / samples) * 255);
    }
  }

  return PNG.sync.write(output);
}

/**
 * Constrói um `favicon.ico` multi-tamanho (16/24/32/48/64) a partir do PNG do desktop, a mesma
 * ideia do electron-builder convertendo esse arquivo para .ico.
 *
 * `devUrls` são os caminhos que o servidor de desenvolvimento deve responder - o painel roda
 * sob `/admin/`, o site na raiz, e cada um pede o favicon do seu próprio prefixo.
 */
export function keresFavicon(devUrls: string[] = ['/favicon.ico']): Plugin {
  let icoPromise: Promise<Buffer> | null = null;
  const ico = () => {
    icoPromise ??= pngToIco(KERES_ICON_SOURCE);
    return icoPromise;
  };

  return {
    name: 'keres-favicon',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0];
        if (!url || !devUrls.includes(url)) {
          next();
          return;
        }
        ico()
          .then((buffer) => {
            res.setHeader('Content-Type', 'image/x-icon');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.end(buffer);
          })
          .catch(next);
      });
    },
    async generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'favicon.ico', source: await ico() });
    },
  };
}

/** O módulo virtual que as páginas importam para obter a URL da marca. */
export const KERES_LOGO_MODULE_ID = 'virtual:keres-logo';
const RESOLVED_LOGO_MODULE_ID = `\0${KERES_LOGO_MODULE_ID}`;
/** Caminho servido em desenvolvimento, onde não existe emissão de asset. */
const DEV_LOGO_URL = '/keres-logo.png';

/**
 * Publica a marca reduzida como `virtual:keres-logo`, cujo default é a URL da imagem.
 *
 * Módulo virtual em vez de um arquivo importado direto porque a imagem não existe em disco
 * dentro de `apps/admin` - ela é derivada do ícone do cliente na hora do build.
 */
export function keresLogo(): Plugin {
  let logoPromise: Promise<Buffer> | null = null;
  const logo = async () => {
    logoPromise ??= (async () => {
      const { readFile } = await import('node:fs/promises');
      return downscaleSquarePng(await readFile(KERES_ICON_SOURCE), LOGO_SIZE);
    })();
    return logoPromise;
  };

  let isServing = false;

  return {
    name: 'keres-logo',
    configResolved(config) {
      isServing = config.command === 'serve';
    },
    resolveId(id) {
      return id === KERES_LOGO_MODULE_ID ? RESOLVED_LOGO_MODULE_ID : null;
    },
    async load(id) {
      if (id !== RESOLVED_LOGO_MODULE_ID) {
        return null;
      }
      if (isServing) {
        return `export default ${JSON.stringify(DEV_LOGO_URL)};`;
      }
      const referenceId = this.emitFile({
        type: 'asset',
        name: 'keres-logo.png',
        source: await logo(),
      });
      // O Vite reescreve isto para a URL final já com o `base` do app aplicado.
      return `export default import.meta.ROLLUP_FILE_URL_${referenceId};`;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== DEV_LOGO_URL) {
          next();
          return;
        }
        logo()
          .then((buffer) => {
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.end(buffer);
          })
          .catch(next);
      });
    },
  };
}
