import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { AdminUserInfo, AgeVerificationMode, Tier, UserTierSource } from '@keres/shared';
import { slugifyUserTag } from '@keres/shared/utils/userTag';
import { GiftPlanSection } from './GiftPlanSection';
import { RecoveryCodesModal } from './RecoveryCodesModal';
import { Modal } from '../../components/Modal';
import { AdminUserApiService } from '../../api/AdminUserApiService';
import { RegistrationSettingsApiService } from '../../api/RegistrationSettingsApiService';
import { TierApiService } from '../../api/TierApiService';

/**
 * The age-verification standing of the account. Dates arrive as text over JSON, so they are formatted where they are
 * shown. An administrator marks or revokes it here, and only the server's mode says which of the two is allowed.
 */
interface Verification {
  isAdultVerified: boolean;
  verificationStatus: AdminUserInfo['verificationStatus'] | undefined;
  verifiedAt: AdminUserInfo['verifiedAt'] | undefined;
  verificationMethod: AdminUserInfo['verificationMethod'] | undefined;
}

const verificationOf = (user: AdminUserInfo): Verification => ({
  isAdultVerified: user.isAdultVerified,
  verificationStatus: user.verificationStatus,
  verifiedAt: user.verifiedAt,
  verificationMethod: user.verificationMethod,
});

/**
 * Creating and editing an account happens in a dialog over the user list, so
 * the list stays visible behind it. Giving a plan and the recovery-codes flow
 * open as further dialogs stacked on top of this one.
 */
export function UserEditModal({
  userId,
  onClose,
}: {
  /** Null means an account that is being created. */
  userId: string | null;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation('admin');
  const isNew = userId === null;

  const [tiers, setTiers] = useState<Tier[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [tag, setTag] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [initialIsAdmin, setInitialIsAdmin] = useState(false);
  // Null until the account is loaded, and for a new one (which has no verification yet).
  const [verification, setVerification] = useState<Verification | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [granting, setGranting] = useState(false);
  // The server's age-verification mode. Null while loading, and when it cannot be read: then no grant is offered.
  const [ageMode, setAgeMode] = useState<AgeVerificationMode | null>(null);
  const [tierId, setTierId] = useState<string>('');
  // The plan the person is on now, which is not the one assigned when they have paid for another.
  const [inUse, setInUse] = useState<{ tierId: string | null; source: UserTierSource } | null>(
    null,
  );
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tierError, setTierError] = useState<string | null>(null);
  const [giftOpen, setGiftOpen] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  /** After creating: the dialog over this one showing the codes exactly once. */
  const [created, setCreated] = useState<{ id: string; codes: string[] } | null>(null);

  useEffect(() => {
    TierApiService.list()
      .then(setTiers)
      .catch((err) =>
        setTierError(err instanceof Error ? err.message : t('userForm.loadTiersFailed')),
      );
  }, [t]);

  useEffect(() => {
    if (isNew) return;
    let ignore = false;
    RegistrationSettingsApiService.get()
      .then((loaded) => {
        if (!ignore) setAgeMode(loaded.ageVerificationMode ?? null);
      })
      .catch(() => {
        if (!ignore) setAgeMode(null);
      });
    return () => {
      ignore = true;
    };
  }, [isNew]);

  useEffect(() => {
    if (isNew || !userId) return;
    let ignore = false;
    setLoading(true);
    AdminUserApiService.get(userId)
      .then((u) => {
        if (ignore) return;
        setUsername(u.username);
        setTag(u.tag);
        setIsAdmin(u.isAdmin);
        setInitialIsAdmin(u.isAdmin);
        setVerification(verificationOf(u));
        setTierId(u.tierId ?? '');
        setInUse(u.tierSource ? { tierId: u.effectiveTierId ?? null, source: u.tierSource } : null);
        setBio(u.bio ?? '');
      })
      .catch((err) => {
        if (!ignore) setError(err.message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [userId, isNew]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const grantingAdmin = isAdmin && (isNew || !initialIsAdmin);
      if (
        grantingAdmin &&
        !confirm(
          isNew
            ? t('userForm.confirmAdmin')
            : `Grant admin access to "${username}"? They will be able to manage the panel.`,
        )
      ) {
        return;
      }

      if (isNew) {
        const createdUser = await AdminUserApiService.create({
          username,
          password,
          tag: tag || undefined,
          isAdmin,
          tierId: tierId || null,
        });
        setCreated({ id: createdUser.id, codes: createdUser.recoveryCodes });
        return;
      } else if (userId) {
        // No verification field here: it changes only through its own buttons (mark and revoke), never on save.
        await AdminUserApiService.update(userId, {
          isAdmin,
          tierId: tierId || null,
          tag: tag || undefined,
          bio: bio || null,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  /** The one verification change an administrator can make. Revoking takes the account out of every +18 story. */
  const onRevoke = async () => {
    if (!userId || revoking) return;
    if (!confirm(t('userForm.confirmRevoke', { username }))) return;
    setRevoking(true);
    setError(null);
    try {
      await AdminUserApiService.update(userId, { isAdultVerified: false });
      setVerification((current) => current && { ...current, isAdultVerified: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('userForm.revokeFailed'));
    } finally {
      setRevoking(false);
    }
  };

  /** Manual mode only: the server refuses a grant in `required`, where the service alone verifies. */
  const onGrant = async () => {
    if (!userId || granting) return;
    if (!confirm(t('userForm.confirmGrant', { username }))) return;
    setGranting(true);
    setError(null);
    try {
      await AdminUserApiService.update(userId, { isAdultVerified: true });
      setVerification(
        (current) =>
          current && {
            ...current,
            isAdultVerified: true,
            verificationStatus: 'active',
            verifiedAt: new Date(),
            verificationMethod: 'manual',
          },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t('userForm.grantFailed'));
    } finally {
      setGranting(false);
    }
  };

  const verifiedDate =
    verification?.verifiedAt != null
      ? new Date(verification.verifiedAt).toLocaleDateString(i18n.language)
      : null;
  const verifiedLine = verifiedDate
    ? verification?.verificationMethod
      ? t('userForm.verifiedWithMethod', {
          method: verification.verificationMethod,
          date: verifiedDate,
        })
      : t('userForm.verifiedOn', { date: verifiedDate })
    : t('userForm.verifiedPlain');

  return (
    <Modal
      title={isNew ? t('userForm.newTitle') : t('userForm.editTitle', { username })}
      onClose={onClose}
    >
      {loading ? (
        <p className="loading-text">{t('common.loading')}</p>
      ) : (
        <div>
          <form className="form-card" onSubmit={(e) => void onSubmit(e)}>
            {isNew && (
              <>
                <label>
                  {t('userForm.username')}
                  <input value={username} onChange={(e) => setUsername(e.target.value)} required />
                </label>
                <label>
                  {t('userForm.password')}
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </label>
              </>
            )}
            <label>
              {t('userForm.tag')}
              <input
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                // The tag the account will start with: the username read as a slug (see deriveUserTag).
                placeholder={isNew ? slugifyUserTag(username) || t('userForm.tagPlaceholder') : ''}
              />
            </label>
            {!isNew && (
              <label>
                {t('userForm.bio')}
                <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={200} />
              </label>
            )}
            <label>
              {t('userForm.tier')}
              <select value={tierId} onChange={(e) => setTierId(e.target.value)}>
                <option value="">{t('userForm.tierNone')}</option>
                {tiers.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </label>
            {inUse && (inUse.source === 'subscription' || inUse.source === 'default') && (
              <p className="hint" data-testid="tier-in-use">
                {t(
                  inUse.source === 'subscription'
                    ? 'userForm.tierInUseSubscription'
                    : 'userForm.tierInUseDefault',
                  {
                    name:
                      tiers.find((entry) => entry.id === inUse.tierId)?.name ?? inUse.tierId ?? '',
                  },
                )}
              </p>
            )}
            {tierError && <p className="error-text">{tierError}</p>}
            <label className="checkbox-label switch">
              <input
                type="checkbox"
                checked={isAdmin}
                onChange={(e) => setIsAdmin(e.target.checked)}
              />
              {t('userForm.adminAccess')}
            </label>
            {!isNew && verification && (
              <div className="verification-card" data-testid="verification">
                <p>
                  <strong>{t('userForm.verificationTitle')}</strong>{' '}
                  {verification.verificationStatus === 'pending' && (
                    <span className="status-badge">{t('users.standingPending')}</span>
                  )}
                  {verification.verificationStatus === 'rejected' && (
                    <span className="status-badge">{t('users.standingRejected')}</span>
                  )}
                </p>
                <p data-testid="verification-state">
                  {verification.isAdultVerified ? verifiedLine : t('userForm.notVerified')}
                </p>
                {verification.isAdultVerified && (
                  <button
                    type="button"
                    className="button-danger"
                    disabled={revoking || saving}
                    onClick={() => void onRevoke()}
                  >
                    {revoking ? t('userForm.revoking') : t('userForm.revoke')}
                  </button>
                )}
                {!verification.isAdultVerified && ageMode === 'manual' && (
                  <button
                    type="button"
                    disabled={granting || saving}
                    onClick={() => void onGrant()}
                  >
                    {granting ? t('userForm.granting') : t('userForm.grant')}
                  </button>
                )}
                {ageMode && (
                  <p className="hint" data-testid="verification-source">
                    {t(
                      ageMode === 'manual'
                        ? 'userForm.verificationSourceManual'
                        : 'userForm.verificationSourceRequired',
                    )}
                  </p>
                )}
              </div>
            )}
            {error && <p className="error-text">{error}</p>}
            <div className="form-actions">
              <button type="submit" disabled={saving}>
                {saving ? t('common.saving') : t('common.save')}
              </button>
              <button type="button" className="button-secondary" onClick={onClose}>
                {t('common.cancel')}
              </button>
            </div>
          </form>
          {!isNew && userId && (
            <div className="form-actions modal-secondary-actions">
              <Link
                to={`/activity?user=${encodeURIComponent(userId)}`}
                className="button button-secondary"
              >
                {t('users.viewActivity')}
              </Link>
              <button type="button" onClick={() => setGiftOpen(true)}>
                {t('userForm.gift.title')}
              </button>
              <button type="button" onClick={() => setRecoveryOpen(true)}>
                {t('userForm.openRecovery')}
              </button>
            </div>
          )}
        </div>
      )}
      {giftOpen && userId && (
        <Modal title={t('userForm.gift.title')} onClose={() => setGiftOpen(false)}>
          <GiftPlanSection userId={userId} username={username} tiers={tiers} titleHidden />
        </Modal>
      )}
      {recoveryOpen && userId && (
        <RecoveryCodesModal
          username={username}
          userId={userId}
          initialCodes={null}
          onClose={() => setRecoveryOpen(false)}
        />
      )}
      {created && (
        <RecoveryCodesModal
          username={username}
          userId={created.id}
          initialCodes={created.codes}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}
