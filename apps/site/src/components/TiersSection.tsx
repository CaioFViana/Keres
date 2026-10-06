import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchLandingTiers, type LandingTier, type LandingTiersResponse } from '../api/landing';
import { formatBytes, formatPrice, yearlyDiscountPercent } from '../content/pricing';
import { SITE_TEXT_CONTEXT } from '../variant';

type TiersState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; data: LandingTiersResponse };

function TierCard({ tier, currency }: { tier: LandingTier; currency: string }) {
  const { t, i18n } = useTranslation();

  const limit = (label: string, value: number | null, format: (n: number) => string = String) => (
    <li>
      <span>{label}</span> <strong>{value === null ? t('tiers.unlimited') : format(value)}</strong>
    </li>
  );

  const monthly = tier.priceMonthlyCents;
  const yearly = tier.priceYearlyCents;
  const discount = yearlyDiscountPercent(monthly, yearly);
  // Every card renders the same two price rows - a hero and a sub-line - so the limits lists
  // below start at the same height on every card. A missing second row is a spacer, never
  // a missing element.
  const hero = monthly ?? yearly;
  const heroPeriod = monthly !== null ? t('tiers.perMonth') : t('tiers.perYear');
  const showYearlyLine = monthly !== null && yearly !== null && !(monthly === 0 && yearly === 0);
  const heroPrice =
    hero === null ? null : hero === 0 ? (
      t('tiers.free')
    ) : (
      <>
        {formatPrice(hero, currency, i18n.language)}
        <span className="tier-period">{heroPeriod}</span>
      </>
    );

  return (
    <article className={`feature-card tier-card${tier.isDefault ? ' is-default' : ''}`}>
      <h3>
        {tier.name}
        {tier.isDefault && <span className="tier-badge">{t('tiers.defaultBadge')}</span>}
      </h3>
      <div className="tier-prices">
        <p className="tier-price">{heroPrice ?? <a href="#contact">{t('tiers.customPrice')}</a>}</p>
        <p className="tier-subprice">
          {showYearlyLine ? (
            <>
              {formatPrice(yearly as number, currency, i18n.language)}
              <span className="tier-period">{t('tiers.perYear')}</span>
              {discount !== null && (
                <span className="tier-badge">
                  {t('tiers.yearlyDiscount', { percent: discount })}
                </span>
              )}
            </>
          ) : (
            ' '
          )}
        </p>
      </div>
      <ul className="tier-limits">
        {limit(t('tiers.stories'), tier.maxStories)}
        {limit(t('tiers.entitiesPerStory'), tier.maxEntitiesPerStory)}
        {limit(t('tiers.entitiesTotal'), tier.maxEntitiesTotal)}
        {limit(t('tiers.storagePerStory'), tier.maxStorageBytesPerStory, formatBytes)}
        {limit(t('tiers.storageTotal'), tier.maxStorageBytesTotal, formatBytes)}
        {tier.maxPublicationsPerDay === 0 ? (
          <li>
            <span>{t('tiers.publicationsPerDay')}</span> <strong>{t('tiers.none')}</strong>
          </li>
        ) : (
          limit(t('tiers.publicationsPerDay'), tier.maxPublicationsPerDay)
        )}
        {tier.maxPublishedArcs === undefined ? null : tier.maxPublishedArcs === 0 ? (
          <li>
            <span>{t('tiers.publishedArcs')}</span> <strong>{t('tiers.none')}</strong>
          </li>
        ) : (
          limit(t('tiers.publishedArcs'), tier.maxPublishedArcs)
        )}
      </ul>
    </article>
  );
}

export function TiersSection() {
  const { t } = useTranslation();
  const [state, setState] = useState<TiersState>({ status: 'loading' });

  const load = () => {
    setState({ status: 'loading' });
    fetchLandingTiers()
      .then((data) => setState({ status: 'ready', data }))
      .catch(() => setState({ status: 'error' }));
  };
  useEffect(load, []);

  return (
    <section className="band" id="tiers">
      <div className="section-inner">
        <header className="section-head">
          <h2>{t('tiers.title')}</h2>
          <p>{t('tiers.lead', { context: SITE_TEXT_CONTEXT })}</p>
        </header>
        {state.status === 'loading' && <p className="muted">{t('tiers.loading')}</p>}
        {state.status === 'error' && (
          <p>
            {t('tiers.loadFailed')}{' '}
            <button type="button" className="button button-ghost" onClick={load}>
              {t('tiers.retry')}
            </button>
          </p>
        )}
        {state.status === 'ready' &&
          (state.data.tiers.length === 0 ? (
            <p className="muted">{t('tiers.empty', { context: SITE_TEXT_CONTEXT })}</p>
          ) : (
            <>
              <div className="tiers-grid">
                {state.data.tiers.map((tier) => (
                  <TierCard key={tier.id} tier={tier} currency={state.data.currency} />
                ))}
              </div>
              <p className="tiers-contact">
                <a className="button button-primary" href="#contact">
                  {t('tiers.contactCta')}
                </a>
              </p>
            </>
          ))}
      </div>
    </section>
  );
}
