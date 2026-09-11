import Button from '@/src/components/common/controls/Button/Button';
import EntityFormContainer from '@/src/components/common/forms/EntityFormContainer/EntityFormContainer';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../theme';

interface ServerRecoveryCodesPanelProps {
  codes: string[];
  onContinue: () => void;
}

export default function ServerRecoveryCodesPanel({
  codes,
  onContinue,
}: ServerRecoveryCodesPanelProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <EntityFormContainer
      title={t('recovery_codes_title')}
      description={t('recovery_codes_warning')}
      actions={<Button onPress={onContinue}>{t('recovery_codes_continue_button')}</Button>}
    >
      <View style={[styles.box, { borderColor: colors.border }]}>
        {codes.map((code) => (
          <Text key={code} selectable style={[styles.code, { color: colors.text }]}>
            {code}
          </Text>
        ))}
      </View>
    </EntityFormContainer>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  code: {
    fontSize: 16,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    marginBottom: 8,
  },
});
