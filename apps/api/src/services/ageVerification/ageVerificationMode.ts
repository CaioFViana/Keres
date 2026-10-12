import type { AgeVerificationMode } from '@keres/shared/age-verification/AgeVerificationConnector';
import { env } from '../../config/env';

/**
 * How this server treats age (see `docs/age_verification.md`): `required` makes every new account wait for the
 * service's approval, `disabled` has no verification at all and therefore no adults-only area and no verified account.
 */
export function ageVerificationMode(): AgeVerificationMode {
  return env.AGE_VERIFICATION_MODE;
}

export function isAgeVerificationRequired(): boolean {
  return ageVerificationMode() === 'required';
}

/**
 * The one answer to "is this account adults-only verified?" for every place that decides access. The stored flag
 * only counts where verification is `required`: in `disabled` nobody is verified, whatever the column says (a server
 * that was switched off after approvals were given must not keep handing out the adults-only area).
 */
export function effectiveAdultVerified(flag: boolean): boolean {
  return isAgeVerificationRequired() && flag;
}
