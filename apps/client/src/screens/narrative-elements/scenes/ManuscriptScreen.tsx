import { Ionicons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewToken,
} from 'react-native';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import type { ManuscriptSection, TextRange } from '@keres/shared';
import {
  compileLinearManuscript,
  compileRouteManuscript,
  findFirstExcerptMatch,
  isLooseScene,
  linearManuscriptSections,
  routeManuscriptSections,
} from '@keres/shared';
import MarkedText from '../../../components/common/display/MarkedText/MarkedText';
import { SingleSelectPill } from '../../../components/common/inputs/MultiSelectPill/MultiSelectPill';
import { MarkdownPreview } from '../../../components/features/manuscript/MarkdownPreview/MarkdownPreview';
import { ManuscriptReviewTools } from '../../../components/features/manuscript/ManuscriptReviewTools/ManuscriptReviewTools';
import { ManuscriptSearchToolbar } from '../../../components/features/manuscript/ManuscriptSearchToolbar/ManuscriptSearchToolbar';
import ManuscriptExportModal, {
  type ManuscriptExportChoices,
} from '../../../components/features/manuscript/ManuscriptExportModal/ManuscriptExportModal';
import ManuscriptIndexModal from '../../../components/features/manuscript/ManuscriptIndexModal/ManuscriptIndexModal';
import { exportManuscript } from '../../../components/features/manuscript/export/manuscriptExport';
import { exportFileLanguage } from '../../../utils/storyTransfer';
import { manuscriptTextMetrics } from '../../../components/features/manuscript/manuscriptTextMetrics';
import { useScreenAnchor } from '../../../guides/useGuideAnchor';
import { useScreenTour } from '../../../guides/useScreenTour';
import { useAsyncOperation } from '../../../hooks/useAsyncOperation';
import { useBackButtonHandler } from '../../../hooks/useBackButtonHandler';
import { useManuscriptData } from '../../../hooks/useManuscriptData';
import { useScreenHeader } from '../../../hooks/useScreenHeader';
import { useStoryArcs } from '../../../hooks/useStoryArcs';
import type { NarrativeElementsStackParamList } from '../../../navigation/MainSystemStack';
import { useNotificationStore } from '../../../state/notificationStore';
import { useStoryStore } from '../../../state/storyStore';
import { useTheme } from '../../../theme';
import { chapterBelongsToArc, sceneBelongsToActiveArc } from '../../../utils/storyArcFilter';
import {
  manuscriptModeHeaderActions,
  useManuscriptReview,
  type ManuscriptReviewMode,
} from './useManuscriptReview';
import { useManuscriptSearch } from './useManuscriptSearch';

type ManuscriptScreenRouteProp = RouteProp<NarrativeElementsStackParamList, 'Manuscript'>;
type ManuscriptNavigation = NativeStackNavigationProp<
  NarrativeElementsStackParamList,
  'Manuscript'
>;

// A scene counts as the reader's position while it holds a fifth of the viewport;
// fully visible rows always count (the list's own rule), so short scenes never drop
// out. The old half-of-the-item rule never fired for multi-page scenes, pinning the
// position on the last short scene scrolled past.
const MANUSCRIPT_VIEWABILITY = { viewAreaCoveragePercentThreshold: 20 };
// Shared empty ranges for unmarked titles; module scope keeps the reference stable.
const NO_RANGES: TextRange[] = [];
const NO_ACTIVE: TextRange[] = [];

const ManuscriptScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  useScreenTour('Manuscript');
  const searchAnchorRef = useScreenAnchor('Manuscript', 'search');
  const listAnchorRef = useScreenAnchor('Manuscript', 'list');
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<ManuscriptNavigation>();
  const route = useRoute<ManuscriptScreenRouteProp>();
  const { selectedStory } = useStoryStore();
  const activeArcId = useStoryStore((state) => state.activeArcId);
  const { arcs } = useStoryArcs();
  const { showNotification } = useNotificationStore();
  const { pending: exporting, run: runExport } = useAsyncOperation();

  const storyId = selectedStory?.id;
  const isBranching = selectedStory?.type === 'branching';
  const { chapters, scenes, routes, choices, stepsByRouteId, loading, loadChoiceAnnotations } =
    useManuscriptData(storyId ?? null);

  const [routeId, setRouteId] = useState<string | null>(route.params?.routeId ?? null);
  const effectiveRouteId = routeId ?? routes[0]?.id ?? null;
  const [mode, setMode] = useState<ManuscriptReviewMode>('read');
  const [exportVisible, setExportVisible] = useState(false);
  const [indexVisible, setIndexVisible] = useState(false);
  const [currentSectionIndex, setCurrentSectionIndex] = useState<number | null>(null);

  // Arc filtering, like every other screen: containers outside the active arc hide with
  // their scenes; unchaptered and orphan scenes stay visible. The linear path filters
  // inside the shared sections builder; routes have no arc of their own, so the
  // branching path drops other-arc scenes and their steps vanish with them.
  const chaptersById = useMemo(
    () => new Map(chapters.map((chapter) => [chapter.id, chapter])),
    [chapters],
  );
  const visibleScenes = useMemo(
    () => scenes.filter((scene) => sceneBelongsToActiveArc(scene, chaptersById, activeArcId)),
    [scenes, chaptersById, activeArcId],
  );

  // Reading order per story shape: branching follows one route's steps in position order
  // (empty until a route exists), linear stacks chapters, events, then the homeless tail.
  // The deep-linked routeId is only the initial pick - afterwards the pill owns it, and an
  // unset pick falls back to the first route.
  const allSections: ManuscriptSection[] = useMemo(() => {
    if (isBranching) {
      if (!effectiveRouteId) return [];
      return routeManuscriptSections(stepsByRouteId.get(effectiveRouteId) ?? [], visibleScenes);
    }
    return linearManuscriptSections(chapters, scenes, { arcId: activeArcId });
  }, [isBranching, effectiveRouteId, stepsByRouteId, chapters, scenes, visibleScenes, activeArcId]);

  const {
    sections,
    excerptsBySceneId,
    commentCountsBySceneId,
    canComment,
    isStoryOwner,
    currentUserId,
    updateComment,
    deleteComment,
    openThread,
    closeThread,
    rowRefFor,
    bar,
    thread,
    openBarThread,
    submitThread,
  } = useManuscriptReview(storyId, allSections, mode, currentSectionIndex);

  const listRef = useRef<FlatList<ManuscriptSection> | null>(null);
  // The one indexed jump: search matches and index picks share it, so the target also
  // becomes the reader's position for the index highlight.
  const scrollToSectionIndex = useCallback((index: number) => {
    setCurrentSectionIndex(index);
    listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.1 });
  }, []);
  const {
    query,
    setQuery,
    ordinal,
    total,
    activeMatch,
    titleMarksByKey,
    jumpToOrdinal,
    viewportRef,
    handleListScroll,
    scrollActiveIntoView,
  } = useManuscriptSearch(sections, listRef, scrollToSectionIndex);
  // The guide anchor owns the list view's ref prop; this stable callback feeds both the
  // tour and the search viewport without re-registering on every render.
  const setListViewportRef = useCallback(
    (node: unknown) => {
      listAnchorRef(node);
      viewportRef.current = node as View | null;
    },
    [listAnchorRef, viewportRef],
  );
  // Unmeasured rows cannot be jumped to directly: scroll to the estimated
  // offset first so the row measures, then retry the indexed jump on the next tick.
  const handleScrollToIndexFailed = useCallback(
    (info: { index: number; averageItemLength: number }) => {
      listRef.current?.scrollToOffset({
        offset: info.averageItemLength * info.index,
        animated: false,
      });
      setTimeout(() => {
        listRef.current?.scrollToIndex({ index: info.index, animated: false });
      }, 100);
    },
    [],
  );
  // The reader's position follows the topmost visible scene; container headings are
  // landmarks, not reading, so they never take the highlight. FlatList forbids swapping
  // this callback between renders (web throws an invariant), so its identity is frozen
  // and the latest sections arrive through a ref: arc switches rebuild `sections`
  // (mode toggles never do) but must never swap the callback.
  const sectionsRef = useRef(sections);
  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);
  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const current = sectionsRef.current;
      const firstScene = viewableItems
        .filter((item) => item.index != null && current[item.index]?.kind === 'scene')
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))[0];
      if (firstScene?.index != null) setCurrentSectionIndex(firstScene.index);
    },
    [],
  );
  // An index pick closes the modal and jumps the list to that scene.
  const handleIndexSelect = useCallback(
    (sectionIndex: number) => {
      setIndexVisible(false);
      scrollToSectionIndex(sectionIndex);
    },
    [scrollToSectionIndex],
  );

  const looseCount = useMemo(() => {
    if (isBranching) return 0;
    // The count follows the visible manuscript: other-arc containers are gone, and
    // their scenes went with them, so nothing hidden leaks into the loose switch.
    const visibleById = new Map(
      chapters
        .filter((chapter) => chapterBelongsToArc(chapter, activeArcId))
        .map((chapter) => [chapter.id, chapter]),
    );
    return visibleScenes.filter((scene) => !scene.isDeleted && isLooseScene(scene, visibleById))
      .length;
  }, [isBranching, chapters, visibleScenes, activeArcId]);

  const exportRouteName = isBranching
    ? (routes.find((entry) => entry.id === effectiveRouteId)?.name ?? null)
    : null;

  // Export pipeline: compile the in-memory read model into format-neutral blocks, then
  // hand the manuscript to the shared delivery path (share sheet, or a browser download on
  // web). A delivered file notifies success; a build with no share target reports where the
  // file is instead of claiming success; anything thrown notifies failure.
  const runExportChoices = useCallback(
    ({
      format,
      includeSceneNames,
      includeLooseScenes,
      resetSceneNumbers,
      includeIndex,
      arcId: exportArcId,
    }: ManuscriptExportChoices) => {
      void runExport(async () => {
        try {
          const labels = {
            goToPage: t('export_manuscript_go_to_page'),
            goToScene: t('export_manuscript_go_to_scene'),
            tocHeading: t('export_manuscript_index_heading'),
          };
          // A specific arc exports as its own book: the arc title replaces the story
          // title on the cover and in the file name, and only its scenes ship. The
          // export arc is the modal's own pick, independent of the reading filter.
          const exportArc = exportArcId
            ? (arcs.find((arc) => arc.id === exportArcId) ?? null)
            : null;
          const exportTitle = exportArc?.title ?? selectedStory?.title ?? '';
          const exportScenes = exportArcId
            ? scenes.filter((scene) => sceneBelongsToActiveArc(scene, chaptersById, exportArcId))
            : scenes;
          // Check and effect lines resolve here, at export time: reading never pays for them.
          const annotations = await loadChoiceAnnotations(t);
          const annotatedChoices = choices.map((choice) => {
            const lines = annotations.get(choice.id);
            return lines ? { ...choice, ...lines } : choice;
          });
          const manuscript = isBranching
            ? compileRouteManuscript({
                title: exportTitle,
                routeName: exportRouteName ?? '',
                steps: effectiveRouteId ? (stepsByRouteId.get(effectiveRouteId) ?? []) : [],
                scenes: exportScenes,
                choices: annotatedChoices,
                looseHeadingLabel: t('export_manuscript_loose_heading'),
                includeSceneNames,
                resetSceneNumbersPerChapter: resetSceneNumbers,
              })
            : compileLinearManuscript({
                title: exportTitle,
                chapters,
                scenes,
                choices: annotatedChoices,
                includeLooseScenes,
                looseHeadingLabel: t('export_manuscript_loose_heading'),
                includeSceneNames,
                resetSceneNumbersPerChapter: resetSceneNumbers,
                arcId: exportArcId,
              });
          const result = await exportManuscript({
            storyTitle: exportTitle,
            manuscript,
            format,
            labels,
            options: { includeToc: includeIndex },
            language: exportFileLanguage(i18n.language),
          });
          if (result.delivered) {
            showNotification(
              t('export_manuscript_success', { fileName: result.fileName }),
              'success',
            );
          } else {
            showNotification(
              t('export_story_no_share_target', { path: result.uri || result.fileName }),
              'warning',
            );
          }
        } catch (error) {
          console.log('ManuscriptScreen: manuscript export failed.', error);
          showNotification(t('export_manuscript_failed_body'), 'error');
        }
      });
    },
    [
      runExport,
      isBranching,
      selectedStory,
      arcs,
      chaptersById,
      exportRouteName,
      effectiveRouteId,
      stepsByRouteId,
      scenes,
      choices,
      chapters,
      t,
      i18n,
      showNotification,
      loadChoiceAnnotations,
    ],
  );

  // The modal owns format and switches; re-entrant presses while an export runs are ignored.
  const handleExportPress = useCallback(() => {
    if (exporting) return;
    setExportVisible(true);
  }, [exporting]);

  const openScene = useCallback(
    (sceneId: string) => {
      navigation.navigate('SceneDetail', { sceneId });
    },
    [navigation],
  );

  const openSceneEditor = useCallback(
    (sceneId: string) => {
      navigation.navigate('SceneEditor', { sceneId });
    },
    [navigation],
  );

  useScreenHeader({
    target: 'parent',
    title: t('manuscript_title'),
    actions: [
      ...manuscriptModeHeaderActions(t, mode, setMode),
      {
        id: 'export',
        icon: 'share-outline',
        label: t('export_manuscript_title'),
        onPress: handleExportPress,
      },
    ],
  });

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.surface },
        toolbar: {
          paddingHorizontal: manuscriptTextMetrics.containerPaddingHorizontal,
          paddingVertical: 8,
          gap: 8,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        section: {
          paddingHorizontal: manuscriptTextMetrics.containerPaddingHorizontal,
          paddingVertical: 20,
        },
        chapterDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
        sceneDivider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.border,
          marginHorizontal: manuscriptTextMetrics.containerPaddingHorizontal,
          opacity: 0.6,
        },
        containerTitle: { color: colors.text, fontSize: 24, fontWeight: '700' },
        containerEvent: { fontStyle: 'italic' },
        looseTitle: { color: colors.textSecondary, fontSize: 17, fontStyle: 'italic' },
        sceneHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
        sceneTitle: {
          flex: 1,
          color: colors.textSecondary,
          fontSize: 13,
          fontWeight: '700',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        },
        sceneEdit: { padding: 4 },
        emptyText: { color: colors.textSecondary, fontSize: 15, fontStyle: 'italic' },
        emptyWrap: { padding: 24, alignItems: 'center', gap: 12 },
      }),
    [colors],
  );

  const renderSection = useCallback(
    ({ item, index }: { item: ManuscriptSection; index: number }) => {
      if (item.kind === 'container') {
        return (
          <View>
            {index > 0 && <View style={styles.chapterDivider} />}
            <View style={styles.section}>
              <Text
                style={[
                  styles.containerTitle,
                  item.containerType === 'event' && styles.containerEvent,
                ]}
              >
                {item.containerType === 'chapter' ? `${item.index}. ${item.name}` : item.name}
              </Text>
            </View>
          </View>
        );
      }
      if (item.kind === 'loose-heading') {
        return (
          <View>
            <View style={styles.chapterDivider} />
            <View style={styles.section}>
              <Text style={styles.looseTitle}>{t('unchaptered_scenes')}</Text>
            </View>
          </View>
        );
      }
      // Review mode marks the scene's commented passages (title and body share the
      // thread excerpts) and taps open the thread; read mode renders them plain.
      const titleText = `${item.position}. ${item.scene.name}`;
      const sceneExcerpts =
        mode === 'review' ? (excerptsBySceneId[item.scene.id] ?? []) : [];
      const titleCommentRanges = sceneExcerpts.flatMap((excerpt) => {
        const hit = findFirstExcerptMatch(titleText, excerpt);
        return hit ? [hit] : [];
      });
      const openSceneThread = mode === 'review' ? () => openThread(item.scene.id) : undefined;
      return (
        <View ref={rowRefFor(item.key)} collapsable={false}>
          {index > 0 && <View style={styles.sceneDivider} />}
          <View style={styles.section}>
            {mode === 'review' && (
              <View style={styles.sceneHeaderRow}>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => openScene(item.scene.id)}>
                  <MarkedText
                    text={titleText}
                    ranges={titleMarksByKey.ranges.get(item.key) ?? NO_RANGES}
                    activeRanges={titleMarksByKey.active.get(item.key) ?? NO_ACTIVE}
                    commentRanges={titleCommentRanges}
                    onCommentPress={openSceneThread}
                    // The active title hit scrolls like a body hit: the indexed jump
                    // lands the row, the measured scroll lands the hit itself.
                    activeRef={
                      activeMatch?.sectionIndex === index && activeMatch.nameMatchIndex >= 0
                        ? scrollActiveIntoView
                        : undefined
                    }
                    style={styles.sceneTitle}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  testID={`manuscript-edit-${item.scene.id}`}
                  style={styles.sceneEdit}
                  accessibilityRole="button"
                  accessibilityLabel={t('manuscript_open_editor')}
                  onPress={() => openSceneEditor(item.scene.id)}
                >
                  <Ionicons name="pencil-outline" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  testID={`manuscript-comment-${item.scene.id}`}
                  style={styles.sceneEdit}
                  accessibilityRole="button"
                  accessibilityLabel={t('comments_title')}
                  onPress={openSceneThread}
                >
                  <Ionicons name="chatbubble-outline" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            )}
            {item.scene.body ? (
              <MarkdownPreview
                text={item.scene.body}
                highlightQuery={query}
                activeMatchIndex={
                  activeMatch?.sectionIndex === index ? activeMatch.bodyMatchIndex : undefined
                }
                activeTextRef={scrollActiveIntoView}
                commentExcerpts={mode === 'review' ? sceneExcerpts : undefined}
                onCommentPress={openSceneThread}
              />
            ) : (
              <Text style={styles.emptyText}>{t('manuscript_no_body_yet')}</Text>
            )}
          </View>
        </View>
      );
    },
    [
      mode,
      excerptsBySceneId,
      openThread,
      rowRefFor,
      openScene,
      openSceneEditor,
      styles,
      t,
      colors,
      titleMarksByKey,
      query,
      activeMatch,
      scrollActiveIntoView,
    ],
  );

  if (loading) {
    return <ScreenLoading padded message={t('loading')} />;
  }
  if (!storyId) {
    return (
      <ScreenError padded message={t('no_story_selected')} onGoBack={() => navigation.goBack()} />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        {isBranching && (
          <SingleSelectPill
            options={routes.map((entry) => ({ label: entry.name, value: entry.id }))}
            value={effectiveRouteId}
            onValueChange={(value) => {
              setRouteId(value);
            }}
            placeholder={t('manuscript_route')}
          />
        )}
        <ManuscriptSearchToolbar
          query={query}
          onQueryChange={setQuery}
          ordinal={ordinal}
          total={total}
          onPrevMatch={() => jumpToOrdinal(ordinal - 1)}
          onNextMatch={() => jumpToOrdinal(ordinal + 1)}
          onSubmitQuery={() => jumpToOrdinal(ordinal)}
          onOpenIndex={() => setIndexVisible(true)}
          searchAnchorRef={searchAnchorRef}
        />
      </View>
      {isBranching && routes.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>{t('manuscript_no_routes')}</Text>
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>{t('manuscript_no_scenes')}</Text>
        </View>
      ) : (
        <View ref={setListViewportRef} collapsable={false} style={{ flex: 1 }}>
          <FlatList
            ref={listRef}
            testID="manuscript-list"
            data={sections}
            keyExtractor={(item) => item.key}
            renderItem={renderSection}
            viewabilityConfig={MANUSCRIPT_VIEWABILITY}
            onViewableItemsChanged={handleViewableItemsChanged}
            onScrollToIndexFailed={handleScrollToIndexFailed}
            onScroll={handleListScroll}
            scrollEventThrottle={16}
          />
        </View>
      )}
      {mode === 'review' && (
        <ManuscriptReviewTools
          bar={bar}
          onBarPress={openBarThread}
          thread={thread}
          onCloseThread={closeThread}
          storyId={storyId}
          canComment={canComment}
          isStoryOwner={isStoryOwner}
          currentUserId={currentUserId}
          onSubmitThread={submitThread}
          onDeleteThread={deleteComment}
          onUpdateThread={updateComment}
          testID="manuscript-review-tools"
        />
      )}
      <ManuscriptExportModal
        visible={exportVisible}
        routeName={isBranching ? exportRouteName : null}
        showLooseSwitch={!isBranching && looseCount > 0}
        looseCount={looseCount}
        chapterNumberingAvailable={!isBranching}
        arcs={arcs}
        onExport={runExportChoices}
        onClose={() => setExportVisible(false)}
      />
      <ManuscriptIndexModal
        visible={indexVisible}
        sections={sections}
        currentSectionIndex={currentSectionIndex}
        looseHeadingLabel={t('export_manuscript_loose_heading')}
        commentCountsBySceneId={commentCountsBySceneId}
        onSelectSection={handleIndexSelect}
        onClose={() => setIndexVisible(false)}
      />
    </View>
  );
};

export default ManuscriptScreen;
