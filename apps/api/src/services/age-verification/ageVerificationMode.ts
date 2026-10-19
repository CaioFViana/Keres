import type { AgeVerificationMode } from '@keres/shared/age-verification/AgeVerificationConnector';
import { env } from '@/config/env';

/**
 * How this server treats age (see `docs/age_verification.md`): `required` makes every new account wait for the
 * external service's approval; `manual` has no service, starts accounts active and not verified, and lets an
 * administrator mark them verified by hand.
 */
export function ageVerificationMode(): AgeVerificationMode {
  return env.AGE_VERIFICATION_MODE;
}

/** True only for `required`: the external service decides verification and boot runs its verifier and prune jobs. */
export function isAgeVerificationRequired(): boolean {
  return ageVerificationMode() === 'required';
}

/**
 * The one answer to "is this account adults-only verified?" for every place that decides access. In both modes the
 * stored flag is the answer: `required` sets it on approval, `manual` sets it when an administrator grants it.
 */
export function effectiveAdultVerified(flag: boolean): boolean {
  return flag;
}
