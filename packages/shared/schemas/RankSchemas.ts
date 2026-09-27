import { z } from 'zod';
import { isValidRank, MAX_RANK_LENGTH } from '../rules/rank';

/** Longest `rank` a row may carry; well past what `planRankChanges` ever writes. */
export const RANK_FIELD_MAX = 2 * MAX_RANK_LENGTH;

/** A rank an operation writes: one the scheme can place rows next to (see `rules/rank.ts`). */
export const RankFieldSchema = z
  .string()
  .max(RANK_FIELD_MAX)
  .refine(isValidRank, 'Rank must be a valid position key.');
