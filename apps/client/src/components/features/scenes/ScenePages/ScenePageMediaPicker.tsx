import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { useDrizzle } from '@/src/db';
import type { GallerySelect, SketchSelect } from '@/src/db/schema';
import type { ScenePageMedia } from '@/src/services/storymanagement/ScenePageService';
import { createGalleryService } from '@/src/services/storymanagement/GalleryService';
import { createSketchService } from '@/src/services/storymanagement/SketchService';
import { useTheme } from '@/src/theme';
import ScenePageThumb from './ScenePageThumb';

interface ScenePageMediaPickerProps {
  visible: boolean;
  storyId: string | undefined;
  onClose: () => void;
  onPick: (media: ScenePageMedia) => void;
}

type Tab = 'sketches' | 'gallery';

/** Chooses the image of a page: a Sketch drawn in this story, or an image of its Gallery. */
const ScenePageMediaPicker: React.FC<ScenePageMediaPickerProps> = ({
  visible,
  storyId,
  onClose,
  onPick,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const db = useDrizzle();
  const [tab, setTab] = useState<Tab>('sketches');
  const [sketches, setSketches] = useState<SketchSelect[]>([]);
  const [images, setImages] = useState<GallerySelect[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !storyId) return;
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the spinner shows while the choices load; everything else waits for `await`.
    setLoading(true);
    void Promise.all([
      createSketchService(db).getSketchesForStory(storyId),
      createGalleryService(db).getGalleriesByStoryId(storyId, { mediaTypes: ['image'] }),
    ])
      .then(([sketchRows, imageRows]) => {
        if (!alive) return;
        setSketches(sketchRows);
        setImages(imageRows);
      })
      .catch((error) => {
        console.log('ScenePageMediaPicker: failed to load the choices.', error);
        if (alive) {
          setSketches([]);
          setImages([]);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [db, storyId, visible]);

  const tabStyle = (active: boolean) => [
    styles.tab,
    { borderColor: colors.border },
    active && { backgroundColor: colors.primary, borderColor: colors.primary },
  ];
  const tabText = (active: boolean) => ({ color: active ? colors.onPrimary : colors.text });

  return (
    <ResponsiveModal
      visible={visible}
      onClose={onClose}
      contentStyle={[styles.sheet, { backgroundColor: colors.surface }]}
      maxHeight="86%"
    >
      <Text style={[styles.title, { color: colors.text }]}>{t('scene_pages_pick_title')}</Text>
      <View style={styles.tabs}>
        {(['sketches', 'gallery'] as const).map((name) => (
          <TouchableOpacity
            key={name}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === name }}
            style={tabStyle(tab === name)}
            onPress={() => setTab(name)}
          >
            <Text style={tabText(tab === name)}>{t(`scene_pages_pick_${name}`)}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : tab === 'sketches' ? (
        sketches.length === 0 ? (
          <Text style={{ color: colors.textSecondary }}>{t('scene_pages_pick_no_sketches')}</Text>
        ) : (
          <ScrollView style={styles.list}>
            {sketches.map((sketch) => (
              <TouchableOpacity
                key={sketch.id}
                accessibilityRole="button"
                accessibilityLabel={sketch.name}
                style={[styles.row, { borderBottomColor: colors.border }]}
                onPress={() => onPick({ sketchId: sketch.id })}
              >
                <ScenePageThumb
                  galleryId={sketch.coverGalleryId}
                  width={48}
                  height={48}
                  label={sketch.name}
                />
                <Text style={[styles.rowName, { color: colors.text }]}>{sketch.name}</Text>
                <Ionicons name="brush-outline" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )
      ) : images.length === 0 ? (
        <Text style={{ color: colors.textSecondary }}>{t('scene_pages_pick_no_images')}</Text>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.grid}>
          {images.map((image) => (
            <TouchableOpacity
              key={image.id}
              accessibilityRole="button"
              accessibilityLabel={image.title ?? image.fileName}
              onPress={() => onPick({ galleryId: image.id })}
            >
              <ScenePageThumb galleryId={image.id} width={84} height={84} fit="cover" />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </ResponsiveModal>
  );
};

const styles = StyleSheet.create({
  sheet: { borderRadius: 10, padding: 20 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tab: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6 },
  list: { maxHeight: 380 },
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
  },
  rowName: { flex: 1, fontSize: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});

export default ScenePageMediaPicker;
