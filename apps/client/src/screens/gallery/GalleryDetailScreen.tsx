import { Ionicons } from '@expo/vector-icons';
import { MediaType } from '@keres/shared';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Button from '../../components/common/Button/Button';
import MultiSelectPill from '../../components/common/MultiSelectPill/MultiSelectPill';
import { ScreenError, ScreenLoading } from '../../components/common/ScreenState/ScreenState';
import TextInput from '../../components/common/TextInput/TextInput';
import { useDrizzle } from '../../db';
import { GallerySelect } from '../../db/schemas/galleries';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { decodeOwnerValue, encodeOwnerValue, useGalleryOwnerOptions } from '../../hooks/useGalleryOwnerOptions';
import { GalleryStackParamList } from '../../navigation/MainSystemStack';
import { mediaFileService } from '../../services/MediaFileService';
import { createGalleryRelationService, GalleryOwnerRef } from '../../services/storymanagement/GalleryRelationService';
import { createGalleryService } from '../../services/storymanagement/GalleryService';
import { useNotificationStore } from '../../state/notificationStore';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';

type GalleryDetailRouteProp = RouteProp<GalleryStackParamList, 'GalleryDetail'>;
type GalleryDetailNavigationProp = NativeStackNavigationProp<GalleryStackParamList, 'GalleryDetail'>;

const MEDIA_TYPE_ICONS: Record<MediaType, keyof typeof Ionicons.glyphMap> = {
  image: 'image-outline',
  video: 'videocam-outline',
  audio: 'musical-notes-outline',
};

function formatSize(bytes: number): string {
  if (bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const GalleryDetailScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<GalleryDetailNavigationProp>();
  const route = useRoute<GalleryDetailRouteProp>();
  const { galleryId } = route.params;

  const db = useDrizzle();
  const { selectedStory } = useStoryStore();
  const { userId } = useUserSettingsStore();
  const { showNotification } = useNotificationStore();
  const storyId = selectedStory?.id;

  const galleryService = useMemo(() => createGalleryService(db), [db]);
  const relationService = useMemo(() => createGalleryRelationService(db), [db]);
  const { options: ownerOptions } = useGalleryOwnerOptions(storyId);

  const [media, setMedia] = useState<GallerySelect | null>(null);
  const [title, setTitle] = useState('');
  const [extraNotes, setExtraNotes] = useState('');
  const [selectedOwners, setSelectedOwners] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!storyId) {
      setError(t('no_story_selected'));
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const found = await galleryService.getById(galleryId);
      if (!found) {
        setError(t('media_not_found'));
        setLoading(false);
        return;
      }

      const links = await relationService.getOwnersForGallery(storyId, galleryId);

      setMedia(found);
      setTitle(found.title || '');
      setExtraNotes(found.extraNotes || '');
      setSelectedOwners(links.map((link) => encodeOwnerValue(link.ownerType as GalleryOwnerRef['ownerType'], link.ownerId)));
      setError(null);
    } catch (loadError) {
      console.error('Failed to load media:', loadError);
      setError(t('media_load_failed'));
    } finally {
      setLoading(false);
    }
  }, [storyId, galleryId, galleryService, relationService, t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = useCallback(async () => {
    if (!media || !storyId || !userId) {
      return;
    }

    setSaving(true);
    try {
      await galleryService.updateGallery(userId, media.id, {
        title: title.trim() || null,
        extraNotes: extraNotes.trim() || null,
      });

      const owners = selectedOwners
        .map(decodeOwnerValue)
        .filter((owner): owner is GalleryOwnerRef => owner !== null);

      await relationService.setOwnersForGallery(userId, storyId, media.id, owners);

      showNotification(t('media_updated_successfully'), 'success');
      navigation.goBack();
    } catch (saveError) {
      console.error('Failed to save media:', saveError);
      showNotification(t('media_save_failed'), 'error');
    } finally {
      setSaving(false);
    }
  }, [media, storyId, userId, galleryService, relationService, title, extraNotes, selectedOwners, showNotification, t, navigation]);

  const handleToggleFavorite = useCallback(async () => {
    if (!media || !userId) {
      return;
    }
    try {
      await galleryService.updateGalleryFavoriteStatus(userId, media.id, !media.isFavorite);
      setMedia({ ...media, isFavorite: !media.isFavorite });
    } catch (favoriteError) {
      console.error('Failed to toggle media favorite:', favoriteError);
      showNotification(t('media_save_failed'), 'error');
    }
  }, [media, userId, galleryService, showNotification, t]);

  const handleDelete = useCallback(() => {
    if (!media || !userId) {
      return;
    }

    Alert.alert(
      t('delete_media_title'),
      t('delete_media_message'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await galleryService.deleteGallery(userId, media.id);
              // O arquivo local só é removido depois que o registro foi marcado como
              // excluído: se a ordem fosse a inversa, uma falha na exclusão deixaria uma
              // mídia ativa apontando para um arquivo que não existe mais.
              mediaFileService.deleteLocal(media.localPath);
              showNotification(t('media_deleted_successfully'), 'success');
              navigation.goBack();
            } catch (deleteError) {
              console.error('Failed to delete media:', deleteError);
              showNotification(t('media_delete_failed'), 'error');
            }
          },
        },
      ]
    );
  }, [media, userId, galleryService, showNotification, t, navigation]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: 20,
    },
    preview: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      marginBottom: 15,
    },
    image: {
      width: '100%',
      height: '100%',
    },
    placeholderText: {
      color: colors.textSecondary,
      marginTop: 10,
      fontSize: 14,
      textAlign: 'center',
      paddingHorizontal: 20,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 15,
    },
    fileName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      flex: 1,
      marginRight: 10,
    },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 4,
    },
    metaLabel: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    metaValue: {
      fontSize: 13,
      color: colors.text,
      flexShrink: 1,
      textAlign: 'right',
      marginLeft: 10,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginTop: 20,
      marginBottom: 8,
    },
    input: {
      width: '100%',
      marginBottom: 10,
    },
    notesInput: {
      height: 100,
      textAlignVertical: 'top',
      paddingTop: 10,
    },
    actions: {
      marginTop: 25,
      gap: 10,
    },
    deleteButton: {
      backgroundColor: colors.error,
    },
  });

  if (loading) {
    return <ScreenLoading message={t('loading')} padded />;
  }

  if (error || !media) {
    return <ScreenError message={error || t('media_not_found')} onGoBack={() => navigation.goBack()} padded />;
  }

  const mediaType = media.mediaType as MediaType;
  const hasLocalImage = mediaType === 'image' && !!media.localPath;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.preview}>
        {hasLocalImage ? (
          <Image source={{ uri: media.localPath as string }} style={styles.image} contentFit="contain" />
        ) : (
          <View style={{ alignItems: 'center' }}>
            <Ionicons
              name={MEDIA_TYPE_ICONS[mediaType] ?? 'document-outline'}
              size={64}
              color={colors.textSecondary}
            />
            <Text style={styles.placeholderText}>
              {media.downloadState === 'pending'
                ? t('media_downloading')
                : mediaType === 'image'
                  ? t('media_file_unavailable')
                  : t('media_preview_unavailable')}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.headerRow}>
        <Text style={styles.fileName} numberOfLines={2}>{media.fileName}</Text>
        <TouchableOpacity onPress={handleToggleFavorite}>
          <Ionicons
            name={media.isFavorite ? 'star' : 'star-outline'}
            size={28}
            color={media.isFavorite ? colors.star : colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>{t('media_type')}</Text>
        <Text style={styles.metaValue}>{t(`media_type_${mediaType}`)}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>{t('media_format')}</Text>
        <Text style={styles.metaValue}>{media.mimeType}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>{t('media_size')}</Text>
        <Text style={styles.metaValue}>{formatSize(media.sizeBytes)}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>{t('media_sync_status')}</Text>
        <Text style={styles.metaValue}>
          {media.downloadState === 'pending'
            ? t('media_downloading')
            : media.uploadState === 'uploaded'
              ? t('media_synced')
              : media.uploadState === 'failed'
                ? t('media_transfer_failed')
                : t('media_pending_upload')}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>{t('title')}</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder={t('media_title_placeholder')}
      />

      <Text style={styles.sectionTitle}>{t('extra_notes')}</Text>
      <TextInput
        style={[styles.input, styles.notesInput]}
        value={extraNotes}
        onChangeText={setExtraNotes}
        placeholder={t('media_notes_placeholder')}
        multiline
      />

      <Text style={styles.sectionTitle}>{t('media_linked_entities')}</Text>
      <MultiSelectPill
        options={ownerOptions}
        selectedValues={selectedOwners}
        onSelectionChange={setSelectedOwners}
        placeholder={t('media_select_entities')}
        noOptionsText={t('media_no_entities_available')}
      />

      <View style={styles.actions}>
        <Button onPress={handleSave} disabled={saving}>
          {saving ? t('saving') : t('save_changes')}
        </Button>
        <Button onPress={handleDelete} style={styles.deleteButton} disabled={saving}>
          {t('delete')}
        </Button>
      </View>
    </ScrollView>
  );
};

export default GalleryDetailScreen;
