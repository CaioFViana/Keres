import { z } from 'zod';
import { ACCESS_RECORD_MAX_USERNAME } from '../metadata/AccessRecords';

/**
 * The access records of the admin panel. Filters are optional; `cursor` is what the previous page answered with
 * (`nextCursor`), so paging stays correct while new records arrive.
 */
export const AccessRecordListQuerySchema = z.object({
  /** The account the record names as its own (a login, a recovery that worked, a session renewed). */
  userId: z.string().trim().optional(),
  /** An account by its name: its own records, and the names that were tried for it and matched nobody. */
  username: z.string().trim().max(ACCESS_RECORD_MAX_USERNAME).optional(),
  /** The address the request came from, as recorded. */
  ip: z.string().trim().max(45).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  /** `<epoch milliseconds>_<record id>` of the last record of the previous page. */
  cursor: z
    .string()
    .trim()
    .regex(/^\d{1,16}_[0-9A-Za-z]{1,40}$/, 'Invalid cursor')
    .optional(),
});
export type AccessRecordListQuery = z.infer<typeof AccessRecordListQuerySchema>;
