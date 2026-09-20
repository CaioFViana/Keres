import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import Button from '../../../components/common/controls/Button/Button';
import CommentThreadModal from '../../../components/features/comments/CommentThreadModal/CommentThreadModal';
import { MarkdownPreview } from '../../../components/features/manuscript/MarkdownPreview/MarkdownPreview';
import { manuscriptTextMetrics } from '../../../components/features/manuscript/manuscriptTextMetrics';
import { SceneBodyEditor } from '../../../components/features/manuscript/SceneBodyEditor/SceneBodyEditor';
import type { SceneSelect } from '../../../db/schema';
import { useDrizzle } from '../../../db';
import { useBackButtonHandler } from '../../../hooks/useBackButtonHandler';
import { useEntityComments } from '../../../hooks/useEntityComments';
import {
  useEntityEventSubscriptions,
  useEntityInitialLoad,
} from '../../../hooks/useEntityRefreshLifecycle';
import { useSceneBodyDraft } from '../../../hooks/useSceneBodyDraft';
import { useScreenHeader } from '../../../hooks/useScreenHeader';
import { useStoryRole } from '../../../hooks/useStoryRole';
import type { NarrativeElementsStackParamList } from '../../../navigation/MainSystemStack';
import { SCENE_BODY_DRAFT_FIELD } from '../../../services/EditorDraftService';
import {
  createSceneService,
  type SceneService,
} from '../../../services/storymanagement/SceneService';
import { useStoryStore } from '../../../state/storyStore';
import { useUserSettingsStore } from '../../../state/userSettingsStore';
import { useTheme } from '../../../theme';
import { AppAlert } from '../../../utils/AppAlert';
import { useVocabularyEntityCopy } from '../../../vocabulary/useVocabularyEntityCopy';

type SceneEditorScreenRouteProp = RouteProp<NarrativeElementsStackParamList, 'SceneEditor'>;
type SceneEditorNavigation = NativeStackNavigationProp<NarrativeElementsStackParamList, 'SceneEditor'>;
type EditorMode = 'write' | 'read' | 'review';

const MODES: EditorMode[] = ['write', 'read', 'review'];

function ModeToggle({ mode, onChange }: { mode: EditorMode; onChange(mode: EditorMode): void }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
        pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
        pillActive: { backgroundColor: colors.primaryContainer },
        label: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
        labelActive: { color: colors.onPrimaryContainer },
      }),
    [colors],
  );
  return (
    <View style={styles.row}>
      {MODES.map((candidate) => {
        const active = candidate === mode;
        return (
          <TouchableOpacity
            key={candidate}
            testID={`editor-mode-${candidate}`}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.pill, active && styles.pillActive]}
            onPress={() => onChange(candidate)}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {t(`manuscript_mode_${candidate}`)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function SceneEditorContent({
  scene,
  persist,
}: {
  scene: SceneSelect;
  persist(body: string | null): Promise<void>;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [mode, setMode] = useState<EditorMode>('write');
  const [commentsOpen, setCommentsOpen] = useState(false);
  const { canEdit } = useStoryRole(scene.storyId);
  const {
    commentsByField,
    canComment,
    isStoryOwner,
    currentUserId,
    addComment,
    deleteComment,
    updateComment,
  } = useEntityComments(scene.storyId, 'Scene', scene.id);
  const bodyComments = commentsByField[SCENE_BODY_DRAFT_FIELD] ?? [];

  const {
    text,
    setText,
    wordCount,
    charCount,
    maxLength,
    isDirty,
    overLimit,
    canSave,
    save,
    saving,
    saveError,
    draftRestored,
  } = useSceneBodyDraft({
    storyId: scene.storyId,
    sceneId: scene.id,
    savedBody: scene.body,
    baseUpdatedAt: scene.updatedAt.toISOString(),
    enabled: true,
    persist,
  });

  useEffect(() => {
    if (saveError) AppAlert.alert(t('error'), saveError);
  }, [saveError, t]);

  // Escrever/Ler share one scroll container and restore the offset on switch, so the
  // passage stays exactly where it was instead of jumping back to the top.
  const scrollRef = useRef<ScrollView | null>(null);
  const offsetRef = useRef(0);
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: offsetRef.current, animated: false });
  }, [mode]);

  const renderHeaderActions = useCallback(
    () => <ModeToggle mode={mode} onChange={setMode} />,
    [mode],
  );
  useScreenHeader({ target: 'parent', title: scene.name, renderActions: renderHeaderActions });

  const handleAddComment = useCallback(
    (input: { commentText: string; excerptText: string | null; criticality: number }) =>
      addComment({ fieldKey: SCENE_BODY_DRAFT_FIELD }, { ...input, contentSnapshot: text }),
    [addComment, text],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.surface },
        readContainer: {
          paddingHorizontal: manuscriptTextMetrics.containerPaddingHorizontal,
          paddingVertical: manuscriptTextMetrics.containerPaddingVertical,
        },
        reviewBar: {
          paddingHorizontal: manuscriptTextMetrics.containerPaddingHorizontal,
          paddingBottom: manuscriptTextMetrics.containerPaddingVertical,
        },
      }),
    [colors],
  );

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        onScroll={(event) => {
          offsetRef.current = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
      >
        {mode === 'write' ? (
          <SceneBodyEditor
            testID="scene-body-editor"
            value={text}
            onChangeText={setText}
            wordCount={wordCount}
            charCount={charCount}
            maxLength={maxLength}
            overLimit={overLimit}
            canSave={canSave && canEdit}
            saving={saving}
            hasUnsavedChanges={isDirty || draftRestored}
            onSave={() => void save()}
            editable={canEdit}
          />
        ) : (
          <View style={styles.readContainer}>
            <MarkdownPreview text={text} />
          </View>
        )}
        {mode === 'review' && (
          <View style={styles.reviewBar}>
            <Button onPress={() => setCommentsOpen(true)} testID="scene-body-comments">
              {t('manuscript_comments_button', { count: bodyComments.length })}
            </Button>
          </View>
        )}
      </ScrollView>
      <CommentThreadModal
        visible={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        storyId={scene.storyId}
        fieldLabel={t('manuscript_prose')}
        fieldValueSnapshot={text}
        comments={bodyComments}
        canComment={canComment}
        isStoryOwner={isStoryOwner}
        currentUserId={currentUserId}
        onSubmit={handleAddComment}
        onDelete={deleteComment}
        onUpdate={updateComment}
      />
    </View>
  );
}

const SceneEditorScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const navigation = useNavigation<SceneEditorNavigation>();
  const route = useRoute<SceneEditorScreenRouteProp>();
  const { sceneId } = route.params;
  const { t } = useTranslation();
  const copy = useVocabularyEntityCopy('Scene');
  const { selectedStory } = useStoryStore();
  const { userId } = useUserSettingsStore();
  const drizzleDb = useDrizzle();
  const sceneServiceRef = useRef<SceneService | null>(null);

  useEffect(() => {
    if (drizzleDb) sceneServiceRef.current ??= createSceneService(drizzleDb);
  }, [drizzleDb]);

  const [scene, setScene] = useState<SceneSelect | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScene = useCallback(async () => {
    if (!sceneServiceRef.current) return;
    try {
      setLoading(true);
      const fetched = await sceneServiceRef.current.getById(sceneId);
      if (fetched && !fetched.isDeleted) {
        setScene(fetched);
      } else if (fetched?.isDeleted) {
        navigation.goBack();
      } else {
        setError(copy.notFound);
      }
    } catch (err) {
      console.error('Failed to fetch scene for the editor:', err);
      setError(copy.failedToLoad);
    } finally {
      setLoading(false);
    }
  }, [sceneId, navigation, copy]);

  const handleSceneChange = useCallback(
    async (_storyId: string, changedSceneId: string) => {
      if (changedSceneId !== sceneId || !sceneServiceRef.current) return;
      const updated = await sceneServiceRef.current.getById(sceneId);
      if (!updated || updated.isDeleted) {
        navigation.goBack();
      } else {
        setScene(updated);
      }
    },
    [sceneId, navigation],
  );

  useEntityInitialLoad(fetchScene);
  useEntityEventSubscriptions(
    useMemo(
      () => [{ event: 'scene_changed', listener: handleSceneChange }],
      [handleSceneChange],
    ),
  );

  const persist = useCallback(
    async (body: string | null) => {
      if (!sceneServiceRef.current) throw new Error(copy.failedToSave);
      if (!userId) throw new Error(t('user_not_identified'));
      const updated = await sceneServiceRef.current.updateScene(userId, sceneId, { body });
      setScene(updated);
    },
    [sceneId, userId, copy, t],
  );

  // No header here: the loaded content below owns the title and the mode toggle.
  // During the brief load the parent keeps the previous title (usually this same scene).
  if (loading) {
    return <ScreenLoading padded message={copy.loadingDetails} />;
  }
  if (error || !scene) {
    return <ScreenError padded message={error ?? copy.dataMissing} onGoBack={() => navigation.goBack()} />;
  }
  if (selectedStory?.id && scene.storyId !== selectedStory.id) {
    return <ScreenError padded message={copy.notFound} onGoBack={() => navigation.goBack()} />;
  }
  return <SceneEditorContent key={scene.id} scene={scene} persist={persist} />;
};

export default SceneEditorScreen;
