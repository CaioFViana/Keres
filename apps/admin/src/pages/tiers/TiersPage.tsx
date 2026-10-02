import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Tier, TierCreateInput } from '@keres/shared';
import { yearlyDiscountPercent } from '@keres/shared/utils/tierPricing';
import { RegistrationSettingsApiService } from '../../api/RegistrationSettingsApiService';
import { TierApiService } from '../../api/TierApiService';
import { StorageLimitInput } from './StorageLimitInput';
import { formatStorage } from './storageUnits';

const emptyForm: TierCreateInput = {
  name: '',
  isDefault: false,
  maxStories: null,
  maxEntitiesPerStory: null,
  maxEntitiesTotal: null,
  maxStorageBytesPerStory: null,
  maxStorageBytesTotal: null,
  maxPublicationsPerDay: null,
  maxMessagesPerDay: null,
  priceMonthlyCents: null,
  priceYearlyCents: null,
  isPublicForSale: false,
  sortOrder: 0,
};

function toNumberOrNull(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Prices are typed in currency units (19.90) and stored in minor units (1990). */
function toCentsOrNull(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function fromCents(cents: number | null | undefined): string {
  return cents === null || cents === undefined ? '' : String(cents / 100);
}

export function TiersPage() {
  const { t, i18n } = useTranslation('admin');
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Bumped whenever a record is loaded into the form, so inputs that keep their own text start over.
  const [formVersion, setFormVersion] = useState(0);
  const [form, setForm] = useState<TierCreateInput>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // The one system currency prices are expressed in; falls back to BRL until it loads.
  const [currency, setCurrency] = useState('BRL');

  const load = () => {
    setLoading(true);
    TierApiService.list(true)
      .then(setTiers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    RegistrationSettingsApiService.get()
      .then((settings) => setCurrency(settings.currency ?? 'BRL'))
      .catch(() => {});
  };
  useEffect(load, []);

  const startEdit = (tier: Tier) => {
    setEditingId(tier.id);
    setFormVersion((v) => v + 1);
    setForm({
      name: tier.name,
      isDefault: tier.isDefault,
      maxStories: tier.maxStories,
      maxEntitiesPerStory: tier.maxEntitiesPerStory,
      maxEntitiesTotal: tier.maxEntitiesTotal,
      maxStorageBytesPerStory: tier.maxStorageBytesPerStory,
      maxStorageBytesTotal: tier.maxStorageBytesTotal,
      maxPublicationsPerDay: tier.maxPublicationsPerDay,
      maxMessagesPerDay: tier.maxMessagesPerDay,
      priceMonthlyCents: tier.priceMonthlyCents ?? null,
      priceYearlyCents: tier.priceYearlyCents ?? null,
      isPublicForSale: tier.isPublicForSale ?? false,
      sortOrder: tier.sortOrder ?? 0,
    });
  };

  const startNew = () => {
    setEditingId('new');
    setFormVersion((v) => v + 1);
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

  const priceInput = (label: string, key: 'priceMonthlyCents' | 'priceYearlyCents') => (
    <label>
      {label} ({currency}) <span className="hint">{t('tiers.priceHint')}</span>
      <input
        type="number"
        min="0"
        step="0.01"
        value={fromCents(form[key])}
        onChange={(e) => setForm((f) => ({ ...f, [key]: toCentsOrNull(e.target.value) }))}
      />
    </label>
  );

  const formatPrice = (cents: number | null | undefined): string => {
    if (cents === null || cents === undefined) return t('common.none');
    if (cents === 0) return t('tiers.free');
    try {
      return new Intl.NumberFormat(i18n.language, {
        style: 'currency',
        currency,
      }).format(cents / 100);
    } catch {
      return `${(cents / 100).toFixed(2)} ${currency}`;
    }
  };

  const discount = yearlyDiscountPercent(form.priceMonthlyCents, form.priceYearlyCents);

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
          <StorageLimitInput
            key={`${formVersion}-story`}
            label={t('tiers.maxStorageBytesPerStory')}
            value={form.maxStorageBytesPerStory ?? null}
            onChange={(bytes) => setForm((f) => ({ ...f, maxStorageBytesPerStory: bytes }))}
          />
          <StorageLimitInput
            key={`${formVersion}-total`}
            label={t('tiers.maxStorageBytesTotal')}
            value={form.maxStorageBytesTotal ?? null}
            onChange={(bytes) => setForm((f) => ({ ...f, maxStorageBytesTotal: bytes }))}
          />
          {limitInput(t('tiers.maxPublicationsPerDay'), 'maxPublicationsPerDay')}
          {limitInput(t('tiers.maxMessagesPerDay'), 'maxMessagesPerDay')}
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.isPublicForSale ?? false}
              onChange={(e) => setForm((f) => ({ ...f, isPublicForSale: e.target.checked }))}
            />
            {t('tiers.forSale')}
          </label>
          {priceInput(t('tiers.priceMonthly'), 'priceMonthlyCents')}
          {priceInput(t('tiers.priceYearly'), 'priceYearlyCents')}
          {discount !== null && (
            <p className="hint">{t('tiers.yearlyDiscount', { percent: discount })}</p>
          )}
          <label>
            {t('tiers.sortOrder')}
            <input
              type="number"
              step="1"
              value={form.sortOrder ?? 0}
              onChange={(e) =>
                setForm((f) => ({ ...f, sortOrder: toNumberOrNull(e.target.value) ?? 0 }))
              }
            />
          </label>
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
                <th>{t('tiers.columnMaxPublicationsPerDay')}</th>
                <th>{t('tiers.columnMaxMessagesPerDay')}</th>
                <th>{t('tiers.columnPriceMonthly')}</th>
                <th>{t('tiers.columnPriceYearly')}</th>
                <th>{t('tiers.columnForSale')}</th>
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
                  <td>{formatStorage(tier.maxStorageBytesPerStory)}</td>
                  <td>{formatStorage(tier.maxStorageBytesTotal)}</td>
                  <td>{tier.maxPublicationsPerDay ?? '∞'}</td>
                  <td>{tier.maxMessagesPerDay ?? '∞'}</td>
                  <td>{formatPrice(tier.priceMonthlyCents)}</td>
                  <td>{formatPrice(tier.priceYearlyCents)}</td>
                  <td>{tier.isPublicForSale ? t('common.yes') : ''}</td>
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
                  <td colSpan={13} className="empty-state">
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
