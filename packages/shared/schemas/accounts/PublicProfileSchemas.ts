import { z } from 'zod';
import { themes } from '../../theme/palettes/index';

export const PROFILE_BIOGRAPHY_MAX_LENGTH = 4000;
export const PROFILE_LINKS_MAX = 8;
export const PROFILE_LINK_LABEL_MAX_LENGTH = 40;
export const PROFILE_LINK_URL_MAX_LENGTH = 300;

/**
 * Whether a link may go on a public page: an http(s) address with a host, no credentials in it and no
 * whitespace or control characters. The page draws it as an anchor, so `javascript:`, `data:` and the like
 * are exactly what this refuses.
 */
export function isPublicWebUrl(value: string): boolean {
  if (/[\s\u0000-\u001f\u007f]/.test(value)) {
    return false;
  }
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.hostname.length > 0 &&
      url.username === '' &&
      url.password === ''
    );
  } catch {
    return false;
  }
}

export function isProfileThemeKey(value: string): boolean {
  return Object.prototype.hasOwnProperty.call(themes, value);
}

export const ProfileLinkSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, 'A link needs a label')
    .max(
      PROFILE_LINK_LABEL_MAX_LENGTH,
      `A link label cannot exceed ${PROFILE_LINK_LABEL_MAX_LENGTH} characters`,
    ),
  url: z
    .string()
    .trim()
    .max(
      PROFILE_LINK_URL_MAX_LENGTH,
      `A link address cannot exceed ${PROFILE_LINK_URL_MAX_LENGTH} characters`,
    )
    .refine(isPublicWebUrl, 'A link must be an http or https address'),
});

export const OwnPublicProfileSchema = z.object({
  biography: z.string().nullable(),
  links: z.array(ProfileLinkSchema),
  theme: z.string().nullable(),
});

/**
 * Payload for `PUT /user/public-profile`. Omitted fields are left as they are; `null` (or an empty text) clears
 * the biography and the theme, and an empty list clears the links.
 */
export const UpdateOwnPublicProfileSchema = z.object({
  biography: z
    .string()
    .max(
      PROFILE_BIOGRAPHY_MAX_LENGTH,
      `The biography cannot exceed ${PROFILE_BIOGRAPHY_MAX_LENGTH} characters`,
    )
    .nullable()
    .optional(),
  links: z
    .array(ProfileLinkSchema)
    .max(PROFILE_LINKS_MAX, `At most ${PROFILE_LINKS_MAX} links`)
    .optional(),
  theme: z.string().refine(isProfileThemeKey, 'Unknown theme').nullable().optional(),
});

export type UpdateOwnPublicProfileType = z.infer<typeof UpdateOwnPublicProfileSchema>;
