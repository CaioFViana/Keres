import type { UserPreferencesType } from '@keres/shared';
import FormField from '@/src/components/common/forms/FormField/FormField';
import FormSwitchField from '@/src/components/common/forms/FormSwitchField/FormSwitchField';
import { useScreenHeader } from '@/src/hooks/nav/useScreenHeader';
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
import { useBackButtonHandler } from '@/src/hooks/nav/useBackButtonHandler';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useDrizzle } from '@/src/db';
import type { ServerSelect } from '@/src/db/schema';
import { useFormScrollBottomPadding } from '@/src/hooks/forms/useFormScrollBottomPadding';
import type { ServerManagementStackParamList } from '@/src/navigation/StorySelectionStack';
import { isOfflineError } from '@/src/services/api/apiClient';
import { createServerService } from '@/src/services/servers/ServerService';
import { userApiService } from '@/src/services/api/UserApiService';
import { type ThemeColors, useTheme } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/useThemedStyles';
import { typography } from '@/src/theme/tokens';
import { getCommonContainerStyles, getCommonInputStyles } from '@/src/theme/commonStyles';
import { AppAlert } from '@/src/state/ui/AppAlert';

const BIO_MAX_LENGTH = 200;

type MyProfileScreenRouteProp = RouteProp<ServerManagementStackParamList, 'MyProfile'>;
type MyProfileScreenNavigationProp = NativeStackNavigationProp<
  ServerManagementStackParamList,
  'MyProfile'
>;

const MyProfileScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
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
  // The owner's private adults-only choice. Loaded from the server, shown only when the account is verified there.
  const [preferences, setPreferences] = useState<UserPreferencesType | null>(null);
  const [showNsfw, setShowNsfw] = useState(false);
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

        const loaded = await userApiService.getPreferences(fetchedServer);
        if (cancelled) return;
        setPreferences(loaded);
        setShowNsfw(loaded?.showNsfw ?? false);
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

  useScreenHeader({
    target: 'parent',
    title: t('my_profile_title'),
  });

  const handleSave = async () => {
    if (!server) return;
    setSaving(true);
    try {
      // Refused before anything is saved: an unverified account cannot turn the adults-only choice on.
      if (preferences?.isAdultVerified && showNsfw !== preferences.showNsfw) {
        try {
          await userApiService.updatePreferences(server, { showNsfw });
        } catch (err) {
          if ((err as { response?: { status?: number } })?.response?.status === 403) {
            AppAlert.alert(t('error'), t('profile_show_nsfw_refused'));
            return;
          }
          throw err;
        }
      }
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

  const styles = useThemedStyles(createStyles, [scrollBottomPadding]);

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

      <FormField label={t('avatar_color')}>
        <ColorPickerInput
          currentColor={avatarColor || ''}
          onSelectColor={setAvatarColor}
          placeholder={t('select_avatar_color')}
        />
      </FormField>

      <FormField label={t('avatar_icon')}>
        <IconPickerInput
          currentIcon={avatarIcon}
          onSelectIcon={setAvatarIcon}
          placeholder={t('select_avatar_icon')}
        />
      </FormField>

      {preferences?.isAdultVerified ? (
        <>
          <FormSwitchField
            label={t('profile_show_nsfw')}
            value={showNsfw}
            onValueChange={setShowNsfw}
            testID="profile-show-nsfw-switch"
          />
          <Text style={styles.switchHint}>{t('profile_show_nsfw_hint')}</Text>
        </>
      ) : null}

      <FormField label={t('bio')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('bio_placeholder')}
            value={bio}
            onChangeText={(text) => setBio(text.slice(0, BIO_MAX_LENGTH))}
            style={[commonInputStyles.multiline, { minHeight: 4 * 20 }]}
            multiline
            maxLength={BIO_MAX_LENGTH}
          />
        )}
      </FormField>
      <Text style={styles.charCount}>
        {bio.length}/{BIO_MAX_LENGTH}
      </Text>

      <Button onPress={handleSave} style={styles.saveButton} disabled={saving}>
        {saving ? t('saving') : t('save')}
      </Button>
    </KeyboardAwareScreen>
  );
};

const createStyles = (colors: ThemeColors, [scrollBottomPadding]: [number]) =>
  StyleSheet.create({
    scrollViewContent: { padding: 20, paddingBottom: scrollBottomPadding, flexGrow: 1 },
    previewContainer: { alignItems: 'center', marginBottom: 20 },
    charCount: {
      ...typography.caption,
      color: colors.textSecondary,
      textAlign: 'right',
      marginTop: -2,
      marginBottom: 10,
    },
    switchHint: {
      ...typography.caption,
      color: colors.textSecondary,
      marginBottom: 10,
    },
    saveButton: { marginTop: 20 },
  });

export default MyProfileScreen;
