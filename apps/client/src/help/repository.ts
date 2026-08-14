import { helpRegistry } from './generated/registry';
import { helpPageIds } from './catalog';
import { HelpPage, HelpPageId } from './types';

/** Conteúdo pronto para renderizar, sempre vindo do registry gerado no build. */
export function getHelpPage(pageId: string, language: string): HelpPage | undefined {
  const page = helpRegistry[pageId as HelpPageId];
  return page?.[language] ?? page?.en;
}

export function getHelpPages(language: string): HelpPage[] {
  return helpPageIds
    .map((pageId) => getHelpPage(pageId, language))
    .filter((page): page is HelpPage => Boolean(page));
}
