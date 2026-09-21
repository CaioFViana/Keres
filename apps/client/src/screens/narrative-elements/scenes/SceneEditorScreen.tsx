import { Ionicons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import Button from '../../../components/common/controls/Button/Button';
import CommentThreadModal from '../../../components/features/comments/CommentThreadModal/CommentThreadModal';
import type { ManuscriptMark } from '@keres/shared';
import { MarkdownPreview } from '../../../components/features/manuscript/MarkdownPreview/MarkdownPreview';
import { manuscriptTextMetrics } from '../../../components/features/manuscript/manuscriptTextMetrics';
import { RichBodyEditor } from '../../../components/features/manuscript/RichBodyEditor/RichBodyEditor';
import { SceneBodyFooter } from '../../../components/features/manuscript/SceneBodyFooter/SceneBodyFooter';
import { SceneBodyToolbar } from '../../../components/features/manuscript/SceneBodyToolbar/SceneBodyToolbar';
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

const MODES: {
  mode: EditorMode;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
}[] = [
  { mode: 'write', icon: 'pencil-outline', activeIcon: 'pencil' },
  { mode: 'read', icon: 'book-outline', activeIcon: 'book' },
  { mode: 'review', icon: 'chatbubbles-outline', activeIcon: 'chatbubbles' },
];

/** Mode switch following the header-actions standard: icon buttons, primary when active. */
function ModeToggle({ mode, onChange }: { mode: EditorMode; onChange(mode: EditorMode): void }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={{ flexDirection: 'row', marginRight: 12, gap: 14 }}>
      {MODES.map((candidate) => {
        const active = candidate.mode === mode;
        return (
          <TouchableOpacity
            key={candidate.mode}
            testID={`editor-mode-${candidate.mode}`}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t(`manuscript_mode_${candidate.mode}`)}
            onPress={() => onChange(candidate.mode)}
          >
            <Ionicons
              name={active ? candidate.activeIcon : candidate.icon}
              size={24}
              color={active ? colors.primary : colors.text}
            />
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
    editorRef,
    initialHtml,
    onHtmlChange,
    onMarksChange,
    serializedBody,
    applyFormat,
    activeMarks,
    wordCount,
    charCount,
    sizeStatus,
    maxLength,
    isDirty,
    overLimit,
    canSave,
    save,
    saving,
    saveError,
    draftRestored,
    restoreSettled,
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
  const handleToolbarAction = useCallback(
    (kind: ManuscriptMark) => {
      applyFormat(kind);
      // A real editor keeps the caret: reassert input focus so typing
      // continues in the toggled style with the keyboard up.
      editorRef.current?.focus();
    },
    [applyFormat, editorRef],
  );
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
      addComment(
        { fieldKey: SCENE_BODY_DRAFT_FIELD },
        { ...input, contentSnapshot: serializedBody },
      ),
    [addComment, serializedBody],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.surface },
        scroller: { flex: 1 },
        scrollerContent: { flexGrow: 1 },
        editorPlaceholder: { flex: 1, backgroundColor: colors.surface },
        readContainer: {
          flex: 1,
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
      {mode === 'write' && (
        <SceneBodyToolbar
          testID="scene-body-toolbar"
          onAction={handleToolbarAction}
          disabled={!canEdit || saving}
          active={{
            bold: activeMarks.includes('bold'),
            italic: activeMarks.includes('italic'),
            underline: activeMarks.includes('underline'),
            strikethrough: activeMarks.includes('strikethrough'),
          }}
        />
      )}
      <ScrollView
        ref={scrollRef}
        style={styles.scroller}
        contentContainerStyle={styles.scrollerContent}
        onScroll={(event) => {
          offsetRef.current = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
      >
        {mode === 'write' ? (
          // The editor mounts only after the draft restore settles so the
          // seed already carries restored prose: pushing it into a mounted
          // editor races the host's asynchronous seed application, which lands
          // last on web and wipes both the visual and the doc. The placeholder
          // holds the layout for the (millisecond) wait.
          restoreSettled ? (
            <RichBodyEditor
              testID="scene-body-editor"
              defaultHtml={initialHtml}
              onHtmlChange={onHtmlChange}
              onMarksChange={onMarksChange}
              editable={canEdit && !saving}
              canEdit={canEdit}
              inputRef={editorRef}
            />
          ) : (
            <View style={styles.editorPlaceholder} testID="scene-body-editor-loading" />
          )
        ) : (
          <View style={styles.readContainer}>
            <MarkdownPreview text={serializedBody} />
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
      {mode === 'write' && (
        <SceneBodyFooter
          testID="scene-body-footer"
          wordCount={wordCount}
          charCount={charCount}
          sizeStatus={sizeStatus}
          maxLength={maxLength}
          overLimit={overLimit}
          canSave={canSave && canEdit}
          saving={saving}
          hasUnsavedChanges={isDirty || draftRestored}
          onSave={() => void save()}
        />
      )}
      <CommentThreadModal
        visible={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        storyId={scene.storyId}
        fieldLabel={t('manuscript_prose')}
        fieldValueSnapshot={serializedBody}
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
