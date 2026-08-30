import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Select from '../../components/common/inputs/Select/Select';
import { useDrizzle } from '../../db';
import type { ServerSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { packApiService, type RemotePack } from '../../services/PackApiService';
import { createServerService } from '../../services/ServerService';
import { createPackService } from '../../services/storymanagement/PackService';
import { useNotificationStore } from '../../state/notificationStore';
import { useTheme } from '../../theme';
import { commonDetailStyleDefs, commonScreenStyleDefs } from '../../theme/commonStyles';
import { useDocumentTitle } from '../../utils/documentTitle';

/**
 * Packs shared on a server.
 *
 * Nothing here goes through the synchronization engine, and it does not need to: a pack is one row
 * fetched whole over ordinary REST. That is the difference from a story publication, which exists
 * only once the story it describes is fully synchronized.
 *
 * A downloaded pack becomes an ordinary local one, kept under the id it had on the server so that
 * downloading twice updates in place instead of piling up near-duplicates.
 */
const PackBrowseScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const drizzleDb = useDrizzle();
  const showNotification = useNotificationStore((state) => state.showNotification);
  useDocumentTitle(t('packs_browse_title'));

  const [servers, setServers] = useState<ServerSelect[]>([]);
  const [serverId, setServerId] = useState<string | null>(null);
  const [remotePacks, setRemotePacks] = useState<RemotePack[]>([]);
  const [localIds, setLocalIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [busyPackId, setBusyPackId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const list = await createServerService(drizzleDb).getAllServers();
      setServers(list);
      if (list.length === 1) setServerId(list[0]?.id ?? null);
      setLocalIds(new Set((await createPackService(drizzleDb).listPacks()).map((p) => p.id)));
    })().catch((error) => console.error('PackBrowseScreen: failed to load servers.', error));
  }, [drizzleDb]);

  const server = servers.find((entry) => entry.id === serverId) ?? null;

  const loadRemote = useCallback(async () => {
    if (!server) return;
    setLoading(true);
    try {
      setRemotePacks(await packApiService.list(server));
    } catch (error) {
      console.error('PackBrowseScreen: failed to list remote packs.', error);
      showNotification(t('packs_browse_failed'), 'error');
      setRemotePacks([]);
    } finally {
      setLoading(false);
    }
  }, [server, showNotification, t]);

  useEffect(() => {
    loadRemote();
  }, [loadRemote]);

  const download = useCallback(
    async (pack: RemotePack) => {
      if (!server) return;
      setBusyPackId(pack.id);
      try {
        const full = await packApiService.download(server, pack.id);
        await createPackService(drizzleDb).importRemotePack({
          id: full.id,
          name: full.name,
          description: full.description,
          language: full.language,
          authorName: full.authorName,
          version: full.version,
          visibility: full.visibility,
          content: full.content,
        });
        setLocalIds((current) => new Set(current).add(full.id));
        showNotification(t('packs_download_done', { name: pack.name }), 'success');
      } catch (error) {
        // A payload this client cannot read fails here, on purpose: the alternative is a broken
        // story at creation time, far from the download that caused it.
        console.error('PackBrowseScreen: failed to download pack.', error);
        showNotification(t('packs_download_failed'), 'error');
      } finally {
        setBusyPackId(null);
      }
    },
    [server, drizzleDb, showNotification, t],
  );

  const styles = StyleSheet.create({
    ...commonScreenStyleDefs(colors),
    ...commonDetailStyleDefs(colors),
    content: { padding: 20, paddingBottom: 60 },
    description: { fontSize: 14, color: colors.textSecondary, marginBottom: 14, lineHeight: 20 },
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
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: colors.text, marginLeft: 8, flex: 1 },
    cardMeta: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic', marginTop: 2 },
    cardDescription: { fontSize: 13, color: colors.textSecondary, marginTop: 6 },
    downloadRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
    downloadButton: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 14,
      backgroundColor: colors.primary,
    },
    downloadText: { color: colors.onPrimary, fontWeight: 'bold', marginLeft: 6 },
    held: { color: colors.textSecondary, fontSize: 13, alignSelf: 'center' },
  });

  const renderPack = ({ item }: { item: RemotePack }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons name="cloud-download-outline" size={20} color={colors.primary} />
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
      <View style={styles.downloadRow}>
        {busyPackId === item.id ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <TouchableOpacity
            style={styles.downloadButton}
            onPress={() => download(item)}
            testID={`download-${item.id}`}
          >
            <Ionicons name="download-outline" size={18} color={colors.onPrimary} />
            <Text style={styles.downloadText}>
              {localIds.has(item.id) ? t('packs_download_again') : t('packs_download')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        contentContainerStyle={styles.content}
        data={remotePacks}
        keyExtractor={(pack) => pack.id}
        renderItem={renderPack}
        ListHeaderComponent={
          <>
            <Text style={styles.description}>{t('packs_browse_description')}</Text>
            <Select
              value={serverId}
              onValueChange={setServerId}
              options={servers.map((entry) => ({
                label: entry.name ?? entry.url,
                value: entry.id,
              }))}
              placeholder={t('packs_browse_choose_server')}
            />
            {loading ? <ActivityIndicator color={colors.primary} /> : null}
          </>
        }
        ListEmptyComponent={
          loading ? null : (
            <Text style={styles.emptyText}>
              {server ? t('packs_browse_empty') : t('packs_browse_choose_server')}
            </Text>
          )
        }
      />
    </View>
  );
};

export default PackBrowseScreen;
