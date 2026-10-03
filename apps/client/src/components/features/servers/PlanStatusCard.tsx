import type { Subscription } from '@keres/shared';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '../../../theme';
import { useTheme } from '../../../theme';
import { formatMoney } from '../../../utils/paymentPlans';

export interface PlanStatusCardProps {
  subscription: Subscription;
  /** Shows the amount too (the plan screen); the server's own screen keeps to the dates. */
  showAmount?: boolean;
}

/**
 * Where a paid plan stands: which plan, whether it is paid up, and until when. Shown only for a subscription,
 * so a user on a free plan - or on a server that sells nothing - never sees a card with nothing to say.
 */
const PlanStatusCard: React.FC<PlanStatusCardProps> = ({ subscription, showAmount }) => {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const paidUntil = new Date(subscription.paidUntil).toLocaleDateString(i18n.language);
  // A plan the administrators gave is not "paid up" and has no amount: it is a gift until its date.
  const gift = subscription.complimentary === true && subscription.status === 'active';
  const statusKey =
    subscription.status === 'due'
      ? 'payment_status_due'
      : gift
        ? 'payment_status_gift'
        : subscription.cancelAtPeriodEnd
          ? 'payment_status_ending'
          : 'payment_status_active';

  const row = (label: string, value: string, last = false, tone?: 'bad') => (
    <View style={[styles.row, last && styles.lastRow]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, tone === 'bad' && styles.bad]} selectable>
        {value}
      </Text>
    </View>
  );

  return (
    <View style={styles.card} testID="plan-status-card">
      {row(
        t('payment_plan_field'),
        gift
          ? subscription.tierName
          : `${subscription.tierName} · ${t(`payment_interval_${subscription.interval}`)}`,
      )}
      {row(
        t('payment_status_field'),
        t(statusKey),
        false,
        subscription.status === 'due' ? 'bad' : undefined,
      )}
      {row(
        subscription.status === 'due' ? t('payment_paid_until_was') : t('payment_paid_until'),
        paidUntil,
        !showAmount || gift,
      )}
      {showAmount && !gift
        ? row(
            t('payment_last_amount'),
            formatMoney(subscription.amountCents, subscription.currency, i18n.language),
            true,
          )
        : null}
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.card,
      paddingHorizontal: 14,
      marginBottom: 20,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    lastRow: { borderBottomWidth: 0 },
    label: { fontSize: 14, color: colors.textSecondary },
    value: { flexShrink: 1, fontSize: 14, color: colors.text, textAlign: 'right' },
    bad: { color: colors.error, fontWeight: '600' },
  });

export default PlanStatusCard;
