import { Ionicons } from '@expo/vector-icons';
import { MediaType } from '@keres/shared';
import { Image } from 'expo-image';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GallerySelect } from '../../db/schemas/galleries';
import { useTheme } from '../../theme';

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
 * Só imagem tem miniatura de verdade. Vídeo e áudio mostram um ícone do tipo: gerar quadro
 * de vídeo exigiria uma dependência nativa a mais, e o que a pessoa precisa aqui é
 * distinguir e encontrar a mídia, não assisti-la na grade.
 */
const GalleryGridItem: React.FC<GalleryGridItemProps> = ({ media, onPress, onToggleFavorite }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const mediaType = media.mediaType as MediaType;
  const hasLocalImage = mediaType === 'image' && !!media.localPath;
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
        {hasLocalImage ? (
          <Image
            source={{ uri: media.localPath as string }}
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

        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Ionicons name={MEDIA_TYPE_ICONS[mediaType] ?? 'document-outline'} size={14} color={colors.text} />
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
        {!isDownloading && pendingUpload && <Text style={styles.statusText}>{t('media_pending_upload')}</Text>}
        {transferFailed && <Text style={styles.statusText}>{t('media_transfer_failed')}</Text>}
      </View>
    </TouchableOpacity>
  );
};

export default GalleryGridItem;
