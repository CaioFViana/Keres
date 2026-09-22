import { Ionicons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import type { ManuscriptSection } from '@keres/shared';
import {
  compileLinearManuscript,
  compileRouteManuscript,
  findManuscriptMatches,
  isLooseScene,
  linearManuscriptSections,
  routeManuscriptSections,
  sectionIndexForMatch,
} from '@keres/shared';
import { SingleSelectPill } from '../../../components/common/inputs/MultiSelectPill/MultiSelectPill';
import { MarkdownPreview } from '../../../components/features/manuscript/MarkdownPreview/MarkdownPreview';
import {
  exportManuscript,
  MANUSCRIPT_EXPORT_FORMATS,
  type ManuscriptExportFormat,
} from '../../../components/features/manuscript/export/manuscriptExport';
import { manuscriptTextMetrics } from '../../../components/features/manuscript/manuscriptTextMetrics';
import { useScreenAnchor } from '../../../guides/useGuideAnchor';
import { useScreenTour } from '../../../guides/useScreenTour';
import { useAsyncOperation } from '../../../hooks/useAsyncOperation';
import { useBackButtonHandler } from '../../../hooks/useBackButtonHandler';
import { useManuscriptData } from '../../../hooks/useManuscriptData';
import { useScreenHeader } from '../../../hooks/useScreenHeader';
import type { NarrativeElementsStackParamList } from '../../../navigation/MainSystemStack';
import { useNotificationStore } from '../../../state/notificationStore';
import { useStoryStore } from '../../../state/storyStore';
import { useTheme } from '../../../theme';
import { AppAlert } from '../../../utils/AppAlert';

type ManuscriptScreenRouteProp = RouteProp<NarrativeElementsStackParamList, 'Manuscript'>;
type ManuscriptNavigation = NativeStackNavigationProp<NarrativeElementsStackParamList, 'Manuscript'>;

const ManuscriptScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  useScreenTour('Manuscript');
  const searchAnchorRef = useScreenAnchor('Manuscript', 'search');
  const listAnchorRef = useScreenAnchor('Manuscript', 'list');
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<ManuscriptNavigation>();
  const route = useRoute<ManuscriptScreenRouteProp>();
  const { selectedStory } = useStoryStore();
  const { showNotification } = useNotificationStore();
  const { pending: exporting, run: runExport } = useAsyncOperation();

  const storyId = selectedStory?.id;
  const isBranching = selectedStory?.type === 'branching';
  const { chapters, scenes, routes, choices, stepsByRouteId, loading } = useManuscriptData(
    storyId ?? null,
  );

  const [routeId, setRouteId] = useState<string | null>(route.params?.routeId ?? null);
  const effectiveRouteId = routeId ?? routes[0]?.id ?? null;
  const [query, setQuery] = useState('');
  const [ordinal, setOrdinal] = useState(0);
  const [pureRead, setPureRead] = useState(false);

  // Reading order per story shape: branching follows one route's steps in position order
  // (empty until a route exists), linear stacks chapters, events, then the homeless tail.
  // The deep-linked routeId is only the initial pick - afterwards the pill owns it, and an
  // unset pick falls back to the first route.
  const allSections: ManuscriptSection[] = useMemo(() => {
    if (isBranching) {
      if (!effectiveRouteId) return [];
      return routeManuscriptSections(stepsByRouteId.get(effectiveRouteId) ?? [], scenes);
    }
    return linearManuscriptSections(chapters, scenes);
  }, [isBranching, effectiveRouteId, stepsByRouteId, chapters, scenes]);

  // Pure reading drops empty scenes (there is nothing to read and no title to show).
  const sections = useMemo(
    () =>
      pureRead
        ? allSections.filter((section) => section.kind !== 'scene' || section.scene.body)
        : allSections,
    [pureRead, allSections],
  );

  const { matches, total } = useMemo(() => findManuscriptMatches(sections, query), [sections, query]);
  // Derived-state reset during render (the sanctioned pattern, not an effect): a new query
  // or new sections invalidate the current match position, so the ordinal restarts at the
  // first match. React re-renders immediately with ordinal 0; no stale jump escapes.
  const [prevQuery, setPrevQuery] = useState(query);
  const [prevSections, setPrevSections] = useState(sections);
  if (query !== prevQuery || sections !== prevSections) {
    setPrevQuery(query);
    setPrevSections(sections);
    setOrdinal(0);
  }

  const listRef = useRef<FlatList<ManuscriptSection> | null>(null);
  // Match navigation wraps past both ends: prev from the first match lands on the last,
  // next from the last lands on the first. Each jump scrolls the owning section near the top.
  const jumpToOrdinal = useCallback(
    (next: number) => {
      if (total === 0) return;
      const wrapped = ((next % total) + total) % total;
      setOrdinal(wrapped);
      listRef.current?.scrollToIndex({
        index: sectionIndexForMatch(matches, wrapped),
        animated: true,
        viewPosition: 0.1,
      });
    },
    [matches, total],
  );

  const looseCount = useMemo(() => {
    if (isBranching) return 0;
    const chaptersById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
    return scenes.filter((scene) => !scene.isDeleted && isLooseScene(scene, chaptersById)).length;
  }, [isBranching, chapters, scenes]);

  const exportRouteName = isBranching
    ? (routes.find((entry) => entry.id === effectiveRouteId)?.name ?? null)
    : null;

  // Export pipeline: compile the in-memory read model into format-neutral blocks, then
  // hand the manuscript to the shared delivery path (share sheet, or a browser download on
  // web). A delivered file notifies success; a build with no share target reports where the
  // file is instead of claiming success; anything thrown notifies failure.
  const runExportFormat = useCallback(
    (format: ManuscriptExportFormat, includeLoose: boolean) => {
      void runExport(async () => {
        try {
          const manuscript = isBranching
            ? compileRouteManuscript({
                title: selectedStory?.title ?? '',
                routeName: exportRouteName ?? '',
                steps: effectiveRouteId ? (stepsByRouteId.get(effectiveRouteId) ?? []) : [],
                scenes,
                choices,
                looseHeadingLabel: t('export_manuscript_loose_heading'),
              })
            : compileLinearManuscript({
                title: selectedStory?.title ?? '',
                chapters,
                scenes,
                choices,
                includeLooseScenes: includeLoose,
                looseHeadingLabel: t('export_manuscript_loose_heading'),
              });
          const result = await exportManuscript({
            storyTitle: selectedStory?.title ?? '',
            manuscript,
            format,
            labels: {
              goToPage: t('export_manuscript_go_to_page'),
              goToScene: t('export_manuscript_go_to_scene'),
            },
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
    [runExport, isBranching, selectedStory, exportRouteName, effectiveRouteId, stepsByRouteId, scenes, choices, chapters, t, showNotification],
  );

  const askExportFormat = useCallback(
    (includeLoose: boolean) => {
      AppAlert.alert(
        t('export_manuscript_title'),
        isBranching && exportRouteName
          ? t('export_manuscript_route_note', { route: exportRouteName })
          : undefined,
        [
          ...MANUSCRIPT_EXPORT_FORMATS.map((format) => ({
            text: t(`export_manuscript_format_${format}`),
            onPress: () => runExportFormat(format, includeLoose),
          })),
          { text: t('cancel'), style: 'cancel' as const },
        ],
      );
    },
    [isBranching, exportRouteName, runExportFormat, t],
  );

  // Linear exports gate on loose scenes: chapterless fragments and event-container prose
  // are offered behind an explicit include/exclude choice. Route exports never ask - the
  // route itself is the scope. Re-entrant presses while an export runs are ignored.
  const handleExportPress = useCallback(() => {
    if (exporting) return;
    if (!isBranching && looseCount > 0) {
      AppAlert.alert(t('export_manuscript_title'), t('export_manuscript_loose_message'), [
        {
          text: t('export_manuscript_include_loose', { count: looseCount }),
          onPress: () => askExportFormat(true),
        },
        {
          text: t('export_manuscript_exclude_loose'),
          onPress: () => askExportFormat(false),
        },
        { text: t('cancel'), style: 'cancel' as const },
      ]);
      return;
    }
    askExportFormat(true);
  }, [exporting, isBranching, looseCount, askExportFormat, t]);

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
      {
        id: 'pure-read',
        icon: pureRead ? 'eye' : 'eye-outline',
        label: t('manuscript_pure_read'),
        active: pureRead,
        onPress: () => setPureRead((current) => !current),
      },
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
        searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
        searchInput: {
          flex: 1,
          color: colors.text,
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 8,
          fontSize: 15,
        },
        searchNav: { padding: 8 },
        searchCount: { color: colors.textSecondary, fontSize: 13, minWidth: 64, textAlign: 'center' },
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
      return (
        <View>
          {index > 0 && <View style={styles.sceneDivider} />}
          <View style={styles.section}>
            {!pureRead && (
              <View style={styles.sceneHeaderRow}>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => openScene(item.scene.id)}>
                  <Text style={styles.sceneTitle}>{`${item.position}. ${item.scene.name}`}</Text>
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
              </View>
            )}
            {item.scene.body ? (
              <MarkdownPreview text={item.scene.body} />
            ) : (
              !pureRead && <Text style={styles.emptyText}>{t('manuscript_no_body_yet')}</Text>
            )}
          </View>
        </View>
      );
    },
    [pureRead, openScene, openSceneEditor, styles, t, colors],
  );

  if (loading) {
    return <ScreenLoading padded message={t('loading')} />;
  }
  if (!storyId) {
    return <ScreenError padded message={t('no_story_selected')} onGoBack={() => navigation.goBack()} />;
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
        <View ref={searchAnchorRef} collapsable={false} style={styles.searchRow}>
          <TextInput
            testID="manuscript-search"
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={t('manuscript_search_placeholder')}
            placeholderTextColor={colors.textSecondary}
            returnKeyType="search"
            onSubmitEditing={() => jumpToOrdinal(ordinal)}
          />
          <TouchableOpacity
            testID="manuscript-search-prev"
            style={styles.searchNav}
            onPress={() => jumpToOrdinal(ordinal - 1)}
            disabled={total === 0}
          >
            <Ionicons name="chevron-up" size={22} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            testID="manuscript-search-next"
            style={styles.searchNav}
            onPress={() => jumpToOrdinal(ordinal + 1)}
            disabled={total === 0}
          >
            <Ionicons name="chevron-down" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
        {query.trim().length > 0 && (
          <Text style={styles.searchCount}>
            {total === 0
              ? t('manuscript_no_results')
              : t('manuscript_search_count', { current: ordinal + 1, total })}
          </Text>
        )}
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
        <View ref={listAnchorRef} collapsable={false} style={{ flex: 1 }}>
          <FlatList
            ref={listRef}
            testID="manuscript-list"
            data={sections}
            keyExtractor={(item) => item.key}
            renderItem={renderSection}
            // Unmeasured rows cannot be jumped to directly: scroll to the estimated
            // offset first so the row measures, then retry the indexed jump on the next tick.
            onScrollToIndexFailed={(info) => {
              listRef.current?.scrollToOffset({
                offset: info.averageItemLength * info.index,
                animated: false,
              });
              setTimeout(() => {
                listRef.current?.scrollToIndex({ index: info.index, animated: false });
              }, 100);
            }}
          />
        </View>
      )}
    </View>
  );
};

export default ManuscriptScreen;
