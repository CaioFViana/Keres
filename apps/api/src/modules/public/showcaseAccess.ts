/** Lifetime of the signed download URL. Short: it leaks into browser history and proxy logs. */
export const DOWNLOAD_URL_TTL_SECONDS = 60;

/**
 * Checks an `Authorization: Showcase <token>` and returns whether it unlocks *this* story.
 *
 * The scope is per story on purpose: holding one story's password does not make another visible.
 */
/**
 * The halves of an `Authorization` header. The showcase sends session and unlock together,
 * comma-joined (`Bearer <session>, Showcase <token>`), so one fetch can prove both facts; every
 * single-credential call keeps working because each half is read independently.
 */
export function splitAuthorization(authorization: string | undefined): {
  bearer?: string;
  showcase?: string;
} {
  if (!authorization) {
    return {};
  }
  const parts: { bearer?: string; showcase?: string } = {};
  for (const half of authorization.split(',')) {
    const trimmed = half.trim();
    if (trimmed.startsWith('Bearer ') && parts.bearer === undefined) {
      parts.bearer = trimmed;
    } else if (trimmed.startsWith('Showcase ') && parts.showcase === undefined) {
      parts.showcase = trimmed;
    }
  }
  return parts;
}

export async function verifyShowcaseToken(
  showcaseJwt: { verify: (token: string) => Promise<{ storyId?: string } | false> },
  authorization: string | undefined,
  storyId: string,
): Promise<boolean> {
  const showcase = splitAuthorization(authorization).showcase;
  if (!showcase) {
    return false;
  }
  const payload = await showcaseJwt.verify(showcase.slice('Showcase '.length));
  return !!payload && payload.storyId === storyId;
}

/**
 * Whether a `Showcase <token>` (header or `?access=`) carries a verified-adult session for this
 * story. Issued by the `download-url`/`reader/url`/`unlock` endpoints only after seeing a live
 * verified session, so header-less fetches (browser downloads, reader frames) keep the gating
 * without ever accepting the session token itself in a URL.
 */
export async function verifyNsfwToken(
  showcaseJwt: {
    verify: (token: string) => Promise<{ storyId?: string; nsfwOk?: boolean } | false>;
  },
  authorization: string | undefined,
  storyId: string,
): Promise<boolean> {
  const showcase = splitAuthorization(authorization).showcase;
  if (!showcase) {
    return false;
  }
  const payload = await showcaseJwt.verify(showcase.slice('Showcase '.length));
  return !!payload && payload.storyId === storyId && payload.nsfwOk === true;
}
