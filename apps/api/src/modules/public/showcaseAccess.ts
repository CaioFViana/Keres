/** Lifetime of the signed download URL. Short: it leaks into browser history and proxy logs. */
export const DOWNLOAD_URL_TTL_SECONDS = 60;

/**
 * The address a browser opens a published version by. The plain address is enough, except where it
 * would not open: a password story, or a verified adult's NSFW content, get a token in the URL that
 * lasts DOWNLOAD_URL_TTL_SECONDS (the `nsfwOk` proof, so a header-less fetch keeps the gating).
 */
export async function signedPublicationUrl({
  showcaseJwt,
  entry,
  storyId,
  publicationId,
  includeNsfw,
  resource,
}: {
  showcaseJwt: {
    sign: (payload: { storyId: string; nsfwOk?: true; exp: number }) => Promise<string>;
  };
  entry: { visibility: string };
  storyId: string;
  publicationId: string;
  includeNsfw: boolean;
  resource: 'download' | 'manuscript/download' | 'reader';
}): Promise<{ url: string }> {
  const needsToken = entry.visibility === 'password' || includeNsfw;
  const access = needsToken
    ? await showcaseJwt.sign({
        storyId,
        ...(includeNsfw ? { nsfwOk: true as const } : {}),
        exp: Math.floor(Date.now() / 1000) + DOWNLOAD_URL_TTL_SECONDS,
      })
    : undefined;

  const base = `/api/public/stories/${storyId}/publications/${publicationId}/${resource}`;
  return { url: access ? `${base}?access=${encodeURIComponent(access)}` : base };
}

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
