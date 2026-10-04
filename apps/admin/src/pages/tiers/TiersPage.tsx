import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Tier, TierCreateInput } from '@keres/shared';
import { yearlyDiscountPercent } from '@keres/shared/utils/tierPricing';
import { RegistrationSettingsApiService } from '../../api/RegistrationSettingsApiService';
import { TierApiService } from '../../api/TierApiService';
import { Modal } from '../../components/Modal';
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
  playMonthlyProductId: null,
  playYearlyProductId: null,
  webMonthlyEnabled: true,
  webYearlyEnabled: true,
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

/** One label/value row inside a tier card's group. */
function fact(label: string, value: ReactNode) {
  return (
    <div className="tier-fact">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function TiersPage() {
  const { t, i18n } = useTranslation('admin');
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Bumped whenever a record is loaded into the form, so inputs that keep their own text start over.
  const [formVersion, setFormVersion] = useState(0);
  const [form, setForm] = useState<TierCreateInput>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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
      playMonthlyProductId: tier.playMonthlyProductId ?? null,
      playYearlyProductId: tier.playYearlyProductId ?? null,
      webMonthlyEnabled: tier.webMonthlyEnabled ?? true,
      webYearlyEnabled: tier.webYearlyEnabled ?? true,
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
    // The API rejects negatives, but the form should say so itself instead of round-tripping a 400.
    const ceilings = [
      form.maxStories,
      form.maxEntitiesPerStory,
      form.maxEntitiesTotal,
      form.maxStorageBytesPerStory,
      form.maxStorageBytesTotal,
      form.maxPublicationsPerDay,
      form.maxMessagesPerDay,
    ];
    if (
      ceilings.some(
        (value) => value !== null && value !== undefined && (!Number.isInteger(value) || value < 0),
      )
    ) {
      setError(t('common.nonNegativeInteger'));
      return;
    }
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
      setNotice(err instanceof Error ? err.message : t('common.deleteFailed'));
    }
  };

  const limitInput = (label: string, key: keyof TierCreateInput) => (
    <label>
      {label} <span className="hint">{t('common.blankUnlimited')}</span>
      <input
        type="number"
        min={0}
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

  /** The Play Console subscription id selling this period; blank means not sold in the app. */
  const productInput = (label: string, key: 'playMonthlyProductId' | 'playYearlyProductId') => (
    <label>
      {label} <span className="hint">{t('tiers.playProductsHint')}</span>
      <input
        type="text"
        value={form[key] ?? ''}
        onChange={(e) => {
          const trimmed = e.target.value.trim();
          setForm((f) => ({ ...f, [key]: trimmed === '' ? null : trimmed }));
        }}
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

      <div className="notice" data-testid="free-plan-note">
        <p>{t('tiers.freePlanNote')}</p>
        <p>{t('tiers.paidOnlyNote')}</p>
      </div>

      {error && <p className="error-text">{error}</p>}

      {editingId && (
        <Modal
          title={editingId === 'new' ? t('tiers.newTier') : t('tiers.editTier')}
          onClose={cancel}
        >
          <form className="form-card" onSubmit={(e) => void save(e)}>
            <label>
              {t('tiers.name')}
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </label>
            <label className="checkbox-label switch">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
              />
              {t('tiers.isDefault')}
            </label>
            <p className="hint" data-testid="default-note">
              {t('tiers.defaultNote')}
            </p>
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
            <label className="checkbox-label switch">
              <input
                type="checkbox"
                checked={form.isPublicForSale ?? false}
                onChange={(e) => setForm((f) => ({ ...f, isPublicForSale: e.target.checked }))}
              />
              {t('tiers.forSale')}
            </label>
            {priceInput(t('tiers.priceMonthly'), 'priceMonthlyCents')}
            {priceInput(t('tiers.priceYearly'), 'priceYearlyCents')}
            {productInput(t('tiers.playMonthlyProduct'), 'playMonthlyProductId')}
            {productInput(t('tiers.playYearlyProduct'), 'playYearlyProductId')}
            <label className="check">
              <input
                type="checkbox"
                checked={form.webMonthlyEnabled ?? true}
                onChange={(e) => setForm((f) => ({ ...f, webMonthlyEnabled: e.target.checked }))}
              />
              {t('tiers.webMonthly')} <span className="hint">{t('tiers.webHint')}</span>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={form.webYearlyEnabled ?? true}
                onChange={(e) => setForm((f) => ({ ...f, webYearlyEnabled: e.target.checked }))}
              />
              {t('tiers.webYearly')} <span className="hint">{t('tiers.webHint')}</span>
            </label>
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
        </Modal>
      )}

      {loading ? (
        <p className="loading-text">{t('common.loading')}</p>
      ) : tiers.length === 0 ? (
        <p className="empty-state">{t('tiers.empty')}</p>
      ) : (
        <div className="tier-grid">
          {tiers.map((tier) => (
            <article
              key={tier.id}
              className={`tier-card${tier.isDeleted ? ' is-deleted' : ''}`}
              aria-label={tier.name}
            >
              <div className="tier-card-head">
                <h3>{tier.name}</h3>
                <div className="tier-badges">
                  {tier.isDefault && (
                    <span className="status-badge accent">{t('tiers.columnDefault')}</span>
                  )}
                  {tier.isPublicForSale && !tier.isDeleted && (
                    <span className="status-badge accent">{t('tiers.columnForSale')}</span>
                  )}
                  {tier.isDeleted && (
                    <span className="status-badge deleted">{t('tiers.statusDeleted')}</span>
                  )}
                </div>
              </div>
              <section aria-label={t('tiers.groupLimits')}>
                <h4>{t('tiers.groupLimits')}</h4>
                <dl className="tier-facts">
                  {fact(t('tiers.maxStories'), tier.maxStories ?? '∞')}
                  {fact(t('tiers.columnMaxEntitiesPerStory'), tier.maxEntitiesPerStory ?? '∞')}
                  {fact(t('tiers.maxEntitiesTotal'), tier.maxEntitiesTotal ?? '∞')}
                  {fact(t('tiers.columnMaxPublicationsPerDay'), tier.maxPublicationsPerDay ?? '∞')}
                  {fact(t('tiers.columnMaxMessagesPerDay'), tier.maxMessagesPerDay ?? '∞')}
                </dl>
              </section>
              <section aria-label={t('tiers.groupStorage')}>
                <h4>{t('tiers.groupStorage')}</h4>
                <dl className="tier-facts">
                  {fact(
                    t('tiers.columnMaxStoragePerStory'),
                    formatStorage(tier.maxStorageBytesPerStory),
                  )}
                  {fact(t('tiers.columnMaxStorageTotal'), formatStorage(tier.maxStorageBytesTotal))}
                </dl>
              </section>
              <section aria-label={t('tiers.groupPrices')}>
                <h4>{t('tiers.groupPrices')}</h4>
                <dl className="tier-facts">
                  {fact(t('tiers.columnPriceMonthly'), formatPrice(tier.priceMonthlyCents))}
                  {fact(t('tiers.columnPriceYearly'), formatPrice(tier.priceYearlyCents))}
                </dl>
              </section>
              <section aria-label={t('tiers.groupStores')}>
                <h4>{t('tiers.groupStores')}</h4>
                <dl className="tier-facts">
                  {fact(t('tiers.playMonthlyProduct'), tier.playMonthlyProductId ?? '—')}
                  {fact(t('tiers.playYearlyProduct'), tier.playYearlyProductId ?? '—')}
                  {fact(
                    t('tiers.webMonthly'),
                    (tier.webMonthlyEnabled ?? true) ? t('tiers.yes') : t('tiers.no'),
                  )}
                  {fact(
                    t('tiers.webYearly'),
                    (tier.webYearlyEnabled ?? true) ? t('tiers.yes') : t('tiers.no'),
                  )}
                </dl>
              </section>
              {!tier.isDeleted && (
                <div className="tier-card-actions">
                  <button type="button" onClick={() => startEdit(tier)}>
                    {t('common.edit')}
                  </button>
                  <button type="button" className="button-danger" onClick={() => void remove(tier)}>
                    {t('common.delete')}
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {notice && (
        <Modal title={t('common.notice')} onClose={() => setNotice(null)}>
          <p>{notice}</p>
        </Modal>
      )}
    </div>
  );
}
