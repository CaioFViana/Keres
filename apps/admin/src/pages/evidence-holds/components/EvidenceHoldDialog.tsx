import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  EVIDENCE_HOLD_DEFAULT_DAYS,
  EVIDENCE_HOLD_MAX_DAYS,
} from '@keres/shared/metadata/EvidenceHolds';
import { EvidenceHoldsApiService, type EvidenceHoldDetail } from '@/api/EvidenceHoldsApiService';
import { Modal } from '@/components/Modal';

interface EvidenceHoldDialogProps {
  id: string;
  onClose: () => void;
  /** Called after the hold changed on the server, so the list behind the dialog reads again. */
  onChanged: () => void;
}

/**
 * One hold: the copy of the item as it was reported (read only), when it lasts until, and the two things an
 * administrator may do with it: extend it when an authority asks, or let it go when the report was unfounded.
 */
export function EvidenceHoldDialog({ id, onClose, onChanged }: EvidenceHoldDialogProps) {
  const { t, i18n } = useTranslation('admin');
  const [hold, setHold] = useState<EvidenceHoldDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Kept as typed, so a half-typed number is not reset under the administrator's hand.
  const [days, setDays] = useState(String(EVIDENCE_HOLD_DEFAULT_DAYS));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Opening the dialog reads the hold, and that read is itself on the activity record (by the server).
  useEffect(() => {
    let ignore = false;
    EvidenceHoldsApiService.get(id)
      .then((detail) => {
        if (!ignore) setHold(detail);
      })
      .catch((err: unknown) => {
        if (!ignore) setLoadError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      ignore = true;
    };
  }, [id]);

  const when = (value: string) => new Date(value).toLocaleString(i18n.language);

  const extend = async (event: FormEvent) => {
    event.preventDefault();
    const count = Number(days);
    if (!Number.isInteger(count) || count < 1 || count > EVIDENCE_HOLD_MAX_DAYS) {
      setNotice(t('evidenceHolds.daysRange', { max: EVIDENCE_HOLD_MAX_DAYS }));
      return;
    }
    setBusy(true);
    try {
      const updated = await EvidenceHoldsApiService.extend(id, count);
      setHold((current) => (current ? { ...current, ...updated } : current));
      onChanged();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : t('common.actionFailed'));
    } finally {
      setBusy(false);
    }
  };

  const release = async () => {
    if (!confirm(t('evidenceHolds.confirmRelease'))) return;
    setBusy(true);
    try {
      await EvidenceHoldsApiService.release(id);
      onChanged();
      onClose();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : t('common.deleteFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={t('evidenceHolds.dialogTitle')} onClose={onClose}>
      {loadError && <p className="error-text">{loadError}</p>}
      {!hold && !loadError && <p className="loading-text">{t('common.loading')}</p>}
      {hold && (
        <>
          <div className="detail-panel">
            <dl>
              <dt>{t('evidenceHolds.columnTarget')}</dt>
              <dd>
                {t(`evidenceHolds.targets.${hold.targetKind}`)} <code>{hold.targetId}</code>
              </dd>
              <dt>{t('evidenceHolds.columnSubject')}</dt>
              <dd>{hold.subjectUserId ? <code>{hold.subjectUserId}</code> : '-'}</dd>
              <dt>{t('evidenceHolds.columnCreated')}</dt>
              <dd>{when(hold.createdAt)}</dd>
              <dt>{t('evidenceHolds.columnExpires')}</dt>
              <dd>{when(hold.expiresAt)}</dd>
              <dt>{t('evidenceHolds.columnMadeBy')}</dt>
              <dd>
                {hold.createdBy === null
                  ? t('evidenceHolds.automatic')
                  : t('evidenceHolds.byAdmin')}
              </dd>
              <dt>{t('evidenceHolds.columnNote')}</dt>
              <dd>{hold.note ?? '-'}</dd>
            </dl>
            <p className="hint">{t('evidenceHolds.copyTitle')}</p>
            <pre>{JSON.stringify(hold.snapshot, null, 2)}</pre>
          </div>

          <form className="form-card" onSubmit={(e) => void extend(e)}>
            <label>
              {t('evidenceHolds.extendLabel')}
              <input
                type="number"
                min={1}
                max={EVIDENCE_HOLD_MAX_DAYS}
                step={1}
                value={days}
                onChange={(e) => setDays(e.target.value)}
              />
            </label>
            <span className="hint">{t('evidenceHolds.extendHint')}</span>
            <div className="form-actions">
              <button type="submit" disabled={busy}>
                {t('evidenceHolds.extend')}
              </button>
            </div>
          </form>

          <div className="form-actions">
            <button
              type="button"
              className="button-danger"
              disabled={busy}
              onClick={() => void release()}
            >
              {t('evidenceHolds.letGo')}
            </button>
          </div>
        </>
      )}
      {notice && (
        <Modal title={t('common.notice')} onClose={() => setNotice(null)}>
          <p>{notice}</p>
        </Modal>
      )}
    </Modal>
  );
}
