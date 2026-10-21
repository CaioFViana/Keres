import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import { useTheme } from '@/src/theme';

interface ShowcasePasswordGateProps {
  onSubmit: (password: string) => void;
  busy: boolean;
  /** Why the last try did not open the story, already in words. */
  error: string | null;
}

/**
 * What a story behind a password shows in place of itself: only that it is protected - the server says nothing
 * else about it until the password is given.
 */
const ShowcasePasswordGate: React.FC<ShowcasePasswordGateProps> = ({ onSubmit, busy, error }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const submit = () => {
    if (password && !busy) onSubmit(password);
  };

  return (
    <View testID="showcase-password-gate" style={styles.container}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        {t('showcase_gate_title')}
      </Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>{t('showcase_gate_body')}</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={submit}
        placeholder={t('showcase_gate_placeholder')}
        accessibilityLabel={t('showcase_gate_placeholder')}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="go"
        testID="showcase-gate-input"
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" style={[styles.error, { color: colors.error }]}>
          {error}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Button
          icon="lock-open-outline"
          onPress={submit}
          disabled={!password || busy}
          testID="showcase-gate-submit"
        >
          {t('showcase_gate_submit')}
        </Button>
        {busy ? <ActivityIndicator color={colors.primary} /> : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 10 },
  title: { fontSize: 20, fontWeight: 'bold' },
  body: { fontSize: 14, lineHeight: 20 },
  error: { fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
});

export default ShowcasePasswordGate;
