import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '../../../../theme';

interface SyncConflictBannerProps {
  count: number;
  onPress: () => void;
}

/**
 * A tappable, non-blocking line summarising how many sync conflicts are waiting for review - the same
 * visual convention as `AnalysisSummaryBanner` (`SummaryCard.tsx`). It replaces the old
 * `SyncConflictModal`, which opened itself over any screen: a conflict stalls that entity's
 * synchronization, but it does not justify interrupting what the user is doing.
 */
const SyncConflictBanner: React.FC<SyncConflictBannerProps> = ({ count, onPress }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  if (count === 0) {
    return null;
  }

  const styles = StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 8,
      padding: 12,
      marginBottom: 10,
      backgroundColor: colors.error,
    },
    text: {
      flex: 1,
      marginLeft: 10,
      fontSize: 14,
      fontWeight: 'bold',
      color: colors.onPrimary,
    },
  });

  return (
    <TouchableOpacity style={styles.banner} onPress={onPress} activeOpacity={0.8}>
      <Ionicons name="git-compare-outline" size={22} color={colors.onPrimary} />
      <Text style={styles.text}>{t('sync_conflicts_banner', { count })}</Text>
      <Ionicons name="chevron-forward" size={20} color={colors.onPrimary} />
    </TouchableOpacity>
  );
};

export default SyncConflictBanner;
