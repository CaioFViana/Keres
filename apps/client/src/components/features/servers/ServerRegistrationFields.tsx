import FormField from '@/src/components/common/forms/FormField/FormField';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { useTheme } from '../../../theme';

export type ServerAuthMode = 'login' | 'register' | 'recover';

interface ServerRegistrationFieldsProps {
  serverId?: string;
  mode: ServerAuthMode;
  onModeChange: (mode: ServerAuthMode) => void;
  hostedSameOrigin: boolean;
  serverAddress: string;
  onServerAddressChange: (value: string) => void;
  serverName: string;
  onServerNameChange: (value: string) => void;
  username: string;
  onUsernameChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  confirmPassword: string;
  onConfirmPasswordChange: (value: string) => void;
  recoveryCode: string;
  onRecoveryCodeChange: (value: string) => void;
  inputStyle: StyleProp<TextStyle>;
}

export default function ServerRegistrationFields({
  serverId,
  mode,
  onModeChange,
  hostedSameOrigin,
  serverAddress,
  onServerAddressChange,
  serverName,
  onServerNameChange,
  username,
  onUsernameChange,
  password,
  onPasswordChange,
  confirmPassword,
  onConfirmPasswordChange,
  recoveryCode,
  onRecoveryCodeChange,
  inputStyle,
}: ServerRegistrationFieldsProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <>
      {!serverId && mode !== 'recover' && (
        <View style={[styles.modeToggleRow, { borderColor: colors.border }]}>
          <TouchableOpacity
            style={[
              styles.modeToggleButton,
              mode === 'login' && { backgroundColor: colors.primary },
            ]}
            onPress={() => onModeChange('login')}
          >
            <Text
              style={[
                styles.modeToggleText,
                { color: mode === 'login' ? colors.onPrimary : colors.text },
              ]}
            >
              {t('log_in')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modeToggleButton,
              mode === 'register' && { backgroundColor: colors.primary },
            ]}
            onPress={() => onModeChange('register')}
          >
            <Text
              style={[
                styles.modeToggleText,
                { color: mode === 'register' ? colors.onPrimary : colors.text },
              ]}
            >
              {t('create_account')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {!serverId && mode === 'recover' && (
        <Text style={{ color: colors.textSecondary, marginBottom: 20 }}>
          {t('recover_account_description')}
        </Text>
      )}

      {hostedSameOrigin && (
        <Text style={[styles.hostedNotice, { color: colors.textSecondary }]}>
          {t('hosted_web_same_origin_notice')}
        </Text>
      )}

      <FormField label={t('server_address')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('server_address_placeholder')}
            value={serverAddress}
            onChangeText={onServerAddressChange}
            style={inputStyle}
            keyboardType="url"
            autoCapitalize="none"
            editable={!hostedSameOrigin}
          />
        )}
      </FormField>

      <FormField label={t('server_name_optional')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('server_name_placeholder')}
            value={serverName}
            onChangeText={onServerNameChange}
            style={inputStyle}
          />
        )}
      </FormField>

      <FormField label={t('username')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('username_placeholder')}
            value={username}
            onChangeText={onUsernameChange}
            style={inputStyle}
            autoCapitalize="none"
          />
        )}
      </FormField>

      {!serverId && (mode === 'login' || mode === 'register') && (
        <FormField label={t('password')}>
          {(fieldAccessibility) => (
            <TextInput
              {...fieldAccessibility}
              placeholder={t('password_placeholder')}
              value={password}
              onChangeText={onPasswordChange}
              style={inputStyle}
              secureTextEntry
            />
          )}
        </FormField>
      )}

      {!serverId && mode === 'login' && (
        <TouchableOpacity onPress={() => onModeChange('recover')} style={styles.linkRow}>
          <Text style={[styles.linkText, { color: colors.primary }]}>
            {t('forgot_password_link')}
          </Text>
        </TouchableOpacity>
      )}

      {!serverId && mode === 'register' && (
        <FormField label={t('confirm_new_password')}>
          {(fieldAccessibility) => (
            <TextInput
              {...fieldAccessibility}
              placeholder={t('confirm_new_password_placeholder')}
              value={confirmPassword}
              onChangeText={onConfirmPasswordChange}
              style={inputStyle}
              secureTextEntry
            />
          )}
        </FormField>
      )}

      {!serverId && mode === 'recover' && (
        <>
          <FormField label={t('recovery_code_label')}>
            {(fieldAccessibility) => (
              <TextInput
                {...fieldAccessibility}
                placeholder={t('recovery_code_placeholder')}
                value={recoveryCode}
                onChangeText={onRecoveryCodeChange}
                style={inputStyle}
                autoCapitalize="characters"
              />
            )}
          </FormField>
          <FormField label={t('new_password')}>
            {(fieldAccessibility) => (
              <TextInput
                {...fieldAccessibility}
                placeholder={t('new_password_placeholder')}
                value={password}
                onChangeText={onPasswordChange}
                style={inputStyle}
                secureTextEntry
              />
            )}
          </FormField>
          <FormField label={t('confirm_new_password')}>
            {(fieldAccessibility) => (
              <TextInput
                {...fieldAccessibility}
                placeholder={t('confirm_new_password_placeholder')}
                value={confirmPassword}
                onChangeText={onConfirmPasswordChange}
                style={inputStyle}
                secureTextEntry
              />
            )}
          </FormField>
          <TouchableOpacity onPress={() => onModeChange('login')} style={styles.linkRow}>
            <Text style={[styles.linkText, { color: colors.primary }]}>{t('back_to_login')}</Text>
          </TouchableOpacity>
        </>
      )}

      {!!serverId && (
        <>
          <FormField label={t('new_password_optional')}>
            {(fieldAccessibility) => (
              <TextInput
                {...fieldAccessibility}
                placeholder={t('new_password_placeholder')}
                value={password}
                onChangeText={onPasswordChange}
                style={inputStyle}
                secureTextEntry
              />
            )}
          </FormField>
          <Text style={{ color: colors.textSecondary, marginBottom: 20 }}>
            {t('change_password_warning')}
          </Text>
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  hostedNotice: { fontSize: 14, marginBottom: 12, lineHeight: 20 },
  modeToggleRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 10,
  },
  modeToggleButton: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  modeToggleText: { fontSize: 15, fontWeight: 'bold' },
  linkRow: { marginTop: 8, alignSelf: 'flex-start' },
  linkText: { fontSize: 14, fontWeight: '600' },
});
