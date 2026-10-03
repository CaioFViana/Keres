import Button from '@/src/components/common/controls/Button/Button';
import DetailContainer from '@/src/components/layout/DetailContainer/DetailContainer';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import type { BillingInterval } from '@keres/shared/payments/PaymentPlugin';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import PaymentActionPanel from '../../components/features/servers/PaymentActionPanel';
import PlanStatusCard from '../../components/features/servers/PlanStatusCard';
import { usePaymentOverview } from '../../hooks/usePaymentOverview';
import { usePlanCancellation } from '../../hooks/usePlanCancellation';
import { useSwitchQuote } from '../../hooks/useSwitchQuote';
import { usePlanCheckout } from '../../hooks/usePlanCheckout';
import { useServerStatuses } from '../../hooks/useServerStatuses';
import type { ServerManagementStackParamList } from '../../navigation/StorySelectionStack';
import { useTheme } from '../../theme';
import { formatMoney, offersFrom, type PlanOffer } from '../../utils/paymentPlans';

type ServerPlanRouteProp = RouteProp<ServerManagementStackParamList, 'ServerPlan'>;
type ServerPlanNavigationProp = NativeStackNavigationProp<
  ServerManagementStackParamList,
  'ServerPlan'
>;

/** One plan's ceilings as short lines; a ceiling the plan does not have reads "unlimited". */
function limitLines(
  offer: PlanOffer,
  t: (key: string, options?: Record<string, unknown>) => string,
): string[] {
  const { tier } = offer;
  const stories = tier.maxStories;
  const entities = tier.maxEntitiesTotal;
  const publications = tier.maxPublicationsPerDay;
  return [
    stories === null
      ? t('plan_limit_stories_unlimited')
      : t(stories === 1 ? 'plan_limit_stories_one' : 'plan_limit_stories_other', {
          count: stories,
        }),
    entities === null
      ? t('plan_limit_entities_unlimited')
      : t(entities === 1 ? 'plan_limit_entities_one' : 'plan_limit_entities_other', {
          count: entities,
        }),
    publications === null
      ? t('plan_limit_publications_unlimited')
      : t(publications === 1 ? 'plan_limit_publications_one' : 'plan_limit_publications_other', {
          count: publications,
        }),
  ];
}

/**
 * A server's plans and the way to pay for one. It only exists for a server that sells plans (the entry in the
 * server's own screen is hidden otherwise) and works only while the server answers: the plan, its dates and
 * the payment are the server's, and nothing here is kept on the device.
 *
 * The person chooses a plan, how often and a method; the server says what to do next and the payment itself
 * happens at the provider - no card, no account number is ever typed here.
 */
const ServerPlanScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<ServerPlanNavigationProp>();
  const { serverId } = useRoute<ServerPlanRouteProp>().params;
  const { servers, loading, error } = useServerStatuses(serverId);
  const server = servers[0];
  const online = server?.pingStatus === 'online';
  const { overview, loading: overviewLoading, reload } = usePaymentOverview(server, online);
  const checkout = usePlanCheckout(server);
  const cancelRenewal = usePlanCancellation(server, () => void reload());

  useScreenHeader({ target: 'parent', title: t('server_plan_title') });

  const offers = useMemo(() => offersFrom(overview?.plans), [overview]);
  const [tierId, setTierId] = useState<string | null>(null);
  const [interval, setInterval] = useState<BillingInterval | null>(null);
  const [methodId, setMethodId] = useState<string | null>(null);

  const selected = offers.find((offer) => offer.tier.id === tierId) ?? null;
  const price = selected?.prices.find((entry) => entry.interval === interval) ?? null;
  const subscription = overview?.info.subscription ?? null;
  const currency = overview?.info.currency ?? 'BRL';
  // Changing plan while time is left converts it by value: said before paying, with the server's own numbers.
  const switching =
    online &&
    subscription?.status === 'active' &&
    selected !== null &&
    selected.tier.id !== subscription.tierId;
  const days = (count: number) =>
    t(count === 1 ? 'payment_day_count_one' : 'payment_day_count_other', { count });
  const switchQuote = useSwitchQuote(server, selected?.tier.id ?? null, interval, switching);

  const pick = (offer: PlanOffer) => {
    setTierId(offer.tier.id);
    // Keep the interval if this plan has it; otherwise the first one it is sold in.
    setInterval((current) =>
      offer.prices.some((entry) => entry.interval === current)
        ? current
        : (offer.prices[0]?.interval ?? null),
    );
  };

  const pay = () => {
    if (!selected || !interval || !methodId) return;
    void checkout.start({ tierId: selected.tier.id, interval, methodId });
  };

  const styles = StyleSheet.create({
    intro: { fontSize: 14, color: colors.textSecondary, marginBottom: 16 },
    sectionTitle: {
      fontSize: 13,
      fontWeight: 'bold',
      textTransform: 'uppercase',
      color: colors.textSecondary,
      marginBottom: 8,
    },
    offer: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.card,
      padding: 14,
      marginBottom: 10,
      gap: 4,
    },
    offerSelected: { borderColor: colors.primary, borderWidth: 2 },
    offerName: { fontSize: 17, fontWeight: 'bold', color: colors.text },
    offerLine: { fontSize: 13, color: colors.textSecondary },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    chip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: colors.card,
    },
    chipSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
    chipText: { fontSize: 14, color: colors.text },
    chipTextSelected: { color: colors.background, fontWeight: '600' },
    hint: { fontSize: 13, color: colors.textSecondary, marginBottom: 12 },
    error: { fontSize: 14, color: colors.error, marginBottom: 12 },
    cancelButton: { backgroundColor: colors.border, marginBottom: 20 },
  });

  const chip = (
    key: string,
    label: string,
    active: boolean,
    onPress: () => void,
    testID?: string,
  ) => (
    <Pressable
      key={key}
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && styles.chipSelected]}
    >
      <Text style={[styles.chipText, active && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );

  if (loading && !server) return <ScreenLoading message={t('loading_servers')} />;
  if (error || !server) {
    return (
      <ScreenError message={error ?? t('server_not_found')} onGoBack={() => navigation.goBack()} />
    );
  }
  if (!online) {
    return (
      <DetailContainer>
        <Text style={styles.intro} testID="plan-offline">
          {t('payment_needs_server')}
        </Text>
      </DetailContainer>
    );
  }
  if (!overview) {
    return overviewLoading ? (
      <ScreenLoading message={t('payment_loading')} />
    ) : (
      <DetailContainer>
        <Text style={styles.intro} testID="plan-not-sold">
          {t('payment_not_sold')}
        </Text>
      </DetailContainer>
    );
  }

  const choosing = checkout.phase === 'idle';
  // A server that predates the field says nothing: it renews, as it always did.
  const renewsItself = subscription?.autoRenews !== false;
  const running = subscription?.status === 'active' && !subscription.cancelAtPeriodEnd;
  // With a method the provider charges by itself, stopping it is for the provider to do (or not, when it cannot).
  // With one the person pays again each time there is nothing at the provider to stop: only to say they will not.
  const canStop = running && (subscription.canCancelHere || !renewsItself);

  return (
    <DetailContainer>
      {overview.info.provider ? (
        <Text style={styles.intro}>
          {t('payment_provider_intro', { name: overview.info.provider.displayName })}
        </Text>
      ) : null}

      {subscription ? (
        <>
          <Text style={styles.sectionTitle}>{t('payment_current_plan')}</Text>
          <PlanStatusCard subscription={subscription} showAmount />
          {subscription.status === 'due' ? (
            <Text style={styles.hint} testID="plan-due-fallback">
              {t('payment_due_fallback')}
            </Text>
          ) : null}
          {subscription.complimentary && subscription.status === 'active' ? (
            <Text style={styles.hint} testID="plan-gift">
              {t('payment_gift_until', {
                date: new Date(subscription.paidUntil).toLocaleDateString(i18n.language),
              })}
            </Text>
          ) : null}
          {subscription.cancelAtPeriodEnd &&
          subscription.status === 'active' &&
          !subscription.complimentary ? (
            <Text style={styles.hint} testID="plan-not-renewing">
              {t('payment_not_renewing', {
                date: new Date(subscription.paidUntil).toLocaleDateString(i18n.language),
              })}
            </Text>
          ) : null}
          {canStop ? (
            <Button
              onPress={() => cancelRenewal(subscription.paidUntil, renewsItself)}
              style={styles.cancelButton}
              testID="plan-cancel-renewal"
            >
              {t(renewsItself ? 'payment_cancel_renewal' : 'payment_cancel_no_renewal')}
            </Button>
          ) : null}
          {running && !renewsItself ? (
            <Text style={styles.hint} testID="plan-manual-renewal">
              {t('payment_manual_renewal', {
                date: new Date(subscription.paidUntil).toLocaleDateString(i18n.language),
              })}
            </Text>
          ) : null}
          {running && renewsItself && !subscription.canCancelHere ? (
            <Text style={styles.hint} testID="plan-cancel-at-provider">
              {t('payment_cancel_at_provider')}
            </Text>
          ) : null}
        </>
      ) : null}

      {!choosing ? (
        <PaymentActionPanel
          phase={checkout.phase as 'starting' | 'pending' | 'paid' | 'failed' | 'expired'}
          checkout={checkout.checkout}
          onOpenProviderPage={() => void checkout.openProviderPage()}
          onDone={() => {
            checkout.reset();
            void reload();
          }}
        />
      ) : offers.length === 0 ? (
        <Text style={styles.hint} testID="plan-no-offers">
          {t('payment_no_plans')}
        </Text>
      ) : (
        <>
          <Text style={styles.sectionTitle}>{t('payment_choose_plan')}</Text>
          {offers.map((offer) => (
            <Pressable
              key={offer.tier.id}
              onPress={() => pick(offer)}
              testID={`plan-offer-${offer.tier.id}`}
              accessibilityRole="button"
              accessibilityState={{ selected: offer.tier.id === tierId }}
              style={[styles.offer, offer.tier.id === tierId && styles.offerSelected]}
            >
              <Text style={styles.offerName}>{offer.tier.name}</Text>
              {offer.prices.map((entry) => (
                <Text key={entry.interval} style={styles.offerLine}>
                  {formatMoney(entry.cents, currency, i18n.language)} /{' '}
                  {t(`payment_per_${entry.interval}`)}
                </Text>
              ))}
              {limitLines(offer, t).map((text) => (
                <Text key={text} style={styles.offerLine}>
                  {text}
                </Text>
              ))}
            </Pressable>
          ))}

          {selected ? (
            <>
              <Text style={styles.sectionTitle}>{t('payment_choose_interval')}</Text>
              <View style={styles.chips}>
                {selected.prices.map((entry) =>
                  chip(
                    entry.interval,
                    `${t(`payment_interval_${entry.interval}`)} · ${formatMoney(entry.cents, currency, i18n.language)}`,
                    entry.interval === interval,
                    () => setInterval(entry.interval),
                    `plan-interval-${entry.interval}`,
                  ),
                )}
              </View>
              <Text style={styles.sectionTitle}>{t('payment_choose_method')}</Text>
              <View style={styles.chips}>
                {overview.info.methods.map((method) =>
                  chip(
                    method.id,
                    method.label,
                    method.id === methodId,
                    () => setMethodId(method.id),
                    `plan-method-${method.id}`,
                  ),
                )}
              </View>
              {overview.info.methods.length === 0 ? (
                <Text style={styles.hint}>{t('payment_no_methods')}</Text>
              ) : null}
              {switchQuote ? (
                <Text style={styles.hint} testID="plan-switch-quote">
                  {t('payment_switch_quote', {
                    current: switchQuote.fromTierName,
                    plan: switchQuote.toTierName,
                    remaining: days(switchQuote.remainingDays),
                    converted: days(switchQuote.convertedDays),
                  })}
                </Text>
              ) : null}
              <Text style={styles.hint}>{t('payment_privacy_note')}</Text>
              {checkout.error ? <Text style={styles.error}>{checkout.error}</Text> : null}
              <Button onPress={pay} disabled={!price || !methodId} testID="plan-pay">
                {price
                  ? t('payment_pay_amount', {
                      amount: formatMoney(price.cents, currency, i18n.language),
                    })
                  : t('payment_pay')}
              </Button>
            </>
          ) : null}
        </>
      )}
    </DetailContainer>
  );
};

export default ServerPlanScreen;
