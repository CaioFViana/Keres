import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AdminUserSubscription, Tier } from '@keres/shared';
import { GIFT_MAX_MONTHS, GIFT_PROVIDER_ID } from '@keres/shared/metadata/Payments';
import { PaymentsApiService } from '../../api/PaymentsApiService';

/**
 * Gives a person a plan for a number of months. It is a payment of zero: it extends the plan they are on or opens
 * a period, nothing renews it, and what they pay afterwards starts where it ends. When they are on a paid
 * subscription that a provider still charges, for another plan, that renewal has to be cancelled first - which
 * needs the administrator to confirm that the person agreed to it.
 */
export function GiftPlanSection({
  userId,
  username,
  tiers,
}: {
  userId: string;
  username: string;
  tiers: Tier[];
}) {
  const { t, i18n } = useTranslation('admin');
  const [current, setCurrent] = useState<AdminUserSubscription | null>(null);
  const [tierId, setTierId] = useState('');
  const [months, setMonths] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    PaymentsApiService.userSubscription(userId)
      .then((result) => {
        if (!ignore) setCurrent(result);
      })
      .catch((err) => {
        if (!ignore) setError(err instanceof Error ? err.message : t('userForm.gift.failed'));
      });
    return () => {
      ignore = true;
    };
  }, [userId, t]);

  const subscription = current?.subscription ?? null;
  const day = (iso: string) => new Date(iso).toLocaleDateString(i18n.language);
  const tierName = (id: string) => tiers.find((entry) => entry.id === id)?.name ?? id;
  // A provider that may still charge the person, for a plan other than the one being given.
  const needsCancel =
    !!subscription &&
    !!tierId &&
    subscription.status !== 'canceled' &&
    subscription.providerId !== GIFT_PROVIDER_ID &&
    !!subscription.providerReference &&
    !subscription.cancelAtPeriodEnd &&
    subscription.tierId !== tierId;

  const give = async () => {
    if (!tierId) return;
    const values = {
      username,
      plan: tierName(tierId),
      current: subscription ? tierName(subscription.tierId) : '',
      months,
    };
    const question = needsCancel
      ? t('userForm.gift.confirmCancel', values) +
        (current?.canCancelAtProvider ? '' : ` ${t('userForm.gift.confirmCancelManual')}`)
      : t('userForm.gift.confirm', values);
    if (!confirm(question)) return;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const result = await PaymentsApiService.giveGift(userId, {
        tierId,
        months,
        ...(needsCancel ? { cancelRenewal: true, consent: true } : {}),
      });
      setCurrent(result);
      setDone(
        t('userForm.gift.done', {
          ...values,
          date: result.subscription ? day(result.subscription.paidUntil) : '',
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t('userForm.gift.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="form-card" data-testid="gift-plan">
      <h2>{t('userForm.gift.title')}</h2>
      <p className="hint">{t('userForm.gift.hint')}</p>
      <p data-testid="gift-current">
        {subscription
          ? t('userForm.gift.now', {
              plan: tierName(subscription.tierId),
              status: t(`payments.statuses.${subscription.status}`),
              date: day(subscription.paidUntil),
            }) +
            ' ' +
            (subscription.providerId === GIFT_PROVIDER_ID
              ? t('userForm.gift.isGift')
              : subscription.cancelAtPeriodEnd
                ? t('userForm.gift.notRenewing')
                : t('userForm.gift.renewing'))
          : t('userForm.gift.none')}
      </p>
      <div>
        <label>
          {t('userForm.gift.plan')}
          <select value={tierId} onChange={(event) => setTierId(event.target.value)}>
            <option value="">{t('userForm.gift.choose')}</option>
            {tiers.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('userForm.gift.months')}
          <input
            type="number"
            min={1}
            max={GIFT_MAX_MONTHS}
            value={months}
            onChange={(event) => setMonths(Number(event.target.value))}
          />
        </label>
      </div>
      {needsCancel && subscription && (
        <p className="notice" role="alert" data-testid="gift-needs-cancel">
          {t('userForm.gift.needsCancel', { current: tierName(subscription.tierId) })}
          {current?.canCancelAtProvider ? '' : ` ${t('userForm.gift.cannotCancelAtProvider')}`}
        </p>
      )}
      <button
        type="button"
        className={needsCancel ? 'button-danger' : undefined}
        disabled={busy || !tierId || months < 1 || months > GIFT_MAX_MONTHS}
        onClick={() => void give()}
      >
        {needsCancel ? t('userForm.gift.cancelAndGive') : t('userForm.gift.give')}
      </button>
      {done && (
        <p className="success-text" role="status" data-testid="gift-done">
          {done}
        </p>
      )}
      {error && <p className="error-text">{error}</p>}
    </section>
  );
}
