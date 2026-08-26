import { z } from 'zod';

export const PublicationLabelModeSchema = z.enum(['version', 'date', 'both']);
export const ShowcaseVisibilitySchema = z.enum(['public', 'password']);

export const StoryPublicationSnapshotSchema = z.object({
  title: z.string(),
  description: z.string().nullable(),
  genre: z.string().nullable(),
  language: z.string().nullable(),
  author: z.string().nullable(),
  type: z.enum(['linear', 'branching']),
  theme: z.string().nullable(),
});

export const StoryPublicationSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  ownerUserId: z.string(),
  label: z.string(),
  operationVersion: z.number().int(),
  formatVersion: z.number().int(),
  byteSize: z.number().int(),
  mediaIncluded: z.number().int(),
  mediaTotal: z.number().int(),
  createdAt: z.coerce.date(),
});

/**
 * What the owner sends when publishing. `operationVersion` is the local `lastOperationLog`: the
 * server compares it with its own and refuses (409) if they do not match, because publishing a story
 * that still has a pending local change would produce a package matching nothing that exists on
 * either side.
 */
export const CreatePublicationRequestSchema = z.object({
  operationVersion: z.number().int().nonnegative(),
  labelMode: PublicationLabelModeSchema.default('both'),
});

export const UpdateShowcaseVisibilityRequestSchema = z
  .object({
    visibility: ShowcaseVisibilitySchema,
    /** Required when switching to `password`; ignored for `public`. */
    password: z.string().min(4).max(200).optional(),
  })
  .refine((data) => data.visibility === 'public' || !!data.password, {
    message: 'A password is required for password-protected stories.',
    path: ['password'],
  });

export const ShowcaseOwnerSchema = z.object({
  username: z.string(),
  tag: z.string(),
  avatarColor: z.string().nullable(),
  avatarIcon: z.string().nullable(),
});

export const ShowcaseVersionSchema = z.object({
  id: z.string(),
  label: z.string(),
  byteSize: z.number().int(),
  mediaIncluded: z.number().int(),
  mediaTotal: z.number().int(),
  createdAt: z.string(),
});

export const ShowcaseStoryCardSchema = z.object({
  storyId: z.string(),
  snapshot: StoryPublicationSnapshotSchema,
  owner: ShowcaseOwnerSchema,
  versionCount: z.number().int(),
  latestVersion: ShowcaseVersionSchema,
  updatedAt: z.string(),
});

export const ShowcaseStoryDetailSchema = z.object({
  storyId: z.string(),
  snapshot: StoryPublicationSnapshotSchema,
  owner: ShowcaseOwnerSchema,
  versions: z.array(ShowcaseVersionSchema),
  updatedAt: z.string(),
});

export const ShowcaseProtectedStubSchema = z.object({
  storyId: z.string(),
  protected: z.literal(true),
});

export const UnlockShowcaseStoryRequestSchema = z.object({
  password: z.string().min(1).max(200),
});

export type CreatePublicationRequest = z.infer<typeof CreatePublicationRequestSchema>;
export type UpdateShowcaseVisibilityRequest = z.infer<typeof UpdateShowcaseVisibilityRequestSchema>;
export type UnlockShowcaseStoryRequest = z.infer<typeof UnlockShowcaseStoryRequestSchema>;

/** `2026-08-19`, no fuso local de quem publica (o servidor). */
function formatDatePart(publishedAt: Date): string {
  const year = publishedAt.getFullYear();
  const month = String(publishedAt.getMonth() + 1).padStart(2, '0');
  const day = String(publishedAt.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Builds a version's name in the style the owner chose.
 *
 * `version` and `both` carry `operationVersion`, which is monotonic per story - they do not collide.
 * `date` genuinely collides (two publications on the same day), and then it gets a suffix:
 * `2026-08-19`, then `2026-08-19-02`, `-03`... The suffix comes from `existingLabels` rather than a
 * query, so this function stays pure and the server can call it inside the transaction that already
 * holds that story's existing labels.
 */
export function buildPublicationLabel(
  mode: z.infer<typeof PublicationLabelModeSchema>,
  operationVersion: number,
  publishedAt: Date,
  existingLabels: string[],
): string {
  const datePart = formatDatePart(publishedAt);
  const base =
    mode === 'version'
      ? `v${operationVersion}`
      : mode === 'date'
        ? datePart
        : `v${operationVersion}-${datePart}`;

  const taken = new Set(existingLabels);
  if (!taken.has(base)) {
    return base;
  }
  // It starts at 02: the day's first one is the one already there, with no suffix.
  for (let suffix = 2; suffix < 1000; suffix++) {
    const candidate = `${base}-${String(suffix).padStart(2, '0')}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }
  throw new Error(`Could not build a unique publication label from "${base}".`);
}
