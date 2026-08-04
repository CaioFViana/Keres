import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableWithoutFeedback } from 'react-native';
import Button from '../../components/common/Button/Button';
import { ScreenError, ScreenLoading } from '../../components/common/ScreenState/ScreenState';
import TextInput from '../../components/common/TextInput/TextInput';
import { useDrizzle } from '../../db';
import { ServerSelect } from '../../db/schema';
import { useFormScrollBottomPadding } from '../../hooks/useFormScrollBottomPadding';
import { ServerManagementStackParamList } from '../../navigation/StorySelectionStack';
import { isOfflineError } from '../../services/apiClient';
import { createServerService } from '../../services/ServerService';
import { userApiService } from '../../services/UserApiService';
import { useTheme } from '../../theme';
import { getCommonContainerStyles } from '../../theme/commonStyles';

const MIN_NEW_PASSWORD_LENGTH = 8;

type ChangePasswordScreenRouteProp = RouteProp<ServerManagementStackParamList, 'ChangePassword'>;
type ChangePasswordScreenNavigationProp = NativeStackNavigationProp<ServerManagementStackParamList, 'ChangePassword'>;

const ChangePasswordScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<ChangePasswordScreenNavigationProp>();
  const route = useRoute<ChangePasswordScreenRouteProp>();
  const { serverId } = route.params;
  const drizzleDb = useDrizzle();
  const scrollBottomPadding = useFormScrollBottomPadding();
  const commonContainerStyles = getCommonContainerStyles(colors);

  const [server, setServer] = useState<ServerSelect | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    return () => { cancelled = true; };
  }, [drizzleDb, serverId, t]);

  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({ title: t('change_password_title') });
    }, [navigation, t])
  );

  const handleSave = async () => {
    if (!server) return;

    if (newPassword.length < MIN_NEW_PASSWORD_LENGTH) {
      Alert.alert(t('error'), t('new_password_too_short'));
      return;
    }
    if (newPassword !== confirmNewPassword) {
      Alert.alert(t('error'), t('passwords_do_not_match'));
      return;
    }

    setSaving(true);
    try {
      await userApiService.changeOwnPassword(server, currentPassword, newPassword);
      Alert.alert(t('success'), t('password_changed_successfully'));
      navigation.goBack();
    } catch (err: any) {
      console.error('Failed to change password:', err);
      if (isOfflineError(err)) {
        Alert.alert(t('error'), t('server_unreachable'));
      } else if (err?.response?.status === 401) {
        Alert.alert(t('error'), t('incorrect_current_password'));
      } else {
        Alert.alert(t('error'), t('failed_to_change_password'));
      }
    } finally {
      setSaving(false);
    }
  };

  const styles = StyleSheet.create({
    scrollViewContent: { padding: 20, paddingBottom: scrollBottomPadding, flexGrow: 1 },
    label: { fontSize: 16, fontWeight: 'bold', marginTop: 15, marginBottom: 5, color: colors.text },
    saveButton: { marginTop: 20 },
  });

  if (loading) {
    return <ScreenLoading message={t('loading')} />;
  }

  if (error || !server) {
    return <ScreenError message={error || t('server_not_found')} onGoBack={() => navigation.goBack()} />;
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView style={commonContainerStyles.container} contentContainerStyle={styles.scrollViewContent}>
          <Text style={styles.label}>{t('current_password')}</Text>
          <TextInput
            placeholder={t('current_password_placeholder')}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
          />

          <Text style={styles.label}>{t('new_password')}</Text>
          <TextInput
            placeholder={t('new_password_placeholder')}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
          />

          <Text style={styles.label}>{t('confirm_new_password')}</Text>
          <TextInput
            placeholder={t('confirm_new_password_placeholder')}
            value={confirmNewPassword}
            onChangeText={setConfirmNewPassword}
            secureTextEntry
          />

          <Button onPress={handleSave} style={styles.saveButton} disabled={saving || !currentPassword || !newPassword || !confirmNewPassword}>
            {saving ? t('saving') : t('save')}
          </Button>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

export default ChangePasswordScreen;
