import Button from '@/src/components/common/controls/Button/Button';
import Avatar from '@/src/components/common/display/Avatar/Avatar';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import ColorPickerInput from '@/src/components/common/inputs/ColorPickerInput/ColorPickerInput';
import IconPickerInput from '@/src/components/common/inputs/IconPickerInput/IconPickerInput';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import KeyboardAwareScreen from '@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import type { RouteProp } from '@react-navigation/native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useDrizzle } from '../../db';
import type { ServerSelect } from '../../db/schema';
import { useFormScrollBottomPadding } from '../../hooks/useFormScrollBottomPadding';
import type { ServerManagementStackParamList } from '../../navigation/StorySelectionStack';
import { isOfflineError } from '../../services/apiClient';
import { createServerService } from '../../services/ServerService';
import { userApiService } from '../../services/UserApiService';
import { useTheme } from '../../theme';
import { getCommonContainerStyles, getCommonInputStyles } from '../../theme/commonStyles';
import { AppAlert } from '../../utils/AppAlert';
import { useDocumentTitle } from '../../utils/documentTitle';

const BIO_MAX_LENGTH = 200;

type MyProfileScreenRouteProp = RouteProp<ServerManagementStackParamList, 'MyProfile'>;
type MyProfileScreenNavigationProp = NativeStackNavigationProp<
  ServerManagementStackParamList,
  'MyProfile'
>;

const MyProfileScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  useDocumentTitle(t('my_profile_title'));
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
    return () => {
      cancelled = true;
    };
  }, [drizzleDb, serverId, t]);

  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({ title: t('my_profile_title') });
    }, [navigation, t]),
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
      AppAlert.alert(
        t('error'),
        isOfflineError(err) ? t('server_unreachable') : t('failed_to_update_profile'),
      );
    } finally {
      setSaving(false);
    }
  };

  const styles = StyleSheet.create({
    scrollViewContent: { padding: 20, paddingBottom: scrollBottomPadding, flexGrow: 1 },
    previewContainer: { alignItems: 'center', marginBottom: 20 },
    label: { fontSize: 16, fontWeight: 'bold', marginTop: 15, marginBottom: 5, color: colors.text },
    charCount: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'right',
      marginTop: -2,
      marginBottom: 10,
    },
    saveButton: { marginTop: 20 },
  });

  if (loading) {
    return <ScreenLoading message={t('loading')} />;
  }

  if (error || !server) {
    return (
      <ScreenError message={error || t('server_not_found')} onGoBack={() => navigation.goBack()} />
    );
  }

  return (
    <KeyboardAwareScreen
      style={commonContainerStyles.container}
      contentContainerStyle={styles.scrollViewContent}
    >
      <View style={styles.previewContainer}>
        <Avatar color={avatarColor} icon={avatarIcon} seed={server.idUser} size={96} />
      </View>

      <Text style={styles.label}>{t('avatar_color')}</Text>
      <ColorPickerInput
        currentColor={avatarColor || ''}
        onSelectColor={setAvatarColor}
        placeholder={t('select_avatar_color')}
      />

      <Text style={styles.label}>{t('avatar_icon')}</Text>
      <IconPickerInput
        currentIcon={avatarIcon}
        onSelectIcon={setAvatarIcon}
        placeholder={t('select_avatar_icon')}
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
      <Text style={styles.charCount}>
        {bio.length}/{BIO_MAX_LENGTH}
      </Text>

      <Button onPress={handleSave} style={styles.saveButton} disabled={saving}>
        {saving ? t('saving') : t('save')}
      </Button>
    </KeyboardAwareScreen>
  );
};

export default MyProfileScreen;
