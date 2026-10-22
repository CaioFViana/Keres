/**
 * The landing's two legal documents, each on a page of its own: `/terms` and `/privacy`, at the root of the server
 * that serves the landing (the API answers both with the landing's single page, which reads its path).
 */
export const LEGAL_PAGES = ['terms', 'privacy'] as const;

export type LegalPage = (typeof LEGAL_PAGES)[number];

export const legalPath = (page: LegalPage): string => `/${page}`;

/** The document a path names, or null for any other page. A trailing slash names the same page. */
export function legalPageOfPath(pathname: string): LegalPage | null {
  const clean = pathname.replace(/\/+$/, '');
  return LEGAL_PAGES.find((page) => clean === legalPath(page)) ?? null;
}

/**
 * The page an old address stands for. The landing used to hold both documents under `#terms`, `#privacy` and `#legal`,
 * and `#privacy` is the address the Play Console listing points at: those addresses keep opening the right document.
 */
export function legalPageOfHash(hash: string): LegalPage | null {
  switch (hash) {
    case '#privacy':
      return 'privacy';
    case '#terms':
    case '#legal':
      return 'terms';
    default:
      return null;
  }
}
