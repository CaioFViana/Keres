import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import type { ThemeColors } from '@/src/theme';
import { useTheme } from '@/src/theme';

export interface DefaultServerCardProps {
  /** The address the card is about: shown, and where signing in leads. */
  url: string;
  /** The hosted web client's own server instead of the official one. */
  hosted?: boolean;
  onPress: () => void;
}

/**
 * Where a person with no account is invited: the server the app points at, with a line on what an
 * account is for. Once there is an account it is the server's own row that takes this place.
 */
const DefaultServerCard: React.FC<DefaultServerCardProps> = ({ url, hosted = false, onPress }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.card} testID="default-server-card">
      <View style={styles.titleRow}>
        <Ionicons name="cloud-outline" size={22} color={colors.primary} />
        <Text style={styles.title}>
          {hosted ? t('default_server_title_hosted') : t('default_server_title')}
        </Text>
      </View>
      <Text style={styles.url} numberOfLines={1}>
        {url}
      </Text>
      <Text style={styles.invite}>{t('default_server_invite')}</Text>
      <Text style={styles.detail}>{t('default_server_invite_detail')}</Text>
      <Button onPress={onPress} testID="default-server-cta">
        {t('default_server_cta')}
      </Button>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      gap: 8,
      padding: 15,
      marginBottom: 14,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.card,
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { flexShrink: 1, fontSize: 18, fontWeight: 'bold', color: colors.text },
    url: { fontSize: 14, color: colors.textSecondary },
    invite: { fontSize: 15, fontWeight: '600', color: colors.text },
    detail: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: 4 },
  });

export default DefaultServerCard;
