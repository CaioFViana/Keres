import FormField from '@/src/components/common/forms/FormField/FormField';
import ScreenSection from '@/src/components/layout/ScreenSection/ScreenSection';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import Button from '@/src/components/common/controls/Button/Button';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import KeyboardAwareScreen from '@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDrizzle } from '../../db';
import type { ServerSelect } from '../../db/schema';
import { useFormScrollBottomPadding } from '../../hooks/useFormScrollBottomPadding';
import type { ServerManagementStackParamList } from '../../navigation/StorySelectionStack';
import { isOfflineError } from '../../services/apiClient';
import { redeemRecoveryCode } from '../../services/AuthApiService';
import { authTokenManager } from '../../services/AuthTokenManager';
import { createServerService } from '../../services/ServerService';
import { userApiService } from '../../services/UserApiService';
import { useTheme } from '../../theme';
import { getCommonContainerStyles, getCommonInputStyles } from '../../theme/commonStyles';
import { AppAlert } from '../../utils/AppAlert';

const MIN_NEW_PASSWORD_LENGTH = 8;

type ChangePasswordScreenRouteProp = RouteProp<ServerManagementStackParamList, 'ChangePassword'>;
type ChangePasswordScreenNavigationProp = NativeStackNavigationProp<
  ServerManagementStackParamList,
  'ChangePassword'
>;

const ChangePasswordScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();

  const { colors } = useTheme();
  const navigation = useNavigation<ChangePasswordScreenNavigationProp>();
  const route = useRoute<ChangePasswordScreenRouteProp>();
  const { serverId } = route.params;
  const drizzleDb = useDrizzle();
  const scrollBottomPadding = useFormScrollBottomPadding();
  const commonContainerStyles = getCommonContainerStyles(colors);
  const commonInputStyles = getCommonInputStyles(colors);

  const [server, setServer] = useState<ServerSelect | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  /** Shown only once - after this only each one's hash exists on the server. */
  const [recoveryCodesToShow, setRecoveryCodesToShow] = useState<string[] | null>(null);
  // 'recover' changes the password with a recovery code instead of the current password - the same path as
  // ServerRegistrationScreen, but without asking for the username/address again: the server is already known.
  const [mode, setMode] = useState<'change' | 'recover'>('change');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const fetchedServer = await createServerService(drizzleDb).getServerById(serverId);
        if (!cancelled) {
          if (!fetchedServer) {
            setError(t('server_not_found'));
          } else {
            setServer(fetchedServer);
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load server:', err);
          setError(t('server_not_found'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [drizzleDb, serverId, t]);

  useScreenHeader({
    target: 'parent',
    title: t('change_password_title'),
  });

  const handleSave = async () => {
    if (!server) return;

    if (newPassword.length < MIN_NEW_PASSWORD_LENGTH) {
      AppAlert.alert(t('error'), t('new_password_too_short'));
      return;
    }
    if (newPassword !== confirmNewPassword) {
      AppAlert.alert(t('error'), t('passwords_do_not_match'));
      return;
    }

    setSaving(true);
    try {
      await userApiService.changeOwnPassword(server, currentPassword, newPassword);
      AppAlert.alert(t('success'), t('password_changed_successfully'));
      navigation.goBack();
    } catch (err: any) {
      console.error('Failed to change password:', err);
      if (isOfflineError(err)) {
        AppAlert.alert(t('error'), t('server_unreachable'));
      } else if (err?.response?.status === 401) {
        AppAlert.alert(t('error'), t('incorrect_current_password'));
      } else {
        AppAlert.alert(t('error'), t('failed_to_change_password'));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateRecoveryCodes = () => {
    if (!server) return;

    AppAlert.alert(
      t('regenerate_recovery_codes_title'),
      t('regenerate_recovery_codes_confirm_message'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('regenerate_recovery_codes_button'),
          onPress: async () => {
            setRegenerating(true);
            try {
              const codes = await userApiService.regenerateRecoveryCodes(server, currentPassword);
              setRecoveryCodesToShow(codes);
            } catch (err: any) {
              console.error('Failed to regenerate recovery codes:', err);
              if (isOfflineError(err)) {
                AppAlert.alert(t('error'), t('server_unreachable'));
              } else if (err?.response?.status === 401) {
                AppAlert.alert(t('error'), t('incorrect_current_password'));
              } else {
                AppAlert.alert(t('error'), t('failed_to_regenerate_recovery_codes'));
              }
            } finally {
              setRegenerating(false);
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  const handleRecoverWithCode = async () => {
    if (!server) return;

    if (!recoveryCode.trim()) {
      AppAlert.alert(t('error'), t('recovery_code_required'));
      return;
    }
    if (newPassword.length < MIN_NEW_PASSWORD_LENGTH) {
      AppAlert.alert(t('error'), t('new_password_too_short'));
      return;
    }
    if (newPassword !== confirmNewPassword) {
      AppAlert.alert(t('error'), t('passwords_do_not_match'));
      return;
    }

    setRecovering(true);
    try {
      const outcome = await redeemRecoveryCode(
        server.url,
        server.userName,
        recoveryCode,
        newPassword,
      );

      if (!outcome.success) {
        if (outcome.reason === 'invalid_code') {
          AppAlert.alert(t('error'), t('recovery_code_invalid'));
        } else {
          AppAlert.alert(t('error'), `${t('server_error')}: ${outcome.status}`);
        }
        return;
      }

      await authTokenManager.updateTokens(
        server.id,
        outcome.result.accessToken,
        outcome.result.refreshToken,
      );
      AppAlert.alert(t('success'), t('password_reset_successfully'));
      navigation.goBack();
    } catch (err) {
      console.error('Failed to recover account with a code:', err);
      if (isOfflineError(err)) {
        AppAlert.alert(t('error'), t('server_unreachable'));
      } else {
        AppAlert.alert(t('error'), t('failed_to_change_password'));
      }
    } finally {
      setRecovering(false);
    }
  };

  const styles = StyleSheet.create({
    scrollViewContent: { padding: 20, paddingBottom: scrollBottomPadding, flexGrow: 1 },
    saveButton: { marginTop: 20 },
    linkRow: { marginTop: 8, alignSelf: 'flex-start' },
    linkText: { fontSize: 14, fontWeight: '600', color: colors.primary },
    sectionDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginTop: 30,
      marginBottom: 20,
    },
    sectionHint: { color: colors.textSecondary, fontSize: 13, marginBottom: 16, lineHeight: 18 },
    recoveryCodesBox: {
      borderWidth: 1,
      borderRadius: 8,
      padding: 16,
      marginBottom: 20,
      borderColor: colors.border,
    },
    recoveryCode: {
      fontSize: 16,
      fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
      marginBottom: 8,
      color: colors.text,
    },
  });

  if (loading) {
    return <ScreenLoading message={t('loading')} />;
  }

  if (error || !server) {
    return (
      <ScreenError message={error || t('server_not_found')} onGoBack={() => navigation.goBack()} />
    );
  }

  if (recoveryCodesToShow) {
    return (
      <KeyboardAwareScreen
        style={commonContainerStyles.container}
        contentContainerStyle={styles.scrollViewContent}
      >
        <ScreenSection title={t('recovery_codes_title')} />
        <Text style={styles.sectionHint}>{t('recovery_codes_warning')}</Text>
        <View style={styles.recoveryCodesBox}>
          {recoveryCodesToShow.map((code) => (
            <Text key={code} selectable style={styles.recoveryCode}>
              {code}
            </Text>
          ))}
        </View>
        <Button
          onPress={() => {
            setRecoveryCodesToShow(null);
            navigation.goBack();
          }}
        >
          {t('recovery_codes_continue_button')}
        </Button>
      </KeyboardAwareScreen>
    );
  }

  return (
    <KeyboardAwareScreen
      style={commonContainerStyles.container}
      contentContainerStyle={styles.scrollViewContent}
    >
      {mode === 'change' && (
        <>
          <FormField label={t('current_password')}>
            {(fieldAccessibility) => (
              <TextInput
                {...fieldAccessibility}
                placeholder={t('current_password_placeholder')}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                style={commonInputStyles.input}
                secureTextEntry
              />
            )}
          </FormField>
          <TouchableOpacity onPress={() => setMode('recover')} style={styles.linkRow}>
            <Text style={styles.linkText}>{t('forgot_current_password_link')}</Text>
          </TouchableOpacity>
        </>
      )}

      {mode === 'recover' && (
        <>
          <FormField label={t('recovery_code_label')}>
            {(fieldAccessibility) => (
              <TextInput
                {...fieldAccessibility}
                placeholder={t('recovery_code_placeholder')}
                value={recoveryCode}
                onChangeText={setRecoveryCode}
                style={commonInputStyles.input}
                autoCapitalize="characters"
              />
            )}
          </FormField>
        </>
      )}

      <FormField label={t('new_password')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('new_password_placeholder')}
            value={newPassword}
            onChangeText={setNewPassword}
            style={commonInputStyles.input}
            secureTextEntry
          />
        )}
      </FormField>

      <FormField label={t('confirm_new_password')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('confirm_new_password_placeholder')}
            value={confirmNewPassword}
            onChangeText={setConfirmNewPassword}
            style={commonInputStyles.input}
            secureTextEntry
          />
        )}
      </FormField>

      {mode === 'change' ? (
        <Button
          onPress={handleSave}
          style={styles.saveButton}
          disabled={saving || !currentPassword || !newPassword || !confirmNewPassword}
        >
          {saving ? t('saving') : t('save')}
        </Button>
      ) : (
        <>
          <Button
            onPress={handleRecoverWithCode}
            style={styles.saveButton}
            disabled={recovering || !recoveryCode || !newPassword || !confirmNewPassword}
          >
            {recovering ? t('resetting_password') : t('reset_password_button')}
          </Button>
          <TouchableOpacity onPress={() => setMode('change')} style={styles.linkRow}>
            <Text style={styles.linkText}>{t('back_to_change_password')}</Text>
          </TouchableOpacity>
        </>
      )}

      {mode === 'change' && (
        <>
          <View style={styles.sectionDivider} />

          <ScreenSection title={t('regenerate_recovery_codes_title')} />
          <Text style={styles.sectionHint}>{t('regenerate_recovery_codes_hint')}</Text>
          <Button
            onPress={handleRegenerateRecoveryCodes}
            disabled={regenerating || !currentPassword}
          >
            {regenerating ? t('regenerating') : t('regenerate_recovery_codes_button')}
          </Button>
        </>
      )}
    </KeyboardAwareScreen>
  );
};

export default ChangePasswordScreen;
