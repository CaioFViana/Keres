import { showcaseService } from '../../services/ShowcaseService';
import { AppError } from '../../utils/errors';

/** What the reads of a published version need from the version row. */
type Publication = NonNullable<Awaited<ReturnType<typeof showcaseService.getPublication>>>;

/**
 * The published version of a story, when it exists and `usable` accepts it; otherwise "not found".
 * A version that is missing and one that lacks what the read serves answer the same way.
 */
export async function publicationOr404(
  storyId: string,
  publicationId: string,
  usable: (publication: Publication) => boolean,
): Promise<Publication> {
  const publication = await showcaseService.getPublication(storyId, publicationId);
  if (!publication || !usable(publication)) {
    throw new AppError(404, 'Not found.');
  }
  return publication;
}

/**
 * A publication never changes after it is created - but gated (NSFW) content is not for a shared
 * cache. Keyed on the story's flag, not the viewer class.
 */
export async function publicationCacheControl(storyId: string): Promise<string> {
  return (await showcaseService.isNsfwStory(storyId))
    ? 'private, max-age=31536000, immutable'
    : 'public, max-age=31536000, immutable';
}
