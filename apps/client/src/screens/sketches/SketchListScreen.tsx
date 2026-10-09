import {
  emptySketchContent,
  generateSketchLocalId,
  getEntityAppearance,
  SKETCH_PAGE_PRESETS,
} from '@keres/shared';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { ScreenError } from '@/src/components/common/feedback/ScreenState/ScreenState';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import CanvasListRow from '@/src/components/features/canvas/CanvasListRow';
import SketchCreateModal from '@/src/components/features/sketches/SketchCreateModal';
import { useDrizzle } from '../../db';
import type { GallerySelect, SketchSelect } from '../../db/schema';
import { useScreenAnchor } from '../../guides/useGuideAnchor';
import { useScreenTour } from '../../guides/useScreenTour';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useConfirmDelete } from '../../hooks/useConfirmDelete';
import { useResolvedMediaUri } from '../../hooks/useResolvedMediaUri';
import { useScreenHeader } from '../../hooks/useScreenHeader';
import { useStoryRole } from '../../hooks/useStoryRole';
import type { SketchStackParamList } from '../../navigation/MainSystemStack';
import { filterByNameAndDescription } from '../../utils/filterByNameAndDescription';
import { createGalleryService } from '../../services/storymanagement/GalleryService';
import { createSketchService } from '../../services/storymanagement/SketchService';
import { useNotificationStore } from '../../state/notificationStore';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { commonScreenStyleDefs } from '../../theme/commonStyles';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { AppAlert } from '../../utils/AppAlert';

type Navigation = NativeStackNavigationProp<SketchStackParamList, 'SketchList'>;

/** The gallery snapshot linked as the sketch's cover, or the sketch icon when none. */
const SketchCover: React.FC<{ storyId: string; sketch: SketchSelect }> = ({ storyId, sketch }) => {
  const { colors } = useTheme();
  const db = useDrizzle();
  const [cover, setCover] = useState<GallerySelect | null>(null);
  useEffect(() => {
    let alive = true;
    if (sketch.coverGalleryId) {
      const coverId = sketch.coverGalleryId;
      void createGalleryService(db)
        .getById(coverId)
        .then((row) => {
          if (alive) setCover(row && !row.isDeleted ? row : null);
        })
        .catch(() => {
          if (alive) setCover(null);
        });
    }
    return () => {
      alive = false;
    };
  }, [db, sketch.coverGalleryId, storyId]);
  // The cached row only counts when it matches the sketch's current cover link;
  // a missing or changed link falls back to the icon with no extra render pass.
  const visibleCover = cover && cover.id === sketch.coverGalleryId ? cover : null;
  const resolvedUri = useResolvedMediaUri(visibleCover?.localPath);
  if (visibleCover && resolvedUri) {
    return (
      <Image
        source={{ uri: resolvedUri }}
        style={{
          width: 48,
          height: 48,
          borderRadius: 8,
          marginRight: 12,
          backgroundColor: colors.border,
        }}
        contentFit="cover"
        accessibilityLabel={visibleCover.title ?? sketch.name}
      />
    );
  }
  const appearance = getEntityAppearance('Sketch');
  return (
    <Ionicons
      name={appearance.icon as keyof typeof Ionicons.glyphMap}
      size={24}
      color={appearance.color}
      style={{ marginRight: 12 }}
    />
  );
};

const SketchListScreen = () => {
  useBackButtonHandler();
  useScreenTour('SketchStack');
  const listAnchorRef = useScreenAnchor('Sketches', 'list');
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<Navigation>();
  const db = useDrizzle();
  const storyId = useStoryStore((state) => state.selectedStory?.id);
  const { canEdit } = useStoryRole(storyId);
  const { userId } = useUserSettingsStore();
  const { showNotification } = useNotificationStore();
  const confirmDelete = useConfirmDelete();
  const [sketches, setSketches] = useState<SketchSelect[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [createVisible, setCreateVisible] = useState(false);
  const [editingSketch, setEditingSketch] = useState<SketchSelect | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const reload = useCallback(async () => {
    if (!storyId) {
      setSketches([]);
      return;
    }
    try {
      setSketches(await createSketchService(db).getSketchesForStory(storyId));
      setError(null);
    } catch (loadError) {
      console.log('SketchListScreen: failed to load sketches.', loadError);
      setError(t('sketch_load_failed'));
    }
  }, [db, storyId, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- `reload` clears synchronously only when no story is selected; everything else waits for `await`. The rule cannot verify across the callback boundary.
    void reload();
  }, [reload]);

  useEffect(() => {
    const onChange = (changedStoryId: string) => {
      if (changedStoryId === storyId) void reload();
    };
    entityEventEmitter.on('sketch_changed', onChange);
    return () => entityEventEmitter.off('sketch_changed', onChange);
  }, [reload, storyId]);

  useScreenHeader({
    target: 'parent',
    title: t('sketches_title'),
    actions: [
      {
        id: 'action-0',
        icon: 'add',
        label: t('sketch_create_title'),
        onPress: () => setCreateVisible(true),
        visible: !!canEdit,
      },
    ],
  });

  const styles = StyleSheet.create({
    ...commonScreenStyleDefs(colors),
    searchContainer: { padding: 10 },
    empty: {
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 32,
      paddingHorizontal: 24,
    },
  });

  const filteredSketches = useMemo(
    () => filterByNameAndDescription(sketches, searchQuery),
    [sketches, searchQuery],
  );

  if (error) {
    return <ScreenError message={error} onGoBack={() => navigation.goBack()} />;
  }

  const confirmDuplicateSketch = (item: SketchSelect) => {
    AppAlert.alert(t('sketch_duplicate_title'), t('sketch_duplicate_message'), [
      {
        text: t('confirm'),
        onPress: async () => {
          if (!userId || !storyId) return;
          try {
            await createSketchService(db).createSketch(userId, {
              storyId,
              name: t('sketch_copy_name', { name: item.name }),
              description: item.description,
              content: item.content,
            });
            await reload();
          } catch (duplicateError) {
            console.log('SketchListScreen: failed to duplicate sketch.', duplicateError);
            showNotification(t('sketch_save_failed'), 'error');
          }
        },
      },
      { text: t('cancel'), style: 'cancel' },
    ]);
  };
  const confirmSketchDelete = (item: SketchSelect) =>
    confirmDelete({
      titleKey: 'sketch_delete_title',
      messageKey: 'sketch_delete_message',
      onConfirm: async () => {
        if (!userId) return;
        await createSketchService(db).deleteSketch(userId, item.id);
        await reload();
      },
      failureKey: 'sketch_save_failed',
    });
  const updateSketchDetails = async (name: string, description: string | null) => {
    if (!editingSketch || !userId) return;
    try {
      await createSketchService(db).updateSketch(userId, editingSketch.id, { name, description });
      setEditingSketch(null);
      await reload();
    } catch (updateError) {
      console.log('SketchListScreen: failed to update sketch details.', updateError);
      showNotification(t('sketch_save_failed'), 'error');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t('sketch_search_placeholder')}
          accessibilityLabel={t('sketch_search_placeholder')}
        />
      </View>
      <View ref={listAnchorRef} collapsable={false} style={{ flex: 1 }}>
        <FlatList
          data={filteredSketches}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {searchQuery.trim() ? t('sketch_search_no_results') : t('sketch_list_empty')}
            </Text>
          }
          renderItem={({ item }) => (
            <CanvasListRow
              leading={storyId ? <SketchCover storyId={storyId} sketch={item} /> : null}
              name={item.name}
              description={item.description}
              canEdit={!!canEdit}
              onPress={() => navigation.navigate('SketchCanvas', { sketchId: item.id })}
              onEdit={() => setEditingSketch(item)}
              onDuplicate={() => confirmDuplicateSketch(item)}
              onDelete={() => confirmSketchDelete(item)}
            />
          )}
        />
      </View>
      <SketchCreateModal
        visible={createVisible}
        onCancel={() => setCreateVisible(false)}
        pickPage
        onConfirm={async (name, description, pagePreset) => {
          if (!storyId || !userId) return;
          setCreateVisible(false);
          try {
            const created = await createSketchService(db).createSketch(userId, {
              storyId,
              name,
              description,
              content: emptySketchContent(
                generateSketchLocalId(new Set()),
                t('sketch_layer_default_name', { count: 1 }),
                {
                  ...(SKETCH_PAGE_PRESETS.find((preset) => preset.id === pagePreset) ??
                    SKETCH_PAGE_PRESETS[0]),
                  preset: pagePreset,
                  background: 'paper',
                },
              ),
            });
            navigation.navigate('SketchCanvas', { sketchId: created.id });
          } catch (createError) {
            console.log('SketchListScreen: failed to create a sketch.', createError);
            showNotification(t('sketch_save_failed'), 'error');
          }
        }}
      />
      <SketchCreateModal
        visible={!!editingSketch}
        initialValues={editingSketch ?? undefined}
        title={t('edit')}
        confirmLabel={t('save')}
        onCancel={() => setEditingSketch(null)}
        onConfirm={(name, description) => void updateSketchDetails(name, description)}
      />
    </View>
  );
};

export default SketchListScreen;
