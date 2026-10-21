import { z } from 'zod';
import { ARC_MEDIUMS } from '../../metadata/ArcMedium';
import { DEFAULT_SHOWCASE_SORT, SHOWCASE_SORTS } from '../../metadata/ShowcaseSort';

/** The largest page the listing hands out in one answer. */
export const SHOWCASE_PAGE_MAX = 100;

const text = (max: number) => z.string().trim().max(max).optional();

/**
 * The query of `GET /api/public/stories`. Every filter is optional and the filters add up (a story must
 * match all of them); `q` looks in the title, description, author, genre, language, the publisher's name and
 * the titles of the released works, ignoring case and accents, every word of it. Without `limit` the listing
 * answers whole, as it always did.
 */
export const ShowcaseSearchQuerySchema = z.object({
  q: text(100),
  genre: text(60),
  language: text(60),
  type: z.enum(['linear', 'branching']).optional(),
  medium: z.enum(ARC_MEDIUMS).optional(),
  sort: z.enum(SHOWCASE_SORTS).default(DEFAULT_SHOWCASE_SORT),
  limit: z.coerce.number().int().min(1).max(SHOWCASE_PAGE_MAX).optional(),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ShowcaseSearchQuery = z.infer<typeof ShowcaseSearchQuerySchema>;

/** The query of `GET /api/public/authors`. */
export const ShowcaseAuthorQuerySchema = z.object({
  q: text(100),
  limit: z.coerce.number().int().min(1).max(SHOWCASE_PAGE_MAX).optional(),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ShowcaseAuthorQuery = z.infer<typeof ShowcaseAuthorQuerySchema>;
