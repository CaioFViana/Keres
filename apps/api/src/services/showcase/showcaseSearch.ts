import {
  genreList,
  type ShowcaseAuthorCard,
  type ShowcaseAuthorQuery,
  type ShowcaseFacet,
  type ShowcaseFacets,
  type ShowcaseSearchQuery,
} from '@keres/shared';
import type { CatalogEntry } from './showcaseCatalog';

/**
 * How the public site finds things. Pure functions over the catalog the viewer may already see, so a
 * filter can never reach what the catalog left out, and so the rules are tested without a database.
 */

/** Lower case, no accents, single spaces: how two spellings of a word are compared. */
export function foldText(value: string | null | undefined): string {
  if (!value) return '';
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const termsOf = (query: string | undefined): string[] => foldText(query).split(' ').filter(Boolean);

function haystackOf(entry: CatalogEntry): string {
  const { snapshot, owner } = entry.card;
  return foldText(
    [
      snapshot.title,
      snapshot.description,
      snapshot.author,
      snapshot.genre,
      snapshot.language,
      owner.username,
      owner.tag,
      ...entry.workTitles,
    ]
      .filter(Boolean)
      .join(' '),
  );
}

function matches(entry: CatalogEntry, query: ShowcaseSearchQuery, terms: string[]): boolean {
  const { snapshot } = entry.card;
  if (query.type && snapshot.type !== query.type) return false;
  if (query.medium && !entry.mediums.has(query.medium)) return false;
  if (query.language && foldText(snapshot.language) !== foldText(query.language)) return false;
  if (query.genre) {
    const wanted = foldText(query.genre);
    if (!genreList(snapshot.genre).some((genre) => foldText(genre) === wanted)) return false;
  }
  if (terms.length > 0) {
    const haystack = haystackOf(entry);
    if (!terms.every((term) => haystack.includes(term))) return false;
  }
  return true;
}

/** The name a card is ordered by under `author`: the declared author, else whoever published. */
const authorNameOf = (entry: CatalogEntry) =>
  foldText(entry.card.snapshot.author ?? entry.card.owner.username);

/** The catalog arrives newest first; `recent` keeps that order, the others are stable on top of it. */
function sorted(entries: CatalogEntry[], sort: ShowcaseSearchQuery['sort']): CatalogEntry[] {
  if (sort === 'recent') return entries;
  const key =
    sort === 'title' ? (entry: CatalogEntry) => foldText(entry.card.snapshot.title) : authorNameOf;
  return [...entries].sort((left, right) => key(left).localeCompare(key(right)));
}

export interface SearchPage {
  items: CatalogEntry[];
  /** How many matched before the page was cut. */
  total: number;
}

export function searchCatalog(catalog: CatalogEntry[], query: ShowcaseSearchQuery): SearchPage {
  const terms = termsOf(query.q);
  const found = sorted(
    catalog.filter((entry) => matches(entry, query, terms)),
    query.sort,
  );
  const items =
    query.limit === undefined ? found : found.slice(query.offset, query.offset + query.limit);
  return { items, total: found.length };
}

/**
 * Counts values that differ only by case or accents as one, shown as the spelling most authors used (the first in
 * alphabetical order when they tie), most used first, then alphabetical.
 */
function facetOf(values: Iterable<string>): ShowcaseFacet[] {
  const groups = new Map<string, { count: number; spellings: Map<string, number> }>();
  for (const raw of values) {
    const value = raw.trim();
    const key = foldText(value);
    if (!key) continue;
    const group = groups.get(key) ?? { count: 0, spellings: new Map<string, number>() };
    group.count += 1;
    group.spellings.set(value, (group.spellings.get(value) ?? 0) + 1);
    groups.set(key, group);
  }
  return [...groups.values()]
    .map(({ count, spellings }) => ({
      value: [...spellings.entries()].sort(
        (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
      )[0][0],
      count,
    }))
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));
}

export function facetsOf(catalog: CatalogEntry[]): ShowcaseFacets {
  return {
    genres: facetOf(catalog.flatMap((entry) => genreList(entry.card.snapshot.genre))),
    languages: facetOf(catalog.map((entry) => entry.card.snapshot.language ?? '')),
    mediums: facetOf(catalog.flatMap((entry) => [...entry.mediums])),
    types: facetOf(catalog.map((entry) => entry.card.snapshot.type)),
  };
}

export interface AuthorPage {
  items: ShowcaseAuthorCard[];
  total: number;
}

/** The accounts behind the catalog, most recently active first, filtered by what `q` says of their name. */
export function authorsOf(catalog: CatalogEntry[], query: ShowcaseAuthorQuery): AuthorPage {
  const byAccount = new Map<string, ShowcaseAuthorCard>();
  for (const { ownerUserId, card } of catalog) {
    const author = byAccount.get(ownerUserId);
    if (!author) {
      byAccount.set(ownerUserId, { owner: card.owner, storyCount: 1, updatedAt: card.updatedAt });
      continue;
    }
    author.storyCount += 1;
    if (card.updatedAt > author.updatedAt) author.updatedAt = card.updatedAt;
  }
  const terms = termsOf(query.q);
  const found = [...byAccount.values()]
    .filter(({ owner }) => {
      const name = foldText(`${owner.username} ${owner.tag}`);
      return terms.every((term) => name.includes(term));
    })
    .sort((left, right) => (left.updatedAt < right.updatedAt ? 1 : -1));
  const items =
    query.limit === undefined ? found : found.slice(query.offset, query.offset + query.limit);
  return { items, total: found.length };
}
