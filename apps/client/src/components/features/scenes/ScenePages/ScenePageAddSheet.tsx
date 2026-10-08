import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { useScenePageChoices } from '@/src/hooks/useGalleryMedia';
import { useTheme } from '@/src/theme';

interface ScenePageAddSheetProps {
  visible: boolean;
  storyId: string | undefined;
  /** A storyboard calls them frames; every other medium, pages. */
  kind: 'page' | 'frame';
  /** Putting another picture in the place of a page's: one picture, not several. */
  replacing?: boolean;
  onClose: () => void;
  onDraw: () => void;
  onUpload: () => void;
  onChooseExisting: () => void;
}

type Door = {
  id: 'draw' | 'upload' | 'existing';
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint: string;
  onPress: () => void;
};

/**
 * The ways to give a page its picture, each a door of its own: draw one now, bring pictures from the
 * device, or take one the story already has. The last is offered only when there is something to take -
 * a story's first page has nothing to choose from, and a picker with two empty lists is a dead end.
 */
const ScenePageAddSheet: React.FC<ScenePageAddSheetProps> = ({
  visible,
  storyId,
  kind,
  replacing = false,
  onClose,
  onDraw,
  onUpload,
  onChooseExisting,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { sketches, images } = useScenePageChoices(storyId, visible);
  const hasExisting = sketches.length > 0 || images.length > 0;

  const doors: Door[] = [
    {
      id: 'draw',
      icon: 'brush-outline',
      title: t(`scene_pages_door_draw_${kind}`),
      hint: t(`scene_pages_door_draw_${kind}_hint`),
      onPress: onDraw,
    },
    {
      id: 'upload',
      icon: 'image-outline',
      title: t(replacing ? 'scene_pages_door_upload_one' : 'scene_pages_door_upload'),
      hint: t(
        replacing ? 'scene_pages_door_upload_one_hint' : `scene_pages_door_upload_${kind}_hint`,
      ),
      onPress: onUpload,
    },
    ...(hasExisting
      ? [
          {
            id: 'existing' as const,
            icon: 'albums-outline' as const,
            title: t('scene_pages_door_existing'),
            hint: t('scene_pages_door_existing_hint'),
            onPress: onChooseExisting,
          },
        ]
      : []),
  ];

  return (
    <ResponsiveModal
      visible={visible}
      onClose={onClose}
      contentStyle={[styles.sheet, { backgroundColor: colors.surface }]}
      maxHeight="86%"
    >
      <Text style={[styles.title, { color: colors.text }]}>
        {t(replacing ? 'scene_pages_replace_title' : `scene_pages_add_sheet_title_${kind}`)}
      </Text>
      {doors.map((door) => (
        <TouchableOpacity
          key={door.id}
          testID={`scene-pages-door-${door.id}`}
          accessibilityRole="button"
          style={[styles.door, { borderColor: colors.border }]}
          onPress={door.onPress}
        >
          <Ionicons name={door.icon} size={26} color={colors.primary} />
          <View style={styles.doorBody}>
            <Text style={[styles.doorTitle, { color: colors.text }]}>{door.title}</Text>
            <Text style={[styles.doorHint, { color: colors.textSecondary }]}>{door.hint}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      ))}
    </ResponsiveModal>
  );
};

const styles = StyleSheet.create({
  sheet: { borderRadius: 10, padding: 20 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  door: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    marginBottom: 10,
    padding: 14,
  },
  doorBody: { flex: 1 },
  doorTitle: { fontSize: 16, fontWeight: '600' },
  doorHint: { fontSize: 13, lineHeight: 18, marginTop: 2 },
});

export default ScenePageAddSheet;
