import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import ShowcaseGuestBanner from '@/src/components/features/showcase/ShowcaseGuestBanner';
import { useDrizzle } from '@/src/db';
import { useBackButtonHandler } from '@/src/hooks/nav/useBackButtonHandler';
import { useScreenHeader } from '@/src/hooks/nav/useScreenHeader';
import type { ShowcaseStackParamList } from '@/src/navigation/stacks/StorySelectionStack';
import { showcaseSourceUrl } from '@/src/services/api/ShowcaseApiService';
import { createPackService } from '@/src/services/storymanagement/packs/PackService';
import { useNotificationStore } from '@/src/state/ui/notificationStore';
import { type ThemeColors } from '@/src/theme';
import { commonScreenStyleDefs } from '@/src/theme/commonStyles';
import { useThemedStyles } from '@/src/theme/useThemedStyles';
import { packSummaryChips } from '@/src/utils/format/showcasePacks';
import { buildPackPublicUrl } from '@/src/utils/format/showcaseUrls';
import { logger } from '@/src/utils/logging/logger';
import { useShowcasePack } from './useShowcasePacks';
import { useShowcaseSource } from './useShowcaseSource';

type Route = RouteProp<ShowcaseStackParamList, 'ShowcasePack'>;
type Navigation = NativeStackNavigationProp<ShowcaseStackParamList, 'ShowcasePack'>;

/**
 * A pack of a server's public site, inside the app: what it brings, and the way to keep a copy on this device,
 * which any new story can then start from. Like a downloaded pack anywhere, it is kept under the id it had, so
 * installing it again updates the copy instead of piling up another.
 */
const ShowcasePackScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const db = useDrizzle();
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { serverId, guestOrigin, packId } = route.params;
  const { source, loading, missing } = useShowcaseSource({ serverId, guestOrigin });
  const state = useShowcasePack(source, packId);
  const showNotification = useNotificationStore((store) => store.showNotification);
  const styles = useThemedStyles(createStyles);
  const [installed, setInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    createPackService(db)
      .listPacks()
      .then((local) => !cancelled && setInstalled(local.some((pack) => pack.id === packId)))
      .catch((error) => logger.debug('ShowcasePackScreen: could not list the local packs.', error));
    return () => {
      cancelled = true;
    };
  }, [db, packId]);

  const openInBrowser = source
    ? () => void Linking.openURL(buildPackPublicUrl(showcaseSourceUrl(source), packId))
    : undefined;
  useScreenHeader({
    target: 'parent',
    title: t('showcase_pack_title'),
    actions: [
      {
        id: 'open-in-browser',
        icon: 'open-outline',
        label: t('showcase_open_in_browser'),
        onPress: () => openInBrowser?.(),
        visible: !!openInBrowser,
      },
    ],
  });

  const install = useCallback(async () => {
    if (state.status !== 'ready') return;
    const { pack } = state;
    setInstalling(true);
    try {
      await createPackService(db).importRemotePack({
        id: pack.id,
        name: pack.name,
        description: pack.description,
        language: pack.language,
        authorName: pack.authorName,
        version: pack.version,
        // A copy kept here is the person's own: whether it is ever shared again is their choice to make.
        visibility: 'private',
        content: pack.content,
      });
      setInstalled(true);
      showNotification(t('packs_download_done', { name: pack.name }), 'success');
    } catch (error) {
      logger.error('ShowcasePackScreen: failed to install the pack.', error);
      showNotification(t('packs_download_failed'), 'error');
    } finally {
      setInstalling(false);
    }
  }, [state, db, showNotification, t]);

  if (missing) {
    return <ScreenError message={t('server_not_found')} onGoBack={() => navigation.goBack()} />;
  }
  if (loading || state.status === 'loading') {
    return <ScreenLoading message={t('loading')} />;
  }
  if (state.status !== 'ready') {
    return (
      <ScreenError
        message={t(`showcase_pack_${state.status}`)}
        onGoBack={() => navigation.goBack()}
      />
    );
  }

  const { pack } = state;
  const chips = packSummaryChips(pack.summary, t);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {source?.kind === 'guest' ? (
        <ShowcaseGuestBanner
          origin={source.origin}
          onRegister={() =>
            navigation.getParent()?.navigate('ServerManagementDrawer', {
              screen: 'ServerRegistration',
              params: { address: source.origin },
            })
          }
        />
      ) : null}

      <Text style={styles.title} accessibilityRole="header">
        {pack.name}
      </Text>
      <Text style={styles.meta}>
        {[
          pack.language,
          pack.authorName ?? pack.owner.username,
          t('packs_version', { version: pack.version }),
        ]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      {pack.description ? <Text style={styles.description}>{pack.description}</Text> : null}

      <Text style={styles.sectionTitle} accessibilityRole="header">
        {t('showcase_pack_brings')}
      </Text>
      <View style={styles.chips} testID="showcase-pack-chips">
        {(chips.length > 0 ? chips : [t('packs_chip_empty')]).map((chip) => (
          <Text key={chip} style={styles.chip}>
            {chip}
          </Text>
        ))}
      </View>

      <View style={styles.actions}>
        <Button
          icon="download-outline"
          onPress={() => void install()}
          disabled={installing}
          testID="showcase-pack-install"
        >
          {installed ? t('packs_download_again') : t('packs_download')}
        </Button>
        {installing ? <ActivityIndicator /> : null}
      </View>
      <Text style={styles.note}>{t('showcase_pack_howto')}</Text>
    </ScrollView>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    ...commonScreenStyleDefs(colors),
    content: { padding: 20, paddingBottom: 60 },
    title: { fontSize: 26, fontWeight: 'bold', color: colors.text },
    meta: { fontSize: 14, color: colors.textSecondary, fontStyle: 'italic', marginTop: 4 },
    description: { fontSize: 15, lineHeight: 22, color: colors.text, marginTop: 14 },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      marginTop: 24,
      marginBottom: 10,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      fontSize: 13,
      color: colors.text,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 4,
      overflow: 'hidden',
    },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24 },
    note: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginTop: 14 },
  });

export default ShowcasePackScreen;
