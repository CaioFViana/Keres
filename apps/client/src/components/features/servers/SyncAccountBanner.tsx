import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import { useResponsiveLayout } from '@/src/hooks/ui/useResponsiveLayout';
import { useTheme } from '@/src/theme';

interface SyncAccountBannerProps {
  /** Goes to Server management, which leads on to the default server. */
  onCreateAccount: () => void;
  onLater: () => void;
}

/**
 * A bar over the story list: synchronization and collaboration need an account. Dismissed by either of
 * its two answers, and never shown again (see `useSyncAccountNotice`).
 */
const SyncAccountBanner: React.FC<SyncAccountBannerProps> = ({ onCreateAccount, onLater }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { isCompact } = useResponsiveLayout();

  return (
    <View
      style={[
        styles.bar,
        isCompact ? styles.barStacked : styles.barRow,
        { backgroundColor: colors.primaryContainer },
      ]}
      testID="sync-account-banner"
    >
      <View style={styles.message}>
        <Ionicons name="cloud-outline" size={22} color={colors.primary} />
        <View style={styles.text}>
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: colors.onPrimaryContainer }]}
          >
            {t('sync_prompt_title')}
          </Text>
          <Text style={[styles.body, { color: colors.onPrimaryContainer }]}>
            {t('sync_prompt_message')}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Button onPress={onCreateAccount} testID="sync-account-banner-action">
          {t('sync_prompt_action')}
        </Button>
        <TouchableOpacity
          onPress={onLater}
          accessibilityRole="button"
          testID="sync-account-banner-later"
          style={styles.later}
        >
          <Text style={[styles.laterText, { color: colors.onPrimaryContainer }]}>
            {t('sync_prompt_later')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: { borderRadius: 12, padding: 14, marginBottom: 16, gap: 12 },
  barRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  barStacked: {},
  // flexGrow/flexShrink rather than `flex: 1`, which collapses the width on react-native-web.
  message: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flexGrow: 1, flexShrink: 1 },
  text: { flexGrow: 1, flexShrink: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 0 },
  later: { paddingVertical: 4 },
  laterText: { fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
});

export default SyncAccountBanner;
