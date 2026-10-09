import Button from '@/src/components/common/controls/Button/Button';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import type { GallerySelect } from '@/src/db/schema';
import { useGalleryImages, useGalleryRow } from '@/src/hooks/useGalleryMedia';
import { useResolvedMediaUri } from '@/src/hooks/useResolvedMediaUri';
import { useTheme } from '@/src/theme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface GalleryCoverFieldProps {
  storyId: string | undefined;
  /** The Gallery row used as the cover, or `null`. */
  value: string | null;
  onChange: (galleryId: string | null) => void;
  editable?: boolean;
}

const Thumb: React.FC<{ item: GallerySelect; size: number }> = ({ item, size }) => {
  const { colors } = useTheme();
  const uri = useResolvedMediaUri(item.localPath);
  const frame = {
    width: size,
    height: size,
    borderRadius: 8,
    backgroundColor: colors.border,
  };
  if (!uri) {
    return (
      <View style={[frame, styles.center]}>
        <Ionicons name="image-outline" size={size / 2} color={colors.textSecondary} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={frame}
      contentFit="cover"
      accessibilityLabel={item.title ?? item.fileName}
    />
  );
};

/**
 * Picks one image of the story's gallery as a cover. The cover is a row-level link, never part of the
 * Gallery: choosing or clearing it neither copies nor deletes the media.
 */
const GalleryCoverField: React.FC<GalleryCoverFieldProps> = ({
  storyId,
  value,
  onChange,
  editable = true,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const current = useGalleryRow(value);
  const { images, loading } = useGalleryImages(storyId, open);

  const openPicker = () => setOpen(true);

  const shown = current;

  return (
    <View style={styles.row}>
      {shown ? (
        <Thumb item={shown} size={64} />
      ) : (
        <View style={[styles.empty, { borderColor: colors.border }]}>
          <Ionicons name="image-outline" size={26} color={colors.textSecondary} />
        </View>
      )}
      <View style={styles.actions}>
        <Text style={{ color: colors.textSecondary }}>
          {shown ? (shown.title ?? shown.fileName) : t('cover_none')}
        </Text>
        {editable ? (
          <View style={styles.buttons}>
            <Button onPress={openPicker}>{t('cover_choose')}</Button>
            {value ? <Button onPress={() => onChange(null)}>{t('cover_remove')}</Button> : null}
          </View>
        ) : null}
      </View>
      <ResponsiveModal
        visible={open}
        onClose={() => setOpen(false)}
        tone="raised"
        inset="roomy"
        maxHeight="86%"
      >
        <Text style={[styles.title, { color: colors.text }]}>{t('cover_picker_title')}</Text>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>{t('cover_picker_hint')}</Text>
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : images.length === 0 ? (
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            {t('cover_picker_empty')}
          </Text>
        ) : (
          <ScrollView style={styles.list} contentContainerStyle={styles.grid}>
            {images.map((item) => (
              <TouchableOpacity
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={item.title ?? item.fileName}
                onPress={() => {
                  onChange(item.id);
                  setOpen(false);
                }}
              >
                <Thumb item={item} size={84} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </ResponsiveModal>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  actions: { flex: 1, gap: 8 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  center: { alignItems: 'center', justifyContent: 'center' },
  empty: {
    alignItems: 'center',
    borderRadius: 8,
    borderStyle: 'dashed',
    borderWidth: 1,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  hint: { lineHeight: 18, marginBottom: 14 },
  list: { maxHeight: 360 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});

export default GalleryCoverField;
