/**
 * @jest-environment node
 */
import { accountAgeStatusKey } from '@/src/screens/enter-stack/servers/useAccountVerificationNotice';

describe('accountAgeStatusKey', () => {
  it('names the +18 verification the account holds, or that it does not', () => {
    expect(accountAgeStatusKey(true, null)).toBe('age_status_verified');
    expect(accountAgeStatusKey(false, null)).toBe('age_status_unverified');
  });

  it('puts where the check stands before "not verified" while it is not done', () => {
    expect(accountAgeStatusKey(false, 'pending')).toBe('age_status_pending');
    expect(accountAgeStatusKey(false, 'rejected')).toBe('age_status_rejected');
    expect(accountAgeStatusKey(false, 'expired')).toBe('age_status_expired');
  });

  it('says nothing while it is not known', () => {
    expect(accountAgeStatusKey(undefined, null)).toBeNull();
  });
});
