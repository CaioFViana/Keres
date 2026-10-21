/** How the public site orders its story list: newest first, by title, or by author. */
export const SHOWCASE_SORTS = ['recent', 'title', 'author'] as const;

export type ShowcaseSort = (typeof SHOWCASE_SORTS)[number];

export const DEFAULT_SHOWCASE_SORT: ShowcaseSort = 'recent';
