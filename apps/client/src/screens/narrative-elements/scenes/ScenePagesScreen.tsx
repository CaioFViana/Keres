import type { ScenePageFit } from '@keres/shared';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import ScenePageCard from '@/src/components/features/scenes/ScenePages/ScenePageCard';
import ScenePageMediaPicker from '@/src/components/features/scenes/ScenePages/ScenePageMediaPicker';
import KeyboardAwareScreen from '@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import { useDrizzle } from '@/src/db';
import type { SceneSelect } from '@/src/db/schema';
import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import { useConfirmDelete } from '@/src/hooks/useConfirmDelete';
import { useFormScrollBottomPadding } from '@/src/hooks/useFormScrollBottomPadding';
import { useSceneArcMedium } from '@/src/hooks/useSceneArcMedium';
import { useScenePages } from '@/src/hooks/useScenePages';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { useStoryRole } from '@/src/hooks/useStoryRole';
import type { NarrativeElementsStackParamList } from '@/src/navigation/MainSystemStack';
import { createSceneService } from '@/src/services/storymanagement/SceneService';
import {
  createScenePageService,
  type ScenePageMedia,
} from '@/src/services/storymanagement/ScenePageService';
import { useNotificationStore } from '@/src/state/notificationStore';
import { useUserSettingsStore } from '@/src/state/userSettingsStore';
import { useTheme } from '@/src/theme';
import { getCommonContainerStyles } from '@/src/theme/commonStyles';

type RouteProps = RouteProp<NarrativeElementsStackParamList, 'ScenePages'>;

/** A storyboard calls them frames; every other medium, pages. */
export const scenePageKind = (medium: string | null): 'page' | 'frame' =>
  medium === 'storyboard' ? 'frame' : 'page';

/**
 * The pages of one scene (frames, in a storyboard): each an image and the text that goes with it.
 * The image is a Sketch of the story or a Gallery image; the order is the order of the manuscript.
 */
const ScenePagesScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { sceneId } = useRoute<RouteProps>().params;
  const db = useDrizzle();
  const { userId } = useUserSettingsStore();
  const { showNotification } = useNotificationStore();
  const confirmDelete = useConfirmDelete();
  const scrollBottomPadding = useFormScrollBottomPadding();
  const [scene, setScene] = useState<SceneSelect | null | undefined>(undefined);
  const { canEdit } = useStoryRole(scene?.storyId);
  const medium = useSceneArcMedium(scene ?? { chapterId: null });
  const kind = scenePageKind(medium);
  const { pages, loading } = useScenePages(sceneId, scene?.storyId);
  const [pickerFor, setPickerFor] = useState<'add' | string | null>(null);

  useEffect(() => {
    let alive = true;
    void createSceneService(db)
      .getById(sceneId)
      .then((row) => {
        if (alive) setScene(row && !row.isDeleted ? row : null);
      })
      .catch(() => {
        if (alive) setScene(null);
      });
    return () => {
      alive = false;
    };
  }, [db, sceneId]);

  const service = createScenePageService(db);
  const attempt = useCallback(
    async (work: () => Promise<unknown>, logLabel: string) => {
      try {
        await work();
      } catch (error) {
        console.log(`ScenePagesScreen: failed to ${logLabel}.`, error);
        showNotification(t('scene_pages_save_failed'), 'error');
      }
    },
    [showNotification, t],
  );

  const addLabel = t(`scene_pages_add_${kind}`);
  useScreenHeader({
    target: 'parent',
    title: t(kind === 'frame' ? 'scene_frames' : 'scene_pages'),
    actions: [
      {
        id: 'add-page',
        icon: 'add',
        label: addLabel,
        onPress: () => setPickerFor('add'),
        visible: !!canEdit && !!scene,
      },
    ],
  });

  if (scene === undefined || loading) return <ScreenLoading padded message={t('loading')} />;
  if (scene === null) {
    return (
      <ScreenError padded message={t('scene_not_found')} onGoBack={() => navigation.goBack()} />
    );
  }

  const container = getCommonContainerStyles(colors).container;

  const pickMedia = (media: ScenePageMedia) => {
    const target = pickerFor;
    setPickerFor(null);
    if (!userId || !target) return;
    void attempt(
      () =>
        target === 'add'
          ? service.createPage(userId, { storyId: scene.storyId, sceneId, media })
          : service.replaceMedia(userId, target, media),
      target === 'add' ? 'add a page' : 'replace the image of a page',
    );
  };

  return (
    <KeyboardAwareScreen
      style={container}
      contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
    >
      <Text style={[styles.sceneName, { color: colors.text }]}>{scene.name}</Text>
      <Text style={[styles.notice, { color: colors.textSecondary }]}>
        {t('scene_pages_notice')}
      </Text>
      {pages.length === 0 ? (
        <Text style={[styles.empty, { color: colors.textSecondary }]}>
          {t(`scene_pages_empty_${kind}`)}
        </Text>
      ) : null}
      {pages.map((view, index) => (
        <ScenePageCard
          key={view.page.id}
          view={view}
          label={t(`scene_pages_label_${kind}`, { index: index + 1 })}
          isFirst={index === 0}
          isLast={index === pages.length - 1}
          canEdit={!!canEdit}
          onTextCommit={(text) =>
            userId && void attempt(() => service.updatePage(userId, view.page.id, { text }), 'edit')
          }
          onFitChange={(fit: ScenePageFit) =>
            userId && void attempt(() => service.updatePage(userId, view.page.id, { fit }), 'edit')
          }
          onMove={(delta) =>
            userId &&
            void attempt(() => service.movePage(userId, view.page.id, index + delta), 'move')
          }
          onReplace={() => setPickerFor(view.page.id)}
          onDelete={() =>
            confirmDelete({
              titleKey: 'scene_pages_delete_title',
              messageKey: 'scene_pages_delete_message',
              onConfirm: async () => {
                if (userId) await service.deletePage(userId, view.page.id);
              },
              failureKey: 'scene_pages_save_failed',
            })
          }
        />
      ))}
      {canEdit ? (
        <View style={styles.add}>
          <Button onPress={() => setPickerFor('add')}>{addLabel}</Button>
        </View>
      ) : null}
      <ScenePageMediaPicker
        visible={pickerFor !== null}
        storyId={scene.storyId}
        onClose={() => setPickerFor(null)}
        onPick={pickMedia}
      />
    </KeyboardAwareScreen>
  );
};

const styles = StyleSheet.create({
  sceneName: { fontSize: 20, fontWeight: 'bold', marginBottom: 6 },
  notice: { fontSize: 13, lineHeight: 18, marginBottom: 14 },
  empty: { marginVertical: 24, textAlign: 'center' },
  add: { marginTop: 4 },
});

export default ScenePagesScreen;
