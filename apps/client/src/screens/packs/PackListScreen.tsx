import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import SharePackModal from '../../components/features/packs/SharePackModal/SharePackModal';
import { useDrizzle } from '../../db';
import type { PackVisibility } from '@keres/shared';
import type { ServerSelect } from '../../db/schema';
import { packApiService } from '../../services/PackApiService';
import { createServerService } from '../../services/ServerService';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { createPackService, type PackSummary } from '../../services/storymanagement/PackService';
import { useNotificationStore } from '../../state/notificationStore';
import { useTheme } from '../../theme';
import { commonDetailStyleDefs, commonScreenStyleDefs } from '../../theme/commonStyles';
import { AppAlert } from '../../utils/AppAlert';

/**
 * The packs on this device: reusable slices of a story's structure, applied when a story is created.
 *
 * There is no pack editor, and that is the point of the feature: a pack is authored by making a
 * story and extracting from it, so everything it contains already has screens of its own. Editing a
 * pack is therefore re-extraction - which is only possible while its source story still exists here.
 * A pack is a snapshot, so it outlives that story; it simply becomes read-only when the story is
 * gone, and can still be deleted.
 *
 * The language is a plain label rather than a selector, unlike the example stories: it is the raw
 * string copied from the source story, the author's own word, and it is never translated.
 */
const PackListScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<{ navigate: (screen: string, params?: unknown) => void }>();
  const drizzleDb = useDrizzle();
  const showNotification = useNotificationStore((state) => state.showNotification);
  useScreenHeader({ target: 'parent', title: t('packs_title') });

  const [packs, setPacks] = useState<PackSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyPackId, setBusyPackId] = useState<string | null>(null);
  const [servers, setServers] = useState<ServerSelect[]>([]);
  /** The pack whose share modal is open, or `null`. */
  const [sharingPack, setSharingPack] = useState<PackSummary | null>(null);

  const load = useCallback(async () => {
    try {
      setPacks(await createPackService(drizzleDb).listPacks());
    } catch (error) {
      console.error('PackListScreen: failed to list packs.', error);
      showNotification(t('packs_load_failed'), 'error');
    } finally {
      setLoading(false);
    }
  }, [drizzleDb, showNotification, t]);

  useFocusEffect(
    useCallback(() => {
      load();
      createServerService(drizzleDb)
        .getAllServers()
        .then(setServers)
        .catch((error) => console.error('PackListScreen: failed to list servers.', error));
    }, [load, drizzleDb]),
  );

  /**
   * Sharing is an upload, not a publication: no synchronization state is consulted, and re-sharing
   * the same pack replaces the copy on the server - which is how its author releases a new version.
   *
   * The two questions it asks (which server, and whether it goes on that server's public showcase)
   * live in `SharePackModal`, because an alert cannot ask two.
   */
  const handleShare = useCallback(
    (pack: PackSummary) => {
      if (servers.length === 0) {
        showNotification(t('packs_share_no_server'), 'error');
        return;
      }
      setSharingPack(pack);
    },
    [servers, showNotification, t],
  );

  const confirmShare = useCallback(
    async (serverId: string, visibility: PackVisibility) => {
      const pack = sharingPack;
      const server = servers.find((candidate) => candidate.id === serverId);
      setSharingPack(null);
      if (!pack || !server) return;

      setBusyPackId(pack.id);
      try {
        const uploadable = await createPackService(drizzleDb).getPackForUpload(pack.id);
        if (!uploadable) throw new Error('Pack could not be read.');
        await packApiService.upload(server, { ...uploadable, visibility });
        showNotification(t('packs_share_done', { name: pack.name }), 'success');
      } catch (error) {
        console.error('PackListScreen: failed to share pack.', error);
        showNotification(t('packs_share_failed'), 'error');
      } finally {
        setBusyPackId(null);
      }
    },
    [sharingPack, servers, drizzleDb, showNotification, t],
  );

  const handleDelete = useCallback(
    (pack: PackSummary) => {
      AppAlert.alert(t('packs_delete_title'), t('packs_delete_message', { name: pack.name }), [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            setBusyPackId(pack.id);
            try {
              await createPackService(drizzleDb).deletePack(pack.id);
              await load();
            } catch (error) {
              console.error('PackListScreen: failed to delete pack.', error);
              showNotification(t('packs_delete_failed'), 'error');
            } finally {
              setBusyPackId(null);
            }
          },
        },
      ]);
    },
    [drizzleDb, load, showNotification, t],
  );

  const styles = StyleSheet.create({
    ...commonScreenStyleDefs(colors),
    ...commonDetailStyleDefs(colors),
    content: { padding: 20, paddingBottom: 60 },
    description: { fontSize: 14, color: colors.textSecondary, marginBottom: 18, lineHeight: 20 },
    card: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 8,
      paddingVertical: 14,
      paddingHorizontal: 16,
      marginBottom: 10,
      backgroundColor: colors.surface,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center' },
    cardTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
      marginLeft: 8,
      flexShrink: 1,
    },
    cardMeta: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic', marginTop: 2 },
    cardDescription: { fontSize: 13, color: colors.textSecondary, marginTop: 6 },
    contents: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 6 },
    chip: {
      borderRadius: 12,
      paddingVertical: 3,
      paddingHorizontal: 9,
      backgroundColor: colors.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    chipText: { fontSize: 12, color: colors.textSecondary },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, gap: 8 },
    actionButton: {
      width: 40,
      height: 40,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    createButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingVertical: 12,
      marginBottom: 18,
    },
    createButtonText: { color: colors.onPrimary, fontWeight: 'bold', marginLeft: 8 },
    browseButton: {
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
  });

  const contentChips = (pack: PackSummary) =>
    [
      pack.counts.customAttributes > 0 &&
        t('packs_chip_attributes', { count: pack.counts.customAttributes }),
      pack.counts.suggestions > 0 &&
        t('packs_chip_suggestions', { count: pack.counts.suggestions }),
      pack.counts.tags > 0 && t('packs_chip_tags', { count: pack.counts.tags }),
      pack.counts.stats > 0 && t('packs_chip_stats', { count: pack.counts.stats }),
      pack.counts.hasVocabulary && t('packs_chip_vocabulary'),
    ].filter((chip): chip is string => Boolean(chip));

  const renderPack = ({ item }: { item: PackSummary }) => {
    const chips = contentChips(item);
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="cube-outline" size={20} color={colors.primary} />
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.name}
          </Text>
        </View>
        <Text style={styles.cardMeta}>
          {[item.language, item.authorName, t('packs_version', { version: item.version })]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        {item.description ? <Text style={styles.cardDescription}>{item.description}</Text> : null}
        <View style={styles.contents}>
          {chips.length > 0 ? (
            chips.map((chip) => (
              <View key={chip} style={styles.chip}>
                <Text style={styles.chipText}>{chip}</Text>
              </View>
            ))
          ) : (
            <View style={styles.chip}>
              <Text style={styles.chipText}>{t('packs_chip_empty')}</Text>
            </View>
          )}
        </View>
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleShare(item)}
            accessibilityLabel={t('packs_share_title')}
            disabled={busyPackId === item.id}
          >
            <Ionicons name="cloud-upload-outline" size={20} color={colors.text} />
          </TouchableOpacity>
          {/* Re-extraction is the only way to edit a pack, and it needs the source story present. */}
          {item.sourceStoryId ? (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('PackForm', { packId: item.id })}
              accessibilityLabel={t('packs_reextract')}
              disabled={busyPackId === item.id}
            >
              <Ionicons name="refresh-outline" size={20} color={colors.text} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDelete(item)}
            accessibilityLabel={t('delete')}
            disabled={busyPackId === item.id}
          >
            <Ionicons name="trash-outline" size={20} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        contentContainerStyle={styles.content}
        data={packs}
        keyExtractor={(pack) => pack.id}
        renderItem={renderPack}
        ListHeaderComponent={
          <>
            <Text style={styles.description}>{t('packs_description')}</Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => navigation.navigate('PackForm', {})}
              testID="create-pack"
            >
              <Ionicons name="add" size={20} color={colors.onPrimary} />
              <Text style={styles.createButtonText}>{t('packs_create')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.createButton, styles.browseButton]}
              onPress={() => navigation.navigate('PackBrowse')}
              testID="browse-packs"
            >
              <Ionicons name="cloud-download-outline" size={20} color={colors.text} />
              <Text style={[styles.createButtonText, { color: colors.text }]}>
                {t('packs_browse_title')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.createButton, styles.browseButton]}
              onPress={() => navigation.navigate('ShippedPacks')}
              testID="shipped-packs"
            >
              <Ionicons name="gift-outline" size={20} color={colors.text} />
              <Text style={[styles.createButtonText, { color: colors.text }]}>
                {t('shipped_packs_title')}
              </Text>
            </TouchableOpacity>
          </>
        }
        ListEmptyComponent={<Text style={styles.emptyText}>{t('packs_empty')}</Text>}
      />
      <SharePackModal
        visible={sharingPack !== null}
        packName={sharingPack?.name ?? ''}
        servers={servers}
        onCancel={() => setSharingPack(null)}
        onConfirm={confirmShare}
      />
    </View>
  );
};

export default PackListScreen;
