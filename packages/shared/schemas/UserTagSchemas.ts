import { z } from 'zod';
import { normalizeUserTag, USER_TAG_MAX_LENGTH, USER_TAG_MIN_LENGTH } from '../utils/userTag';

// The text rules are `utils/userTag`; they are re-exported here because the schemas and the rules
// have always been imported together, from the barrel.
export {
  deriveUserTag,
  normalizeUserTag,
  slugifyUserTag,
  USER_TAG_MAX_LENGTH,
  USER_TAG_MIN_LENGTH,
} from '../utils/userTag';

/**
 * Short, memorable handle a user shares with friends instead of their raw ULID (e.g. "@caio").
 * Whatever is sent is brought to the stored shape first (see `normalizeUserTag`), then must be 3 to
 * 20 characters of it.
 */
export const UserTagSchema = z
  .string()
  .transform(normalizeUserTag)
  .pipe(
    z
      .string()
      .min(USER_TAG_MIN_LENGTH, `Tag must be at least ${USER_TAG_MIN_LENGTH} letters or digits`)
      .max(USER_TAG_MAX_LENGTH, `Tag must be at most ${USER_TAG_MAX_LENGTH} characters`),
  );

export const UpdateUserTagSchema = z.object({
  tag: UserTagSchema,
});
