import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Avatar from '../../components/common/Avatar/Avatar';
import Button from '../../components/common/Button/Button';
import ColorPickerInput from '../../components/common/ColorPickerInput/ColorPickerInput';
import IconPickerInput from '../../components/common/IconPickerInput/IconPickerInput';
import KeyboardAwareScreen from '../../components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import { ScreenError, ScreenLoading } from '../../components/common/ScreenState/ScreenState';
import TextInput from '../../components/common/TextInput/TextInput';
import { useDrizzle } from '../../db';
import { ServerSelect } from '../../db/schema';
import { useFormScrollBottomPadding } from '../../hooks/useFormScrollBottomPadding';
import { ServerManagementStackParamList } from '../../navigation/StorySelectionStack';
import { createServerService } from '../../services/ServerService';
import { isOfflineError } from '../../services/apiClient';
import { userApiService } from '../../services/UserApiService';
import { useTheme } from '../../theme';
import { getCommonContainerStyles, getCommonInputStyles } from '../../theme/commonStyles';
import { AppAlert } from '../../utils/AppAlert';

const BIO_MAX_LENGTH = 200;

type MyProfileScreenRouteProp = RouteProp<ServerManagementStackParamList, 'MyProfile'>;
type MyProfileScreenNavigationProp = NativeStackNavigationProp<ServerManagementStackParamList, 'MyProfile'>;

const MyProfileScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<MyProfileScreenNavigationProp>();
  const route = useRoute<MyProfileScreenRouteProp>();
  const { serverId } = route.params;
  const drizzleDb = useDrizzle();
  const scrollBottomPadding = useFormScrollBottomPadding();
  const commonContainerStyles = getCommonContainerStyles(colors);
  const commonInputStyles = getCommonInputStyles(colors);

  const [server, setServer] = useState<ServerSelect | null>(null);
  const [avatarColor, setAvatarColor] = useState<string | null>(null);
  const [avatarIcon, setAvatarIcon] = useState<string | null>(null);
  const [bio, setBio] = useState('');
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
        if (!fetchedServer) {
          if (!cancelled) setError(t('server_not_found'));
          return;
        }
        if (cancelled) return;
        setServer(fetchedServer);

        const profile = await userApiService.getOwnProfile(fetchedServer);
        if (cancelled) return;
        if (profile) {
          setAvatarColor(profile.avatarColor);
          setAvatarIcon(profile.avatarIcon);
          setBio(profile.bio || '');
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load profile:', err);
          setError(isOfflineError(err) ? t('server_unreachable') : t('failed_to_load_profile'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [drizzleDb, serverId, t]);

  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({ title: t('my_profile_title') });
    }, [navigation, t])
  );

  const handleSave = async () => {
    if (!server) return;
    setSaving(true);
    try {
      await userApiService.updateProfile(server, {
        avatarColor,
        avatarIcon,
        bio: bio.trim() || null,
      });
      AppAlert.alert(t('success'), t('profile_updated_successfully'));
      navigation.goBack();
    } catch (err) {
      console.error('Failed to update profile:', err);
      AppAlert.alert(t('error'), isOfflineError(err) ? t('server_unreachable') : t('failed_to_update_profile'));
    } finally {
      setSaving(false);
    }
  };

  const styles = StyleSheet.create({
    scrollViewContent: { padding: 20, paddingBottom: scrollBottomPadding, flexGrow: 1 },
    previewContainer: { alignItems: 'center', marginBottom: 20 },
    label: { fontSize: 16, fontWeight: 'bold', marginTop: 15, marginBottom: 5, color: colors.text },
    charCount: { fontSize: 12, color: colors.textSecondary, textAlign: 'right', marginTop: -2, marginBottom: 10 },
    saveButton: { marginTop: 20 },
  });

  if (loading) {
    return <ScreenLoading message={t('loading')} />;
  }

  if (error || !server) {
    return <ScreenError message={error || t('server_not_found')} onGoBack={() => navigation.goBack()} />;
  }

  return (
    <KeyboardAwareScreen style={commonContainerStyles.container} contentContainerStyle={styles.scrollViewContent}>
          <View style={styles.previewContainer}>
            <Avatar color={avatarColor} icon={avatarIcon} seed={server.idUser} size={96} />
          </View>

          <Text style={styles.label}>{t('avatar_color')}</Text>
          <ColorPickerInput
            currentColor={avatarColor || ''}
            onSelectColor={setAvatarColor}
            placeholder={t('select_avatar_color')}
            style={commonInputStyles.input}
          />

          <Text style={styles.label}>{t('avatar_icon')}</Text>
          <IconPickerInput
            currentIcon={avatarIcon}
            onSelectIcon={setAvatarIcon}
            placeholder={t('select_avatar_icon')}
            style={commonInputStyles.input}
          />

          <Text style={styles.label}>{t('bio')}</Text>
          <TextInput
            placeholder={t('bio_placeholder')}
            value={bio}
            onChangeText={(text) => setBio(text.slice(0, BIO_MAX_LENGTH))}
            style={[commonInputStyles.input, { minHeight: 4 * 20, textAlignVertical: 'top' }]}
            multiline
            maxLength={BIO_MAX_LENGTH}
          />
          <Text style={styles.charCount}>{bio.length}/{BIO_MAX_LENGTH}</Text>

          <Button onPress={handleSave} style={styles.saveButton} disabled={saving}>
            {saving ? t('saving') : t('save')}
          </Button>
    </KeyboardAwareScreen>
  );
};

export default MyProfileScreen;
