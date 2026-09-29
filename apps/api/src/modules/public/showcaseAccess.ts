/** Lifetime of the signed download URL. Short: it leaks into browser history and proxy logs. */
export const DOWNLOAD_URL_TTL_SECONDS = 60;

/**
 * Checks an `Authorization: Showcase <token>` and returns whether it unlocks *this* story.
 *
 * The scope is per story on purpose: holding one story's password does not make another visible.
 */
export async function verifyShowcaseToken(
  showcaseJwt: { verify: (token: string) => Promise<{ storyId?: string } | false> },
  authorization: string | undefined,
  storyId: string,
): Promise<boolean> {
  if (!authorization?.startsWith('Showcase ')) {
    return false;
  }
  const payload = await showcaseJwt.verify(authorization.slice('Showcase '.length));
  return !!payload && payload.storyId === storyId;
}
