import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Tier, TierCreateInput } from '@keres/shared';
import { TierApiService } from '../../api/TierApiService';

const emptyForm: TierCreateInput = {
  name: '',
  isDefault: false,
  maxStories: null,
  maxEntitiesPerStory: null,
  maxEntitiesTotal: null,
  maxStorageBytesPerStory: null,
  maxStorageBytesTotal: null,
};

function toNumberOrNull(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function TiersPage() {
  const { t } = useTranslation('admin');
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TierCreateInput>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    TierApiService.list(true)
      .then(setTiers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const startEdit = (tier: Tier) => {
    setEditingId(tier.id);
    setForm({
      name: tier.name,
      isDefault: tier.isDefault,
      maxStories: tier.maxStories,
      maxEntitiesPerStory: tier.maxEntitiesPerStory,
      maxEntitiesTotal: tier.maxEntitiesTotal,
      maxStorageBytesPerStory: tier.maxStorageBytesPerStory,
      maxStorageBytesTotal: tier.maxStorageBytesTotal,
    });
  };

  const startNew = () => {
    setEditingId('new');
    setForm(emptyForm);
  };

  const cancel = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (editingId === 'new') {
        await TierApiService.create(form);
      } else if (editingId) {
        await TierApiService.update(editingId, form);
      }
      cancel();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (tier: Tier) => {
    if (!confirm(t('tiers.confirmDelete', { name: tier.name }))) return;
    try {
      await TierApiService.softDelete(tier.id);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : t('common.deleteFailed'));
    }
  };

  const limitInput = (label: string, key: keyof TierCreateInput) => (
    <label>
      {label} <span className="hint">{t('common.blankUnlimited')}</span>
      <input
        type="number"
        value={form[key] === null || form[key] === undefined ? '' : String(form[key])}
        onChange={(e) => setForm((f) => ({ ...f, [key]: toNumberOrNull(e.target.value) }))}
      />
    </label>
  );

  return (
    <div>
      <div className="page-header">
        <h1>{t('tiers.title')}</h1>
        <button type="button" onClick={startNew}>
          {t('tiers.newTier')}
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      {editingId && (
        <form className="form-card" onSubmit={(e) => void save(e)}>
          <h3>{editingId === 'new' ? t('tiers.newTier') : t('tiers.editTier')}</h3>
          <label>
            {t('tiers.name')}
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
            />
            {t('tiers.isDefault')}
          </label>
          {limitInput(t('tiers.maxStories'), 'maxStories')}
          {limitInput(t('tiers.maxEntitiesPerStory'), 'maxEntitiesPerStory')}
          {limitInput(t('tiers.maxEntitiesTotal'), 'maxEntitiesTotal')}
          {limitInput(t('tiers.maxStorageBytesPerStory'), 'maxStorageBytesPerStory')}
          {limitInput(t('tiers.maxStorageBytesTotal'), 'maxStorageBytesTotal')}
          <div className="form-actions">
            <button type="submit" disabled={saving}>
              {saving ? t('common.saving') : t('common.save')}
            </button>
            <button type="button" className="button-secondary" onClick={cancel}>
              {t('common.cancel')}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="loading-text">{t('common.loading')}</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('tiers.name')}</th>
                <th>{t('tiers.columnDefault')}</th>
                <th>{t('tiers.maxStories')}</th>
                <th>{t('tiers.columnMaxEntitiesPerStory')}</th>
                <th>{t('tiers.maxEntitiesTotal')}</th>
                <th>{t('tiers.columnMaxStoragePerStory')}</th>
                <th>{t('tiers.columnMaxStorageTotal')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((tier) => (
                <tr key={tier.id} className={tier.isDeleted ? 'row-deleted' : ''}>
                  <td>{tier.name}</td>
                  <td>{tier.isDefault ? t('common.yes') : ''}</td>
                  <td>{tier.maxStories ?? '∞'}</td>
                  <td>{tier.maxEntitiesPerStory ?? '∞'}</td>
                  <td>{tier.maxEntitiesTotal ?? '∞'}</td>
                  <td>{tier.maxStorageBytesPerStory ?? '∞'}</td>
                  <td>{tier.maxStorageBytesTotal ?? '∞'}</td>
                  <td>
                    {!tier.isDeleted && (
                      <div className="table-actions">
                        <button type="button" onClick={() => startEdit(tier)}>
                          {t('common.edit')}
                        </button>
                        <button
                          type="button"
                          className="button-danger"
                          onClick={() => void remove(tier)}
                        >
                          {t('common.delete')}
                        </button>
                      </div>
                    )}
                    {tier.isDeleted && (
                      <span className="status-badge deleted">{t('tiers.statusDeleted')}</span>
                    )}
                  </td>
                </tr>
              ))}
              {tiers.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty-state">
                    {t('tiers.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
