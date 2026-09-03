import { Ionicons } from '@expo/vector-icons';
import type { GalleryOwnerEntity, MediaType } from '@keres/shared';
import { Image } from 'expo-image';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { GallerySelect } from '../../../../db/schema';
import { useEntityGalleryMedia } from '../../../../hooks/useEntityGalleryMedia';
import { useResolvedMediaUri } from '../../../../hooks/useResolvedMediaUri';
import { useNotificationStore } from '../../../../state/notificationStore';
import { useTheme } from '../../../../theme';
import GalleryAddMediaModal, {
  type EntityMediaAddKind,
} from '@/src/components/features/gallery/GalleryAddMediaModal';
import GalleryAddLinkModal from '@/src/components/features/gallery/GalleryAddLinkModal';
import GalleryAttachExistingModal from '@/src/components/features/gallery/GalleryAttachExistingModal';
import { iconForGalleryMedia } from '@/src/components/features/list-items/GalleryGridItem';

interface EntityGalleryManagerProps {
  ownerId: string | undefined;
  ownerType: GalleryOwnerEntity;
  /** It usually opens the media on the gallery's detail screen. */
  onPressMedia: (galleryId: string) => void;
  /** false hides the add tile and the remove badge (a reader with no write permission, say). */
  editable?: boolean;
}

const THUMB_SIZE = 88;

interface GalleryThumbnailProps {
  item: GallerySelect;
  styles: {
    thumbWrapper: object;
    thumbImage: object;
    thumbFallback: object;
    playOverlay: object;
    removeBadge: object;
  };
  errorColor: string;
  textSecondaryColor: string;
  onPress: (galleryId: string) => void;
  onRemove: (galleryId: string) => void;
  editable: boolean;
}

/**
 * Extracted from `renderThumb`'s `.map()` because resolving the URI (`useResolvedMediaUri`) is a hook -
 * it needs a component of its own per item, it cannot be called inside a loop.
 */
const GalleryThumbnail: React.FC<GalleryThumbnailProps> = ({
  item,
  styles,
  errorColor,
  textSecondaryColor,
  onPress,
  onRemove,
  editable,
}) => {
  const mediaType = item.mediaType as MediaType;
  const resolvedUri = useResolvedMediaUri(
    mediaType === 'video' ? item.thumbnailPath : item.localPath,
  );
  const hasLocalImage = mediaType === 'image' && !!resolvedUri;
  const hasVideoThumbnail = mediaType === 'video' && !!resolvedUri;

  return (
    <TouchableOpacity style={styles.thumbWrapper} onPress={() => onPress(item.id)}>
      {hasLocalImage || hasVideoThumbnail ? (
        <Image
          source={{ uri: resolvedUri as string }}
          style={styles.thumbImage}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <View style={styles.thumbFallback}>
          <Ionicons
            name={iconForGalleryMedia(mediaType, item.mimeType)}
            size={28}
            color={textSecondaryColor}
          />
        </View>
      )}
      {mediaType === 'video' && (
        <View style={styles.playOverlay} pointerEvents="none">
          <Ionicons name="play-circle" size={24} color="#ffffff" />
        </View>
      )}
      {editable && (
        <TouchableOpacity
          style={styles.removeBadge}
          onPress={(event) => {
            event.stopPropagation();
            onRemove(item.id);
          }}
        >
          <Ionicons name="close-circle" size={20} color={errorColor} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

/**
 * A strip of media linked to an entity, with an add button.
 *
 * It exists so "add a photo to the character" is a one-tap action from the detail screen itself,
 * without going through a form: media is the story's only relation for which attaching is already the
 * main action (unlike tags/notes, which make more sense to pick from an existing list). Removing here
 * only undoes the link - the media stays in the gallery and can be linked again at any time from there.
 */
const EntityGalleryManager: React.FC<EntityGalleryManagerProps> = ({
  ownerId,
  ownerType,
  onPressMedia,
  editable = true,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { showNotification } = useNotificationStore();
  const {
    media,
    importing,
    addPlayableMedia,
    addDocuments,
    addLink,
    getUnlinkedMedia,
    linkExistingMedia,
    removeMedia,
  } = useEntityGalleryMedia(ownerId, ownerType);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [existingMediaVisible, setExistingMediaVisible] = useState(false);
  const [existingMediaLoading, setExistingMediaLoading] = useState(false);
  const [unlinkedMedia, setUnlinkedMedia] = useState<GallerySelect[]>([]);

  const notifyImport = useCallback(
    async (run: () => Promise<{ added: number; duplicates: number; rejected: number } | null>) => {
      try {
        const summary = await run();
        if (!summary) {
          return;
        }
        if (summary.added > 0 || summary.duplicates > 0) {
          showNotification(
            t('media_linked_to_entity', { count: summary.added + summary.duplicates }),
            'success',
          );
        }
        if (summary.rejected > 0) {
          showNotification(t('media_unsupported_skipped', { count: summary.rejected }), 'warning');
        }
      } catch (err) {
        console.error('Failed to add media to entity:', err);
        showNotification(t('media_picker_failed'), 'error');
      }
    },
    [showNotification, t],
  );

  const openExistingMedia = useCallback(async () => {
    setAddModalVisible(false);
    setExistingMediaVisible(true);
    setExistingMediaLoading(true);
    try {
      setUnlinkedMedia(await getUnlinkedMedia());
    } catch (error) {
      console.error('Failed to load gallery media to attach:', error);
      showNotification(t('media_load_failed'), 'error');
      setUnlinkedMedia([]);
    } finally {
      setExistingMediaLoading(false);
    }
  }, [getUnlinkedMedia, showNotification, t]);

  const handleAddKind = useCallback(
    (kind: EntityMediaAddKind) => {
      if (kind === 'existing') {
        void openExistingMedia();
        return;
      }
      setAddModalVisible(false);
      if (kind === 'playable') void notifyImport(addPlayableMedia);
      else if (kind === 'document') void notifyImport(addDocuments);
      else setLinkModalVisible(true);
    },
    [addDocuments, addPlayableMedia, notifyImport, openExistingMedia],
  );

  const handleAttachExistingMedia = useCallback(
    async (galleryIds: string[]) => {
      try {
        const count = await linkExistingMedia(galleryIds);
        if (count > 0) {
          showNotification(t('media_linked_to_entity', { count }), 'success');
        }
        setExistingMediaVisible(false);
      } catch (error) {
        console.error('Failed to attach existing gallery media:', error);
        showNotification(t('media_save_failed'), 'error');
      }
    },
    [linkExistingMedia, showNotification, t],
  );

  const handleRemove = useCallback(
    (galleryId: string) => {
      removeMedia(galleryId).catch((err) => {
        console.error('Failed to unlink media from entity:', err);
        showNotification(t('media_save_failed'), 'error');
      });
    },
    [removeMedia, showNotification, t],
  );

  const styles = StyleSheet.create({
    container: {
      marginBottom: 5,
    },
    row: {
      flexDirection: 'row',
      paddingVertical: 5,
    },
    addTile: {
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: 8,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    addLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 4,
    },
    thumbWrapper: {
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: 8,
      marginRight: 10,
      overflow: 'hidden',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    thumbImage: {
      width: '100%',
      height: '100%',
    },
    thumbFallback: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    playOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    removeBadge: {
      position: 'absolute',
      top: 4,
      right: 4,
      backgroundColor: colors.background,
      opacity: 0.9,
      borderRadius: 10,
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: 13,
      marginTop: 2,
    },
  });

  const renderThumb = (item: GallerySelect) => (
    <GalleryThumbnail
      key={item.id}
      item={item}
      styles={styles}
      errorColor={colors.error}
      textSecondaryColor={colors.textSecondary}
      onPress={onPressMedia}
      onRemove={handleRemove}
      editable={editable}
    />
  );

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {editable && (
          <TouchableOpacity
            style={styles.addTile}
            onPress={() => setAddModalVisible(true)}
            disabled={importing || !ownerId}
          >
            {importing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Ionicons name="add" size={28} color={colors.primary} />
                <Text style={styles.addLabel}>{t('media_add_button')}</Text>
              </>
            )}
          </TouchableOpacity>
        )}
        {media.map(renderThumb)}
      </ScrollView>
      {media.length === 0 && <Text style={styles.emptyText}>{t('no_media_linked')}</Text>}
      <GalleryAddLinkModal
        visible={linkModalVisible}
        onCancel={() => setLinkModalVisible(false)}
        onConfirm={(url, title) => {
          setLinkModalVisible(false);
          void notifyImport(() => addLink(url, title));
        }}
      />
      <GalleryAddMediaModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onPick={handleAddKind}
      />
      <GalleryAttachExistingModal
        visible={existingMediaVisible}
        media={unlinkedMedia}
        loading={existingMediaLoading}
        onClose={() => setExistingMediaVisible(false)}
        onConfirm={(galleryIds) => void handleAttachExistingMedia(galleryIds)}
      />
    </View>
  );
};

export default EntityGalleryManager;
