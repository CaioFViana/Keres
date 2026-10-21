import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import { useTheme } from '@/src/theme';

interface ShowcaseGuestBannerProps {
  /** The address of the server, for the person to see where this comes from. */
  origin: string;
  onRegister: () => void;
}

/** Said above what comes from a server the person has not registered: read as a visitor, with nothing of theirs. */
const ShowcaseGuestBanner: React.FC<ShowcaseGuestBannerProps> = ({ origin, onRegister }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <View
      testID="showcase-guest-banner"
      style={[styles.banner, { borderColor: colors.border, backgroundColor: colors.surface }]}
    >
      <View style={styles.texts}>
        <View style={styles.heading}>
          <Ionicons name="globe-outline" size={18} color={colors.textSecondary} />
          <Text style={[styles.title, { color: colors.text }]}>{t('showcase_guest_title')}</Text>
        </View>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          {t('showcase_guest_body', { server: origin })}
        </Text>
      </View>
      <Button
        variant="secondary"
        icon="add-circle-outline"
        onPress={onRegister}
        testID="showcase-guest-register"
      >
        {t('showcase_guest_register')}
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 10, marginBottom: 16 },
  texts: { gap: 4 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 15, fontWeight: '600' },
  body: { fontSize: 13, lineHeight: 19 },
});

export default ShowcaseGuestBanner;
