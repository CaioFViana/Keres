import { Ionicons } from '@expo/vector-icons';
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
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { useScenePageChoices } from '@/src/hooks/useGalleryMedia';
import type { ScenePageMedia } from '@/src/services/storymanagement/ScenePageService';
import { useTheme } from '@/src/theme';
import { scenePickerStyleDefs } from '../scenePickerStyleDefs';
import ScenePageThumb from './ScenePageThumb';
import ThemedText from '@/src/components/common/display/ThemedText/ThemedText';
import ModalHeader from '@/src/components/layout/ModalHeader/ModalHeader';

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
  const [tab, setTab] = useState<Tab>('sketches');
  const { sketches, images, loading } = useScenePageChoices(storyId, visible);

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
      tone="raised"
      inset="roomy"
      maxHeight="86%"
    >
      <ModalHeader title={t('scene_pages_pick_title')} />
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
          <ThemedText tone="secondary">{t('scene_pages_pick_no_sketches')}</ThemedText>
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
        <ThemedText tone="secondary">{t('scene_pages_pick_no_images')}</ThemedText>
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
  ...scenePickerStyleDefs,
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
