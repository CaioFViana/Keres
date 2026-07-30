import { Ionicons } from '@expo/vector-icons';
import { GalleryOwnerEntity, MediaType } from '@keres/shared';
import { Image } from 'expo-image';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GallerySelect } from '../../db/schema';
import { useEntityGalleryMedia } from '../../hooks/useEntityGalleryMedia';
import { useNotificationStore } from '../../state/notificationStore';
import { useTheme } from '../../theme';
import { MEDIA_TYPE_ICONS } from '../listitem/GalleryGridItem';

interface EntityGalleryManagerProps {
  ownerId: string | undefined;
  ownerType: GalleryOwnerEntity;
  /** Geralmente abre a mídia na tela de detalhe da galeria. */
  onPressMedia: (galleryId: string) => void;
}

const THUMB_SIZE = 88;

/**
 * Tira de mídias vinculadas a uma entidade, com um botão de adicionar.
 *
 * Some para "adicionar uma foto ao personagem" ser uma ação de um toque a partir da
 * própria tela de detalhe, sem passar por um formulário: a mídia é a única relação da
 * história para a qual anexar já é a ação principal (diferente de tags/notas, que fazem
 * mais sentido escolher de uma lista já existente). Remover aqui só desfaz o vínculo - a
 * mídia continua na galeria e pode ser vinculada de novo a qualquer momento por lá.
 */
const EntityGalleryManager: React.FC<EntityGalleryManagerProps> = ({ ownerId, ownerType, onPressMedia }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { showNotification } = useNotificationStore();
  const { media, importing, addMedia, removeMedia } = useEntityGalleryMedia(ownerId, ownerType);

  const handleAdd = useCallback(async () => {
    try {
      const summary = await addMedia();
      if (!summary) {
        return;
      }
      if (summary.added > 0 || summary.duplicates > 0) {
        showNotification(t('media_linked_to_entity', { count: summary.added + summary.duplicates }), 'success');
      }
      if (summary.rejected > 0) {
        showNotification(t('media_unsupported_skipped', { count: summary.rejected }), 'warning');
      }
    } catch (err) {
      console.error('Failed to add media to entity:', err);
      showNotification(t('media_picker_failed'), 'error');
    }
  }, [addMedia, showNotification, t]);

  const handleRemove = useCallback((galleryId: string) => {
    removeMedia(galleryId).catch((err) => {
      console.error('Failed to unlink media from entity:', err);
      showNotification(t('media_save_failed'), 'error');
    });
  }, [removeMedia, showNotification, t]);

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

  const renderThumb = (item: GallerySelect) => {
    const mediaType = item.mediaType as MediaType;
    const hasLocalImage = mediaType === 'image' && !!item.localPath;

    return (
      <TouchableOpacity key={item.id} style={styles.thumbWrapper} onPress={() => onPressMedia(item.id)}>
        {hasLocalImage ? (
          <Image source={{ uri: item.localPath as string }} style={styles.thumbImage} contentFit="cover" transition={150} />
        ) : (
          <View style={styles.thumbFallback}>
            <Ionicons name={MEDIA_TYPE_ICONS[mediaType] ?? 'document-outline'} size={28} color={colors.textSecondary} />
          </View>
        )}
        <TouchableOpacity
          style={styles.removeBadge}
          onPress={(event) => {
            event.stopPropagation();
            handleRemove(item.id);
          }}
        >
          <Ionicons name="close-circle" size={20} color={colors.error} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <TouchableOpacity style={styles.addTile} onPress={handleAdd} disabled={importing || !ownerId}>
          {importing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <Ionicons name="add" size={28} color={colors.primary} />
              <Text style={styles.addLabel}>{t('media_add_button')}</Text>
            </>
          )}
        </TouchableOpacity>
        {media.map(renderThumb)}
      </ScrollView>
      {media.length === 0 && <Text style={styles.emptyText}>{t('no_media_linked')}</Text>}
    </View>
  );
};

export default EntityGalleryManager;
