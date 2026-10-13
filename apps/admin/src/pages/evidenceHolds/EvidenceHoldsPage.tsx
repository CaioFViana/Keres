import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { EvidenceHoldSummary } from '@keres/shared/metadata/EvidenceHolds';
import {
  EVIDENCE_HOLD_DEFAULT_DAYS,
  EVIDENCE_HOLD_MAX_NOTE,
  EVIDENCE_HOLD_TARGETS,
} from '@keres/shared/metadata/EvidenceHolds';
import type { EvidenceHoldTarget } from '@keres/shared/metadata/EvidenceHolds';
import { EvidenceHoldsApiService } from '../../api/EvidenceHoldsApiService';
import { Modal } from '../../components/Modal';
import { EvidenceHoldDialog } from './EvidenceHoldDialog';

const LIST_LIMIT = 100;

interface KeepForm {
  targetKind: EvidenceHoldTarget;
  targetId: string;
  reportMessageId: string;
  note: string;
}

const EMPTY_KEEP: KeepForm = { targetKind: 'story', targetId: '', reportMessageId: '', note: '' };

/**
 * The evidence holds: copies of reported items, and of the data of the account responsible, kept under secrecy
 * for the time the law asks. Made by the server on an `illegal` report, or by hand here for any report.
 */
export function EvidenceHoldsPage() {
  const { t, i18n } = useTranslation('admin');
  const [includeExpired, setIncludeExpired] = useState(false);
  // Bumped after a hold is kept, extended or let go, so the list reads again.
  const [version, setVersion] = useState(0);
  const [holds, setHolds] = useState<EvidenceHoldSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [keep, setKeep] = useState<KeepForm>(EMPTY_KEEP);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(null);
    EvidenceHoldsApiService.list({ limit: LIST_LIMIT, includeExpired })
      .then((page) => {
        if (!ignore) setHolds(page.items);
      })
      .catch((err: unknown) => {
        if (!ignore) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [includeExpired, version]);

  const reload = () => setVersion((current) => current + 1);

  const onKeep = async (event: FormEvent) => {
    event.preventDefault();
    const { targetKind } = keep;
    const targetId = keep.targetId.trim();
    const reportMessageId = keep.reportMessageId.trim();
    const note = keep.note.trim();
    if (!targetId) return;
    setSaving(true);
    try {
      // Blank optional fields are left out of the body, not sent as empty values.
      await EvidenceHoldsApiService.create({
        targetKind,
        targetId,
        ...(reportMessageId ? { reportMessageId } : {}),
        ...(note ? { note } : {}),
      });
      setKeep({ ...EMPTY_KEEP, targetKind });
      reload();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : t('common.actionFailed'));
    } finally {
      setSaving(false);
    }
  };

  const when = (value: string) => new Date(value).toLocaleString(i18n.language);
  const isExpired = (hold: EvidenceHoldSummary) => new Date(hold.expiresAt).getTime() <= Date.now();

  return (
    <div>
      <div className="page-header">
        <h1>{t('evidenceHolds.title')}</h1>
      </div>
      <p className="hint">{t('evidenceHolds.intro')}</p>
      <p className="hint">
        {t('evidenceHolds.retentionNote', { days: EVIDENCE_HOLD_DEFAULT_DAYS })}
      </p>

      <form className="form-card" onSubmit={(e) => void onKeep(e)}>
        <h3>{t('evidenceHolds.keepTitle')}</h3>
        <label>
          {t('evidenceHolds.keepTargetKind')}
          <select
            value={keep.targetKind}
            onChange={(e) => setKeep({ ...keep, targetKind: e.target.value as EvidenceHoldTarget })}
          >
            {EVIDENCE_HOLD_TARGETS.map((value) => (
              <option key={value} value={value}>
                {t(`evidenceHolds.targets.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('evidenceHolds.keepTargetId')}
          <input
            required
            value={keep.targetId}
            onChange={(e) => setKeep({ ...keep, targetId: e.target.value })}
          />
        </label>
        <label>
          {t('evidenceHolds.keepReportMessageId')}
          <input
            value={keep.reportMessageId}
            onChange={(e) => setKeep({ ...keep, reportMessageId: e.target.value })}
          />
        </label>
        <label>
          {t('evidenceHolds.keepNote')}
          <textarea
            rows={2}
            maxLength={EVIDENCE_HOLD_MAX_NOTE}
            value={keep.note}
            onChange={(e) => setKeep({ ...keep, note: e.target.value })}
          />
        </label>
        <div className="form-actions">
          <button type="submit" disabled={saving}>
            {t('evidenceHolds.keepSubmit')}
          </button>
        </div>
      </form>

      <div className="toolbar">
        <label className="checkbox-label switch">
          <input
            type="checkbox"
            checked={includeExpired}
            onChange={(e) => setIncludeExpired(e.target.checked)}
          />
          {t('evidenceHolds.showExpired')}
        </label>
      </div>

      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p className="loading-text">{t('common.loading')}</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('evidenceHolds.columnCreated')}</th>
                <th>{t('evidenceHolds.columnExpires')}</th>
                <th>{t('evidenceHolds.columnTarget')}</th>
                <th>{t('evidenceHolds.columnSubject')}</th>
                <th>{t('evidenceHolds.columnReports')}</th>
                <th>{t('evidenceHolds.columnMadeBy')}</th>
                <th>{t('evidenceHolds.columnNote')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {holds.map((hold) => (
                <tr key={hold.id} className={isExpired(hold) ? 'row-deleted' : ''}>
                  <td>{when(hold.createdAt)}</td>
                  <td>
                    {when(hold.expiresAt)}
                    {isExpired(hold) && (
                      <>
                        {' '}
                        <span className="hint">{t('evidenceHolds.expiredBadge')}</span>
                      </>
                    )}
                  </td>
                  <td>
                    <span className="status-badge">
                      {t(`evidenceHolds.targets.${hold.targetKind}`)}
                    </span>{' '}
                    <code>{hold.targetId}</code>
                  </td>
                  <td>
                    {hold.subjectUserId ? (
                      <Link to={`/users/${hold.subjectUserId}`}>
                        <code>{hold.subjectUserId}</code>
                      </Link>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>{hold.reportMessageIds.length}</td>
                  <td>
                    {hold.createdBy === null ? (
                      <span className="status-badge accent">{t('evidenceHolds.automatic')}</span>
                    ) : (
                      t('evidenceHolds.byAdmin')
                    )}
                  </td>
                  <td>{hold.note ?? '-'}</td>
                  <td>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => setViewing(hold.id)}
                    >
                      {t('evidenceHolds.view')}
                    </button>
                  </td>
                </tr>
              ))}
              {holds.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty-state">
                    {t('evidenceHolds.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {viewing && (
        <EvidenceHoldDialog id={viewing} onClose={() => setViewing(null)} onChanged={reload} />
      )}
      {notice && (
        <Modal title={t('common.notice')} onClose={() => setNotice(null)}>
          <p>{notice}</p>
        </Modal>
      )}
    </div>
  );
}
