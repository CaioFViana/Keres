import { Ionicons } from '@expo/vector-icons';
import type { MediaType } from '@keres/shared';
import { Image } from 'expo-image';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { GallerySelect } from '../../../db/schemas/galleries';
import { useResolvedMediaUri } from '../../../hooks/useResolvedMediaUri';
import { useTheme } from '../../../theme';

interface GalleryGridItemProps {
  media: GallerySelect;
  onPress: (galleryId: string) => void;
  onToggleFavorite?: (galleryId: string, isFavorite: boolean) => void;
}

/** Ícone que representa a mídia quando não há miniatura para mostrar. */
export const MEDIA_TYPE_ICONS: Record<MediaType, keyof typeof Ionicons.glyphMap> = {
  image: 'image-outline',
  video: 'videocam-outline',
  audio: 'musical-notes-outline',
};

function formatSize(bytes: number): string {
  if (bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Uma célula da grade da galeria.
 *
 * Imagem usa o próprio arquivo como miniatura; vídeo usa um quadro extraído e persistido
 * em `thumbnailPath` (ver `MediaFileService.generateVideoThumbnail`), porque gerar isso na
 * hora do render travaria a rolagem de uma grade inteira. Áudio não tem quadro para
 * mostrar e fica só com o ícone do tipo.
 */
const GalleryGridItem: React.FC<GalleryGridItemProps> = ({ media, onPress, onToggleFavorite }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const mediaType = media.mediaType as MediaType;
  const resolvedUri = useResolvedMediaUri(
    mediaType === 'video' ? media.thumbnailPath : media.localPath,
  );
  const hasLocalImage = mediaType === 'image' && !!resolvedUri;
  const hasVideoThumbnail = mediaType === 'video' && !!resolvedUri;
  const isDownloading = media.downloadState === 'pending';
  const transferFailed = media.uploadState === 'failed' || media.downloadState === 'failed';
  const pendingUpload = media.uploadState === 'pending';

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      margin: 5,
      borderRadius: 8,
      overflow: 'hidden',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    preview: {
      width: '100%',
      aspectRatio: 1,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    image: {
      width: '100%',
      height: '100%',
    },
    info: {
      padding: 8,
    },
    title: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    subtitle: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
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
    badgeRow: {
      position: 'absolute',
      top: 6,
      left: 6,
      right: 6,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    badge: {
      backgroundColor: colors.background,
      opacity: 0.85,
      borderRadius: 12,
      padding: 4,
    },
    statusText: {
      fontSize: 10,
      color: colors.textSecondary,
      marginTop: 4,
      fontStyle: 'italic',
    },
  });

  return (
    <TouchableOpacity style={styles.container} onPress={() => onPress(media.id)}>
      <View style={styles.preview}>
        {hasLocalImage || hasVideoThumbnail ? (
          <Image
            source={{ uri: resolvedUri as string }}
            style={styles.image}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <Ionicons
            name={MEDIA_TYPE_ICONS[mediaType] ?? 'document-outline'}
            size={48}
            color={colors.textSecondary}
          />
        )}

        {mediaType === 'video' && (
          <View style={styles.playOverlay} pointerEvents="none">
            <Ionicons name="play-circle" size={36} color="#ffffff" />
          </View>
        )}

        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Ionicons
              name={MEDIA_TYPE_ICONS[mediaType] ?? 'document-outline'}
              size={14}
              color={colors.text}
            />
          </View>
          {onToggleFavorite && (
            <TouchableOpacity
              style={styles.badge}
              onPress={() => onToggleFavorite(media.id, !media.isFavorite)}
            >
              <Ionicons
                name={media.isFavorite ? 'star' : 'star-outline'}
                size={16}
                color={media.isFavorite ? colors.star : colors.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
          {media.title || media.fileName}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {t(`media_type_${mediaType}`)}
          {media.sizeBytes > 0 ? ` · ${formatSize(media.sizeBytes)}` : ''}
        </Text>
        {isDownloading && <Text style={styles.statusText}>{t('media_downloading')}</Text>}
        {!isDownloading && pendingUpload && (
          <Text style={styles.statusText}>{t('media_pending_upload')}</Text>
        )}
        {transferFailed && <Text style={styles.statusText}>{t('media_transfer_failed')}</Text>}
      </View>
    </TouchableOpacity>
  );
};

export default GalleryGridItem;
