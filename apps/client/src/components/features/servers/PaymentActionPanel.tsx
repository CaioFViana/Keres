import type { Checkout } from '@keres/shared';
import * as Clipboard from 'expo-clipboard';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '../../../theme';
import { useTheme } from '../../../theme';
import Button from '../../common/controls/Button/Button';

export interface PaymentActionPanelProps {
  phase: 'starting' | 'pending' | 'paid' | 'failed' | 'expired';
  checkout: Checkout | null;
  onOpenProviderPage: () => void;
  /** Leaves this attempt and goes back to choosing a plan. */
  onDone: () => void;
}

/**
 * What the person has to do next to pay, and how it ended. One generic panel for every payment provider: the
 * server says whether to open a page or follow instructions, and the provider's own page is where the way to
 * pay is entered - nothing of it passes through here.
 */
const PaymentActionPanel: React.FC<PaymentActionPanelProps> = ({
  phase,
  checkout,
  onOpenProviderPage,
  onDone,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [copied, setCopied] = useState(false);

  if (phase === 'starting') {
    return (
      <View style={styles.panel} testID="payment-panel-starting">
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.text}>{t('payment_starting')}</Text>
      </View>
    );
  }

  if (phase === 'paid') {
    return (
      <View style={styles.panel} testID="payment-panel-paid">
        <Text style={styles.title}>{t('payment_paid_title')}</Text>
        <Text style={styles.text}>{t('payment_paid_message', { plan: checkout?.tierName })}</Text>
        <Button onPress={onDone} testID="payment-done">
          {t('payment_done')}
        </Button>
      </View>
    );
  }

  if (phase === 'failed' || phase === 'expired') {
    return (
      <View style={styles.panel} testID={`payment-panel-${phase}`}>
        <Text style={[styles.title, styles.bad]}>
          {t(phase === 'failed' ? 'payment_failed_title' : 'payment_expired_title')}
        </Text>
        {checkout?.failureReason ? <Text style={styles.text}>{checkout.failureReason}</Text> : null}
        <Text style={styles.text}>
          {t(phase === 'failed' ? 'payment_failed_message' : 'payment_expired_message')}
        </Text>
        <Button onPress={onDone} testID="payment-try-again">
          {t('payment_try_again')}
        </Button>
      </View>
    );
  }

  const action = checkout?.action;
  const copy = async (text: string) => {
    await Clipboard.setStringAsync(text);
    setCopied(true);
  };

  return (
    <View style={styles.panel} testID="payment-panel-pending">
      <Text style={styles.title}>
        {checkout ? t('payment_pending_title', { plan: checkout.tierName }) : ''}
      </Text>
      {action?.kind === 'redirect' ? (
        <>
          <Text style={styles.text}>{t('payment_redirect_message')}</Text>
          <Button onPress={onOpenProviderPage} testID="payment-open-provider">
            {t('payment_open_provider')}
          </Button>
        </>
      ) : null}
      {action?.kind === 'instructions' ? (
        <>
          <Text style={styles.subtitle}>{action.title}</Text>
          <Text style={styles.text} selectable>
            {action.text}
          </Text>
          {action.copyText ? (
            <>
              <Text style={styles.code} selectable testID="payment-copy-text">
                {action.copyText}
              </Text>
              <Button onPress={() => void copy(action.copyText as string)} testID="payment-copy">
                {copied ? t('payment_copied') : t('payment_copy')}
              </Button>
            </>
          ) : null}
        </>
      ) : null}
      {action?.kind === 'none' ? (
        <Text style={styles.text}>{t('payment_automatic_message')}</Text>
      ) : null}
      <View style={styles.waiting}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.hint}>{t('payment_waiting_confirmation')}</Text>
      </View>
      <Button onPress={onDone} style={styles.secondary} testID="payment-cancel-attempt">
        {t('payment_choose_another')}
      </Button>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    panel: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.card,
      padding: 16,
      gap: 12,
      marginBottom: 20,
    },
    title: { fontSize: 18, fontWeight: 'bold', color: colors.text },
    subtitle: { fontSize: 15, fontWeight: '600', color: colors.text },
    text: { fontSize: 14, color: colors.text },
    hint: { fontSize: 13, color: colors.textSecondary, flexShrink: 1 },
    bad: { color: colors.error },
    code: {
      fontSize: 14,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 6,
      padding: 10,
    },
    waiting: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    secondary: { backgroundColor: colors.border },
  });

export default PaymentActionPanel;
