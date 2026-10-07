import type { SceneMusicRole } from '@keres/shared';
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
import SceneMusicCard from '@/src/components/features/scenes/SceneMusic/SceneMusicCard';
import SceneMusicTargetPicker from '@/src/components/features/scenes/SceneMusic/SceneMusicTargetPicker';
import KeyboardAwareScreen from '@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import { useDrizzle } from '@/src/db';
import type { SceneSelect } from '@/src/db/schema';
import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import { useConfirmDelete } from '@/src/hooks/useConfirmDelete';
import { useFormScrollBottomPadding } from '@/src/hooks/useFormScrollBottomPadding';
import { useSceneArcMedium } from '@/src/hooks/useSceneArcMedium';
import { useSceneMusic } from '@/src/hooks/useSceneMusic';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { useStoryRole } from '@/src/hooks/useStoryRole';
import type { NarrativeElementsStackParamList } from '@/src/navigation/MainSystemStack';
import {
  createSceneMusicService,
  type SceneMusicTarget,
} from '@/src/services/storymanagement/SceneMusicService';
import { createSceneService } from '@/src/services/storymanagement/SceneService';
import { useNotificationStore } from '@/src/state/notificationStore';
import { useUserSettingsStore } from '@/src/state/userSettingsStore';
import { useTheme } from '@/src/theme';
import { getCommonContainerStyles } from '@/src/theme/commonStyles';
import { sceneMusicWordKey } from '@/src/utils/sceneMusicWords';

type RouteProps = RouteProp<NarrativeElementsStackParamList, 'SceneMusic'>;

/**
 * The music of one scene: each piece points at an audio file or a link of the Gallery, says whether
 * the people in the story hear it, and notes when it comes in. The order is the order of the list.
 */
const SceneMusicScreen = () => {
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
  const { views, loading } = useSceneMusic(sceneId, scene?.storyId);
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

  const service = createSceneMusicService(db);
  const attempt = useCallback(
    async (work: () => Promise<unknown>, logLabel: string) => {
      try {
        await work();
      } catch (error) {
        console.log(`SceneMusicScreen: failed to ${logLabel}.`, error);
        showNotification(t('scene_music_save_failed'), 'error');
      }
    },
    [showNotification, t],
  );

  const wordKey = sceneMusicWordKey(medium);
  useScreenHeader({
    target: 'parent',
    title: t(wordKey),
    actions: [
      {
        id: 'add-music',
        icon: 'add',
        label: t('scene_music_add'),
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

  const pickTarget = (target: SceneMusicTarget) => {
    const picked = pickerFor;
    setPickerFor(null);
    if (!userId || !picked) return;
    void attempt(
      () =>
        picked === 'add'
          ? service.addMusic(userId, { storyId: scene.storyId, sceneId, target })
          : service.retarget(userId, picked, target),
      picked === 'add' ? 'add music' : 'point music at something else',
    );
  };

  return (
    <KeyboardAwareScreen
      style={container}
      contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
    >
      <Text style={[styles.sceneName, { color: colors.text }]}>{scene.name}</Text>
      <Text style={[styles.notice, { color: colors.textSecondary }]}>
        {t('scene_music_notice')}
      </Text>
      {views.length === 0 ? (
        <Text style={[styles.empty, { color: colors.textSecondary }]}>
          {t('scene_music_empty')}
        </Text>
      ) : null}
      {views.map((view, index) => (
        <SceneMusicCard
          key={view.music.id}
          view={view}
          isFirst={index === 0}
          isLast={index === views.length - 1}
          canEdit={!!canEdit}
          onCueCommit={(cue) =>
            userId &&
            void attempt(() => service.updateMusic(userId, view.music.id, { cue }), 'edit the cue')
          }
          onRoleChange={(role: SceneMusicRole) =>
            userId &&
            void attempt(
              () => service.updateMusic(userId, view.music.id, { role }),
              'edit the role',
            )
          }
          onMove={(delta) =>
            userId &&
            void attempt(() => service.moveMusic(userId, view.music.id, index + delta), 'move')
          }
          onReplace={() => setPickerFor(view.music.id)}
          onDelete={() =>
            confirmDelete({
              titleKey: 'scene_music_delete_title',
              messageKey: 'scene_music_delete_message',
              onConfirm: async () => {
                if (userId) await service.deleteMusic(userId, view.music.id);
              },
              failureKey: 'scene_music_save_failed',
            })
          }
        />
      ))}
      {canEdit ? (
        <View style={styles.add}>
          <Button onPress={() => setPickerFor('add')}>{t('scene_music_add')}</Button>
        </View>
      ) : null}
      <SceneMusicTargetPicker
        visible={pickerFor !== null}
        storyId={scene.storyId}
        onClose={() => setPickerFor(null)}
        onPick={pickTarget}
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

export default SceneMusicScreen;
