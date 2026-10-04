import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { Tier, UserTierSource } from '@keres/shared';
import { slugifyUserTag } from '@keres/shared/utils/userTag';
import { GiftPlanSection } from './GiftPlanSection';
import { RecoveryCodesModal } from './RecoveryCodesModal';
import { Modal } from '../../components/Modal';
import { AdminUserApiService } from '../../api/AdminUserApiService';
import { TierApiService } from '../../api/TierApiService';

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
  const { t } = useTranslation('admin');
  const isNew = userId === null;

  const [tiers, setTiers] = useState<Tier[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [tag, setTag] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [initialIsAdmin, setInitialIsAdmin] = useState(false);
  const [isAdultVerified, setIsAdultVerified] = useState(false);
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
        setIsAdultVerified(u.isAdultVerified);
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
        await AdminUserApiService.update(userId, {
          isAdmin,
          isAdultVerified,
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
            <label className="checkbox-label switch">
              <input
                type="checkbox"
                checked={isAdultVerified}
                onChange={(e) => setIsAdultVerified(e.target.checked)}
              />
              {t('userForm.adultVerified')}
            </label>
            <p className="hint">{t('userForm.adultVerifiedHint')}</p>
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
