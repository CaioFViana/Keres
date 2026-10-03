import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../components/Modal';
import { AdminUserApiService } from '../../api/AdminUserApiService';

/**
 * The "lost access to their account" flow as a dialog over the user form: it
 * explains that only new codes will work from now on, regenerates them behind
 * a confirmation, and shows the fresh codes exactly once (they exist only as
 * hashes on the server afterwards). Also used right after creating an account,
 * when the codes are already known and there is nothing to regenerate.
 */
export function RecoveryCodesModal({
  username,
  userId,
  initialCodes,
  onClose,
}: {
  username: string;
  userId: string | null;
  initialCodes: string[] | null;
  onClose: () => void;
}) {
  const { t } = useTranslation('admin');
  /** Shown only once - after this, only each one's hash exists on the server. */
  const [codes, setCodes] = useState<string[] | null>(initialCodes);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const onRegenerate = async () => {
    if (!userId) return;
    setConfirming(false);
    setBusy(true);
    setError(null);
    try {
      const { recoveryCodes } = await AdminUserApiService.regenerateRecoveryCodes(userId);
      setCodes(recoveryCodes);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('userForm.regenerateFailed'));
    } finally {
      setBusy(false);
    }
  };

  const copyCodes = async () => {
    if (!codes) return;
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      setCopyMessage(t('userForm.copied'));
    } catch {
      setCopyMessage(t('userForm.copyFailed'));
    }
  };

  return (
    <Modal
      title={codes ? t('userForm.recoveryTitle', { username }) : t('userForm.lockedOutTitle')}
      onClose={onClose}
    >
      {codes ? (
        <div>
          <p className="hint">{t('userForm.recoveryHint')}</p>
          <ul>
            {codes.map((code) => (
              <li key={code} className="mono-code">
                {code}
              </li>
            ))}
          </ul>
          {copyMessage && <p className="success-text">{copyMessage}</p>}
          {error && <p className="error-text">{error}</p>}
          <div className="form-actions">
            <button type="button" onClick={() => void copyCodes()}>
              {t('userForm.copyCodes')}
            </button>
            <button type="button" className="button-secondary" onClick={onClose}>
              {t('common.done')}
            </button>
          </div>
        </div>
      ) : (
        <div>
          {confirming ? (
            <p className="notice" role="alert">
              {t('userForm.confirmRegenerate', { username })}
            </p>
          ) : (
            <p className="hint">{t('userForm.lockedOutHint')}</p>
          )}
          {error && <p className="error-text">{error}</p>}
          <div className="form-actions">
            {confirming ? (
              <>
                <button
                  type="button"
                  className="button-danger"
                  onClick={() => void onRegenerate()}
                  disabled={busy}
                >
                  {busy ? t('userForm.regenerating') : t('userForm.regenerate')}
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => setConfirming(false)}
                  disabled={busy}
                >
                  {t('common.cancel')}
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setConfirming(true)} disabled={!userId}>
                  {t('userForm.regenerate')}
                </button>
                <button type="button" className="button-secondary" onClick={onClose}>
                  {t('common.cancel')}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
