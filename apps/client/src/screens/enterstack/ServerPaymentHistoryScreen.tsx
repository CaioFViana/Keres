import DetailContainer from '@/src/components/layout/DetailContainer/DetailContainer';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { usePaymentHistory } from '../../hooks/usePaymentHistory';
import { useServerStatuses } from '../../hooks/useServerStatuses';
import type { ServerManagementStackParamList } from '../../navigation/StorySelectionStack';
import type { ThemeColors } from '../../theme';
import { useTheme } from '../../theme';
import { formatMoney } from '../../utils/paymentPlans';

type RouteProps = RouteProp<ServerManagementStackParamList, 'ServerPaymentHistory'>;

/**
 * A server's payment history for this person: what was paid, when, for which plan and how much - and what
 * failed or was given. It comes from the server and a copy is kept on the device, so it can be read offline;
 * nothing here can change a payment, and the provider's own references never reach the device (the id shown
 * is the server's, enough to quote when asking an administrator about a payment).
 */
const ServerPaymentHistoryScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation();
  const { serverId } = useRoute<RouteProps>().params;
  const { servers, loading, error } = useServerStatuses(serverId);
  const server = servers[0];
  const online = server?.pingStatus === 'online';
  const history = usePaymentHistory(server, online);

  useScreenHeader({ target: 'parent', title: t('payment_history_title') });

  if (loading && !server) return <ScreenLoading />;
  if (error || !server) {
    return <ScreenError message={error ?? t('server_not_found')} onGoBack={navigation.goBack} />;
  }
  if (!history.loaded) return <ScreenLoading />;

  const kindLabel = (kind: string) => t(`payment_history_kind_${kind}`);
  const when = (date: Date) =>
    `${date.toLocaleDateString(i18n.language)} ${date.toLocaleTimeString(i18n.language, {
      hour: '2-digit',
      minute: '2-digit',
    })}`;

  return (
    <DetailContainer>
      <Text style={styles.intro}>{t('payment_history_intro')}</Text>
      {history.stale ? (
        <Text style={styles.hint} testID="payment-history-saved-copy">
          {t('payment_history_saved_copy')}
        </Text>
      ) : null}

      {history.items.length === 0 ? (
        <Text style={styles.hint} testID="payment-history-empty">
          {t('payment_history_empty')}
        </Text>
      ) : (
        <View style={styles.card}>
          {history.items.map((item, index) => {
            const failed = item.kind === 'payment_failed';
            return (
              <View
                key={item.id}
                style={[styles.row, index === history.items.length - 1 && styles.lastRow]}
                testID={`payment-history-${item.id}`}
              >
                <View style={styles.main}>
                  <Text style={styles.title}>
                    {item.tierName ?? t('payment_history_unknown_plan')}
                  </Text>
                  <Text style={[styles.detail, failed && styles.bad]}>
                    {kindLabel(item.kind)} · {when(item.createdAt)}
                  </Text>
                  <Text style={styles.id} selectable>
                    {t('payment_history_id', { id: item.id })}
                  </Text>
                </View>
                {item.amountCents !== null && item.currency && item.kind === 'payment_succeeded' ? (
                  <Text style={styles.amount}>
                    {formatMoney(item.amountCents, item.currency, i18n.language)}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </DetailContainer>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    intro: { fontSize: 14, color: colors.textSecondary, marginBottom: 16 },
    hint: { fontSize: 13, color: colors.textSecondary, marginBottom: 12 },
    card: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.card,
      paddingHorizontal: 14,
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
    main: { flexShrink: 1, gap: 2 },
    title: { fontSize: 15, fontWeight: '600', color: colors.text },
    detail: { fontSize: 13, color: colors.textSecondary },
    id: { fontSize: 11, color: colors.textSecondary },
    bad: { color: colors.error },
    amount: { fontSize: 15, fontWeight: '600', color: colors.text },
  });

export default ServerPaymentHistoryScreen;
