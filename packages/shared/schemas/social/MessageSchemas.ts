import { z } from 'zod';
import { MESSAGE_BODY_MAX_LENGTH, MESSAGE_PAGE_SIZE_MAX } from '../../metadata/MessageLimits';
import { REPORT_TYPES } from '../../metadata/ReportTypes';

/** What a user writes, to a friend or to the administrators. */
export const MessageSendSchema = z.object({
  body: z.string().trim().min(1, 'Message cannot be empty').max(MESSAGE_BODY_MAX_LENGTH),
});
export type MessageSend = z.infer<typeof MessageSendSchema>;

/**
 * Reporting a story to the administrators. The client sends the type and the free-text reason;
 * the server injects the story id into the admin message, so no report-specific field is trusted
 * from the client. The type defaults for older clients that still send a reason alone.
 */
export const StoryReportRequestSchema = z.object({
  type: z.enum(REPORT_TYPES).default('other'),
  reason: z.string().trim().min(1, 'A reason is required').max(MESSAGE_BODY_MAX_LENGTH),
});
export type StoryReportRequest = z.infer<typeof StoryReportRequestSchema>;

/** Reporting a user, a message, or a publication: same shape, the target travels in the route. */
export const UserReportRequestSchema = z.object({
  type: z.enum(REPORT_TYPES).default('other'),
  reason: z.string().trim().min(1, 'A reason is required').max(MESSAGE_BODY_MAX_LENGTH),
});
export type UserReportRequest = z.infer<typeof UserReportRequestSchema>;

export const MessageReportRequestSchema = z.object({
  type: z.enum(REPORT_TYPES).default('other'),
  reason: z.string().trim().min(1, 'A reason is required').max(MESSAGE_BODY_MAX_LENGTH),
});
export type MessageReportRequest = z.infer<typeof MessageReportRequestSchema>;

export const PublicationReportRequestSchema = z.object({
  type: z.enum(REPORT_TYPES).default('other'),
  reason: z.string().trim().min(1, 'A reason is required').max(MESSAGE_BODY_MAX_LENGTH),
});
export type PublicationReportRequest = z.infer<typeof PublicationReportRequestSchema>;

/** Conversations are read newest first, a page at a time; `before` is the id of the oldest one seen. */
export const MessagePageQuerySchema = z.object({
  before: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(MESSAGE_PAGE_SIZE_MAX).default(30),
});
export type MessagePageQuery = z.infer<typeof MessagePageQuerySchema>;

export const ADMIN_MESSAGE_SOURCES = ['all', 'site', 'user', 'report'] as const;
export const ADMIN_MESSAGE_READ_FILTERS = ['all', 'unread', 'read'] as const;
export const ADMIN_MESSAGE_ARCHIVE_FILTERS = ['active', 'archived', 'all'] as const;
export const ADMIN_MESSAGE_SORTS = ['date', 'sender', 'subject'] as const;

/**
 * The admin list: what arrived (the site form and users writing to the administrators), filtered by
 * where it came from, whether it was read and whether it was archived.
 */
export const AdminMessageListQuerySchema = z.object({
  search: z.string().trim().optional(),
  source: z.enum(ADMIN_MESSAGE_SOURCES).default('all'),
  /**
   * Narrows `source: 'report'` to one report type. Legacy untyped reports carry no type and are
   * excluded while filtering - they still show with no filter or `source: 'report'`.
   */
  reportType: z.enum(REPORT_TYPES).optional(),
  read: z.enum(ADMIN_MESSAGE_READ_FILTERS).default('all'),
  archived: z.enum(ADMIN_MESSAGE_ARCHIVE_FILTERS).default('active'),
  sort: z.enum(ADMIN_MESSAGE_SORTS).default('date'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminMessageListQuery = z.infer<typeof AdminMessageListQuerySchema>;

/** Both fields optional, at least one required: the admin marks unread or archives, not both by accident. */
export const AdminMessagePatchSchema = z
  .object({
    read: z.boolean().optional(),
    archived: z.boolean().optional(),
  })
  .refine((patch) => patch.read !== undefined || patch.archived !== undefined, {
    message: 'Nothing to change',
  });
export type AdminMessagePatch = z.infer<typeof AdminMessagePatchSchema>;
