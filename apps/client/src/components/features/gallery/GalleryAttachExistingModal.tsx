import { Ionicons } from '@expo/vector-icons';
import type { MediaType } from '@keres/shared';
import { Image } from 'expo-image';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import type { GallerySelect } from '@/src/db/schema';
import { useResolvedMediaUri } from '@/src/hooks/useResolvedMediaUri';
import { getCommonInputStyles } from '@/src/theme/commonStyles';
import { useTheme } from '@/src/theme';
import { iconForGalleryMedia } from '@/src/components/features/list-items/GalleryGridItem';

interface Props {
  visible: boolean;
  media: GallerySelect[];
  loading: boolean;
  onClose: () => void;
  onConfirm: (galleryIds: string[]) => void;
}

/** A visual preview makes choosing an already-imported image or video unambiguous. */
const GalleryAttachmentPreview: React.FC<{ item: GallerySelect }> = ({ item }) => {
  const { colors } = useTheme();
  const mediaType = item.mediaType as MediaType;
  const uri = useResolvedMediaUri(mediaType === 'video' ? item.thumbnailPath : item.localPath);
  const [failedToLoad, setFailedToLoad] = useState(false);
  const isPreviewable = (mediaType === 'image' || mediaType === 'video') && !!uri && !failedToLoad;
  const styles = StyleSheet.create({
    wrapper: {
      alignItems: 'center',
      backgroundColor: colors.primaryContainer,
      borderRadius: 18,
      height: 36,
      justifyContent: 'center',
      overflow: 'hidden',
      width: 36,
    },
    preview: { height: '100%', width: '100%' },
    videoOverlay: {
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.38)',
      bottom: 0,
      justifyContent: 'center',
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    },
  });

  return (
    <View style={styles.wrapper}>
      {isPreviewable ? (
        <>
          <Image
            source={{ uri: uri as string }}
            style={styles.preview}
            contentFit="cover"
            onError={() => setFailedToLoad(true)}
          />
          {mediaType === 'video' && (
            <View style={styles.videoOverlay}>
              <Ionicons name="play" size={16} color="#ffffff" />
            </View>
          )}
        </>
      ) : (
        <Ionicons
          name={iconForGalleryMedia(mediaType, item.mimeType)}
          size={20}
          color={colors.primary}
        />
      )}
    </View>
  );
};

/** Lets a person attach media already catalogued by the story without importing its bytes again. */
const GalleryAttachExistingModal: React.FC<Props> = ({
  visible,
  media,
  loading,
  onClose,
  onConfirm,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const commonInputStyles = getCommonInputStyles(colors);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (visible) {
      setSearch('');
      setSelectedIds([]);
    }
  }, [visible]);

  const visibleMedia = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    if (!normalizedSearch) return media;
    return media.filter((item) =>
      `${item.title ?? ''} ${item.fileName}`.toLocaleLowerCase().includes(normalizedSearch),
    );
  }, [media, search]);
  const styles = StyleSheet.create({
    sheet: { backgroundColor: colors.surface, borderRadius: 10, padding: 20 },
    title: { color: colors.text, fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
    hint: { color: colors.textSecondary, lineHeight: 18, marginBottom: 14 },
    search: { marginBottom: 10 },
    list: { maxHeight: 310 },
    row: {
      alignItems: 'center',
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 10,
      paddingVertical: 11,
    },
    name: { color: colors.text, flex: 1, fontWeight: '600' },
    fileName: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
    empty: { color: colors.textSecondary, paddingVertical: 18, textAlign: 'center' },
    actions: { marginTop: 16 },
  });
  const toggle = (galleryId: string) => {
    setSelectedIds((current) =>
      current.includes(galleryId)
        ? current.filter((currentId) => currentId !== galleryId)
        : [...current, galleryId],
    );
  };

  return (
    <ResponsiveModal
      visible={visible}
      onClose={onClose}
      contentStyle={styles.sheet}
      maxHeight="86%"
    >
      <Text style={styles.title}>{t('gallery_attach_existing_title')}</Text>
      <Text style={styles.hint}>{t('gallery_attach_existing_hint')}</Text>
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder={t('gallery_attach_existing_search')}
        style={[commonInputStyles.input, styles.search]}
      />
      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.empty} />
      ) : visibleMedia.length === 0 ? (
        <Text style={styles.empty}>{t('gallery_attach_existing_empty')}</Text>
      ) : (
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {visibleMedia.map((item) => {
            const selected = selectedIds.includes(item.id);
            return (
              <TouchableOpacity
                key={item.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                onPress={() => toggle(item.id)}
                style={styles.row}
              >
                <GalleryAttachmentPreview item={item} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={styles.name}>
                    {item.title || item.fileName}
                  </Text>
                  {!!item.title && (
                    <Text numberOfLines={1} style={styles.fileName}>
                      {item.fileName}
                    </Text>
                  )}
                </View>
                <Ionicons
                  name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                  size={24}
                  color={selected ? colors.primary : colors.textSecondary}
                />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
      <View style={styles.actions}>
        <Button disabled={selectedIds.length === 0} onPress={() => onConfirm(selectedIds)}>
          {t('gallery_attach_existing_confirm', { count: selectedIds.length })}
        </Button>
      </View>
    </ResponsiveModal>
  );
};

export default GalleryAttachExistingModal;
