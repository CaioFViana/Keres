import { helpRegistry } from './generated/registry';
import { helpPageIds } from './catalog';
import { HelpPage, HelpPageId } from './types';

export interface ResolvedHelpPage {
  page: HelpPage | undefined;
  usedFallback: boolean;
}

function getLanguageCode(language: string): string {
  return language.toLowerCase().split('-')[0] ?? language;
}

/** Conteúdo pronto para renderizar, sempre vindo do registry gerado no build. */
export function resolveHelpPage(pageId: string, language: string): ResolvedHelpPage {
  const page = helpRegistry[pageId as HelpPageId];
  const localizedPage = page?.[getLanguageCode(language)];
  return {
    page: localizedPage ?? page?.en,
    usedFallback: !localizedPage && Boolean(page?.en),
  };
}

export function getHelpPage(pageId: string, language: string): HelpPage | undefined {
  return resolveHelpPage(pageId, language).page;
}

export function getHelpPages(language: string): HelpPage[] {
  return helpPageIds
    .map((pageId) => getHelpPage(pageId, language))
    .filter((page): page is HelpPage => Boolean(page));
}
