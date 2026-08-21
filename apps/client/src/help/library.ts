import { helpSections } from './catalog';
import { getHelpPage, getHelpPages, resolveHelpPage, ResolvedHelpPage } from './repository';
import { HelpPage, HelpSection } from './types';

/**
 * Descreve uma biblioteca de documentação para as telas de índice e de página. Existem duas: a
 * Ajuda, que explica o aplicativo, e os Recursos Literários, que explicam o ofício da escrita.
 * As telas são idênticas; só mudam o catálogo, as chaves de tradução e as rotas.
 */
export interface DocLibrary {
  id: 'help' | 'storyDevices';
  sections: HelpSection[];
  getPages: (language: string) => HelpPage[];
  getPage: (pageId: string, language: string) => HelpPage | undefined;
  resolvePage: (pageId: string, language: string) => ResolvedHelpPage;
  /** Nome da rota de detalhe dentro do stack da biblioteca. */
  pageRouteName: string;
  indexTitleKey: string;
  titleKey: string;
  searchPlaceholderKey: string;
  searchClearKey: string;
  searchResultsCountKey: string;
  noResultsKey: string;
  notFoundKey: string;
  fallbackNoticeKey: string;
  defaultOpenSectionId: string;
  emptyStateLinks: { pageId: string; labelKey: string }[];
}

export const helpLibrary: DocLibrary = {
  id: 'help',
  sections: helpSections,
  getPages: getHelpPages,
  getPage: getHelpPage,
  resolvePage: resolveHelpPage,
  pageRouteName: 'HelpPage',
  indexTitleKey: 'help_index_title',
  titleKey: 'help_title',
  searchPlaceholderKey: 'help_search_placeholder',
  searchClearKey: 'help_search_clear',
  searchResultsCountKey: 'help_search_results_count',
  noResultsKey: 'help_no_results',
  notFoundKey: 'help_page_not_found',
  fallbackNoticeKey: 'help_language_fallback_notice',
  defaultOpenSectionId: 'start',
  emptyStateLinks: [
    { pageId: 'using-this-help', labelKey: 'help_no_results_hint' },
    { pageId: 'faq', labelKey: 'help_no_results_faq_link' },
  ],
};
