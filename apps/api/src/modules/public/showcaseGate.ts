import type { JWTPayload } from '../../index';
import { showcaseService } from '../../services/ShowcaseService';
import { AppError } from '../../utils/errors';
import { verifyNsfwToken, verifyShowcaseToken } from './showcaseAccess';

type ShowcaseJwt = {
  verify: (token: string) => Promise<{ storyId?: string; nsfwOk?: boolean } | false>;
};

/**
 * The gate every showcase read passes before it serves anything of a story: the password (when the
 * story has one) and the verified-adult proof for NSFW content, both answered as "not found" so a
 * hidden story cannot be told from a missing one. Returns whether the viewer may see NSFW content,
 * which the caller still needs to decide what to put in the answer.
 *
 * `credentials` are the `Authorization` values to try, in order: the header, and - for what a browser
 * opens without one (a download link, the reader's frame) - `Showcase <access>` from the `?access=`
 * parameter, valid for 60 seconds.
 */
export async function assertShowcaseOpen({
  entry,
  storyId,
  user,
  showcaseJwt,
  credentials,
}: {
  entry: { visibility: string };
  storyId: string;
  user: JWTPayload | null;
  showcaseJwt: ShowcaseJwt;
  credentials: ReadonlyArray<string | undefined>;
}): Promise<boolean> {
  if (entry.visibility === 'password') {
    let unlocked = false;
    for (const credential of credentials) {
      if (await verifyShowcaseToken(showcaseJwt, credential, storyId)) {
        unlocked = true;
        break;
      }
    }
    if (!unlocked) {
      throw new AppError(404, 'Not found.');
    }
  }

  let includeNsfw = await showcaseService.viewerIncludesNsfw(user);
  for (const credential of credentials) {
    if (includeNsfw) break;
    includeNsfw = await verifyNsfwToken(showcaseJwt, credential, storyId);
  }

  // Shadowbanned and NSFW-to-unverified answer like unpublished.
  if (!(await showcaseService.isVisibleTo(storyId, includeNsfw))) {
    throw new AppError(404, 'Not found.');
  }
  return includeNsfw;
}
