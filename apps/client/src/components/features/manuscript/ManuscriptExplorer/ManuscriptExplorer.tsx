import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { readCopiedPassage } from '../../../../hooks/useCopiedPassage';
import { useWebSelectionClip } from '../../../../hooks/useWebSelectionClip';
import { useSceneBodyComments } from '../../../../hooks/useSceneBodyComments';
import { useStoryNavigatorData } from '../../../../hooks/useStoryNavigatorData';
import { useStorySimulation } from '../../../../hooks/useStorySimulation';
import type { NarrativeElementsStackParamList } from '../../../../navigation/MainSystemStack';
import Button from '../../../common/controls/Button/Button';
import { ScreenLoading } from '../../../common/feedback/ScreenState/ScreenState';
import FormField from '../../../common/forms/FormField/FormField';
import { SingleSelectPill } from '../../../common/inputs/MultiSelectPill/MultiSelectPill';
import NavigatorScenePanel from '../../routes/NavigatorScenePanel';
import { ManuscriptReviewTools } from '../ManuscriptReviewTools/ManuscriptReviewTools';

type Navigation = NativeStackNavigationProp<NarrativeElementsStackParamList, 'Manuscript'>;

/**
 * The manuscript of a branching story read the way the Story Navigator walks it: one scene at a
 * time, its choices gated by the items and triggers picked up so far. A route reads one path from
 * start to end; this is for exploring the whole tree.
 */
export default function ManuscriptExplorer({
  storyId,
  review = false,
}: {
  storyId: string;
  /** Review mode: the scene's comments are marked in its text and can be read and added. */
  review?: boolean;
}) {
  const { t } = useTranslation();
  const navigation = useNavigation<Navigation>();
  const { loading, ...data } = useStoryNavigatorData(storyId);
  const simulation = useStorySimulation(data);
  const scene = simulation.current;
  const sceneIds = useMemo(() => (scene ? [scene.id] : []), [scene]);
  const {
    commentsBySceneId,
    canComment,
    isStoryOwner,
    currentUserId,
    addComment,
    updateComment,
    deleteComment,
  } = useSceneBodyComments(storyId, sceneIds);
  const sceneComments = useMemo(
    () => (scene ? (commentsBySceneId[scene.id] ?? []) : []),
    [scene, commentsBySceneId],
  );
  const excerpts = useMemo(
    () => sceneComments.flatMap((comment) => (comment.excerptText ? [comment.excerptText] : [])),
    [sceneComments],
  );
  // The thread of the scene on screen; a passage copied on a phone is offered as its quote.
  // On the web the selection is read from the DOM: the scene's text registers as the field to clip.
  const selectionKey = `explore-${scene?.id ?? ''}`;
  const { containerRef } = useWebSelectionClip(selectionKey);
  const [threadOpen, setThreadOpen] = useState(false);
  const [passage, setPassage] = useState<string | null>(null);
  const openThread = useCallback(async () => {
    if (Platform.OS !== 'web') setPassage(await readCopiedPassage(scene?.body));
    setThreadOpen(true);
  }, [scene]);
  const closeThread = useCallback(() => {
    setThreadOpen(false);
    setPassage(null);
  }, []);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        flex: { flex: 1 },
        content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 30 },
        restart: { marginTop: 20 },
      }),
    [],
  );

  if (loading) return <ScreenLoading padded message={t('loading_story_navigator')} />;
  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        <FormField label={t('navigator_start_scene')}>
          <SingleSelectPill
            options={data.scenes.map((scene) => ({ value: scene.id, label: scene.name }))}
            value={simulation.startSceneId}
            onValueChange={simulation.start}
            placeholder={t('route_select_start_scene')}
          />
        </FormField>
        <NavigatorScenePanel
          simulation={simulation}
          content="body"
          dense
          commentExcerpts={review ? excerpts : undefined}
          onCommentPress={review ? openThread : undefined}
          bodyRef={review ? containerRef : undefined}
          onOpenScene={(sceneId) => navigation.navigate('SceneDetail', { sceneId })}
        />
        <Button onPress={() => simulation.reset()} style={styles.restart}>
          {t('navigator_restart')}
        </Button>
      </ScrollView>
      {review && scene && (
        <ManuscriptReviewTools
          bar={{ sceneLabel: scene.name, count: sceneComments.length }}
          onBarPress={openThread}
          thread={
            threadOpen
              ? {
                  key: selectionKey,
                  sceneId: scene.id,
                  label: scene.name,
                  snapshot: scene.body ?? '',
                  comments: sceneComments,
                  excerpt: passage,
                }
              : null
          }
          onCloseThread={closeThread}
          storyId={storyId}
          canComment={canComment}
          isStoryOwner={isStoryOwner}
          currentUserId={currentUserId}
          onSubmitThread={(input) =>
            addComment(scene.id, { ...input, contentSnapshot: scene.body })
          }
          onDeleteThread={deleteComment}
          onUpdateThread={updateComment}
          testID="manuscript-explorer-review-tools"
        />
      )}
    </View>
  );
}
