import Button from '@/src/components/common/controls/Button/Button';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import ModalHeader from '@/src/components/layout/ModalHeader/ModalHeader';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { useTheme } from '@/src/theme';
import { space, typography } from '@/src/theme/tokens';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

interface DeleteAccountModalProps {
  visible: boolean;
  serverName: string;
  /** Days until personal data is erased, as the terms promise. */
  eraseDays: number;
  working: boolean;
  error: string | null;
  onConfirm: (currentPassword: string) => void;
  onClose: () => void;
  testID?: string;
}

/**
 * Deleting the account on a server, spelled out before it happens: immediate deactivation,
 * erasure within the promised days, contributions to others' stories staying, and no refunds.
 * The current password confirms it is really the owner asking.
 */
const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({
  visible,
  serverName,
  eraseDays,
  working,
  error,
  onConfirm,
  onClose,
  testID = 'delete-account-modal',
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [password, setPassword] = useState('');

  // The password never survives the modal closing: each opening starts empty.
  const close = () => {
    setPassword('');
    onClose();
  };

  return (
    <ResponsiveModal visible={visible} onClose={close} inset="regular" tone="raised">
      <ModalHeader
        title={t('delete_account_title')}
        subtitle={serverName}
        onClose={close}
        bordered
        closeTestID={`${testID}-close`}
      />
      <View style={styles.body}>
        <Text style={[typography.body, { color: colors.text }]}>
          {t('delete_account_disclaimer', { days: eraseDays })}
        </Text>
        <Text style={[typography.body, { color: colors.text }]}>
          {t('delete_account_keeps_contributions')}
        </Text>
        <Text style={[typography.body, { color: colors.text }]}>
          {t('delete_account_no_refunds')}
        </Text>
        <TextInput
          placeholder={t('current_password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!working}
          testID={`${testID}-password`}
          accessibilityLabel={t('current_password')}
        />
        {error ? <Text style={[typography.body, { color: colors.error }]}>{error}</Text> : null}
        <Button
          variant="destructive"
          onPress={() => onConfirm(password)}
          disabled={working || password.length === 0}
          testID={`${testID}-confirm`}
        >
          {working ? <ActivityIndicator color={colors.onPrimary} /> : t('delete_account_confirm')}
        </Button>
      </View>
    </ResponsiveModal>
  );
};

const styles = StyleSheet.create({
  body: { gap: space.md, padding: space.xl },
});

export default DeleteAccountModal;
