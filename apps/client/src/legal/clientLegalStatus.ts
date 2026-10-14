import { CLIENT_TERMS_VERSION } from './clientTerms';
import { CLIENT_PRIVACY_VERSION } from './privacyPolicy';

/** Which of the two client legal texts this device has not agreed to in its current version. */
export interface ClientLegalBehind {
  terms: boolean;
  privacy: boolean;
}

/**
 * Whether each document is behind the text shipped now. A document never accepted (`null`) is behind; one accepted
 * in an older version is behind; the same version or a higher one is not (a higher stored version can only come from
 * a newer build, and that build's text is the one a person agreed to).
 */
export function legalIsBehind(
  acceptedTerms: number | null,
  acceptedPrivacy: number | null,
): ClientLegalBehind {
  return {
    terms: acceptedTerms === null || acceptedTerms < CLIENT_TERMS_VERSION,
    privacy: acceptedPrivacy === null || acceptedPrivacy < CLIENT_PRIVACY_VERSION,
  };
}
