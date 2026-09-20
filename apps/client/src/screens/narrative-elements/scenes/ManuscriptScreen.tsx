import { Ionicons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import Button from '../../../components/common/controls/Button/Button';
import { SingleSelectPill } from '../../../components/common/inputs/MultiSelectPill/MultiSelectPill';
import { ManuscriptExportSheet } from '../../../components/features/manuscript/ManuscriptExportSheet/ManuscriptExportSheet';
import { MarkdownPreview } from '../../../components/features/manuscript/MarkdownPreview/MarkdownPreview';
import {
  findManuscriptMatches,
  isLooseScene,
  linearManuscriptSections,
  routeManuscriptSections,
  sectionIndexForMatch,
  type ManuscriptSection,
} from '../../../components/features/manuscript/manuscriptSections';
import { manuscriptTextMetrics } from '../../../components/features/manuscript/manuscriptTextMetrics';
import { SceneBodyEditor } from '../../../components/features/manuscript/SceneBodyEditor/SceneBodyEditor';
import type { SceneSelect } from '../../../db/schema';
import { useDrizzle } from '../../../db';
import { useBackButtonHandler } from '../../../hooks/useBackButtonHandler';
import { useManuscriptData } from '../../../hooks/useManuscriptData';
import { useSceneBodyDraft } from '../../../hooks/useSceneBodyDraft';
import { useScreenHeader } from '../../../hooks/useScreenHeader';
import { useStoryRole } from '../../../hooks/useStoryRole';
import type { NarrativeElementsStackParamList } from '../../../navigation/MainSystemStack';
import {
  createSceneService,
  type SceneService,
} from '../../../services/storymanagement/SceneService';
import { useStoryStore } from '../../../state/storyStore';
import { useUserSettingsStore } from '../../../state/userSettingsStore';
import { useTheme } from '../../../theme';
import { AppAlert } from '../../../utils/AppAlert';

type ManuscriptScreenRouteProp = RouteProp<NarrativeElementsStackParamList, 'Manuscript'>;
type ManuscriptNavigation = NativeStackNavigationProp<NarrativeElementsStackParamList, 'Manuscript'>;

function ManuscriptSectionEditor({
  scene,
  storyId,
  canEdit,
  persist,
  onCollapse,
}: {
  scene: SceneSelect;
  storyId: string;
  canEdit: boolean;
  persist(sceneId: string, body: string | null): Promise<void>;
  onCollapse(): void;
}) {
  const { t } = useTranslation();
  const persistScene = useCallback(
    (body: string | null) => persist(scene.id, body),
    [persist, scene.id],
  );
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
    storyId,
    sceneId: scene.id,
    savedBody: scene.body,
    baseUpdatedAt: scene.updatedAt.toISOString(),
    enabled: true,
    persist: persistScene,
  });

  useEffect(() => {
    if (saveError) AppAlert.alert(t('error'), saveError);
  }, [saveError, t]);

  return (
    <View>
      <SceneBodyEditor
        testID={`manuscript-editor-${scene.id}`}
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
        autoFocus
      />
      <View style={{ paddingHorizontal: manuscriptTextMetrics.containerPaddingHorizontal }}>
        <Button onPress={onCollapse}>{t('manuscript_collapse')}</Button>
      </View>
    </View>
  );
}

const ManuscriptScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<ManuscriptNavigation>();
  const route = useRoute<ManuscriptScreenRouteProp>();
  const { selectedStory } = useStoryStore();
  const { userId } = useUserSettingsStore();
  const drizzleDb = useDrizzle();
  const sceneServiceRef = useRef<SceneService | null>(null);

  useEffect(() => {
    if (drizzleDb) sceneServiceRef.current ??= createSceneService(drizzleDb);
  }, [drizzleDb]);

  const storyId = selectedStory?.id;
  const isBranching = selectedStory?.type === 'branching';
  const { canEdit } = useStoryRole(storyId);
  const { chapters, scenes, routes, choices, stepsByRouteId, loading } =
    useManuscriptData(storyId ?? null);

  const [routeId, setRouteId] = useState<string | null>(route.params?.routeId ?? null);
  const effectiveRouteId = routeId ?? routes[0]?.id ?? null;
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [ordinal, setOrdinal] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);

  const sections: ManuscriptSection[] = useMemo(() => {
    if (isBranching) {
      if (!effectiveRouteId) return [];
      return routeManuscriptSections(stepsByRouteId.get(effectiveRouteId) ?? [], scenes);
    }
    return linearManuscriptSections(chapters, scenes);
  }, [isBranching, effectiveRouteId, stepsByRouteId, chapters, scenes]);

  const { matches, total } = useMemo(() => findManuscriptMatches(sections, query), [sections, query]);
  useEffect(() => {
    setOrdinal(0);
  }, [query, sections]);

  const looseCount = useMemo(() => {
    if (isBranching) return 0;
    const chaptersById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
    return scenes.filter((scene) => !scene.isDeleted && isLooseScene(scene, chaptersById)).length;
  }, [isBranching, chapters, scenes]);

  const exportRouteName = isBranching
    ? (routes.find((entry) => entry.id === effectiveRouteId)?.name ?? null)
    : null;

  const listRef = useRef<FlatList<ManuscriptSection> | null>(null);
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

  useScreenHeader({
    target: 'parent',
    title: t('manuscript_title'),
    actions: [
      {
        id: 'export-manuscript',
        icon: 'share-outline',
        label: t('export_manuscript_title'),
        onPress: () => setExportOpen(true),
        visible: sections.length > 0,
      },
    ],
  });

  const persist = useCallback(
    async (sceneId: string, body: string | null) => {
      if (!sceneServiceRef.current) throw new Error(t('error'));
      if (!userId) throw new Error(t('user_not_identified'));
      await sceneServiceRef.current.updateScene(userId, sceneId, { body });
    },
    [userId, t],
  );

  const openScene = useCallback(
    (sceneId: string) => {
      navigation.navigate('SceneDetail', { sceneId });
    },
    [navigation],
  );

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
          paddingVertical: manuscriptTextMetrics.containerPaddingVertical,
        },
        divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
        containerTitle: { color: colors.text, fontSize: 22, fontWeight: '700' },
        containerEvent: { fontStyle: 'italic' },
        looseTitle: { color: colors.textSecondary, fontSize: 16, fontStyle: 'italic' },
        sceneTitle: {
          color: colors.textSecondary,
          fontSize: 12,
          fontWeight: '700',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          marginBottom: 8,
        },
        emptyText: { color: colors.textSecondary, fontSize: 15, fontStyle: 'italic' },
        emptyWrap: { padding: 24, alignItems: 'center', gap: 12 },
      }),
    [colors],
  );

  const renderSection = useCallback(
    ({ item, index }: { item: ManuscriptSection; index: number }) => {
      if (item.kind === 'container') {
        return (
          <View style={styles.section}>
            {index > 0 && <View style={styles.divider} />}
            <Text
              style={[
                styles.containerTitle,
                item.containerType === 'event' && styles.containerEvent,
              ]}
            >
              {item.containerType === 'chapter' ? `${item.index}. ${item.name}` : item.name}
            </Text>
          </View>
        );
      }
      if (item.kind === 'loose-heading') {
        return (
          <View style={styles.section}>
            <View style={styles.divider} />
            <Text style={styles.looseTitle}>{t('unchaptered_scenes')}</Text>
          </View>
        );
      }
      const expanded = expandedKey === item.key;
      return (
        <View>
          {index > 0 && <View style={styles.divider} />}
          <View style={styles.section}>
            <TouchableOpacity onPress={() => openScene(item.scene.id)}>
              <Text style={styles.sceneTitle}>{`${item.position}. ${item.scene.name}`}</Text>
            </TouchableOpacity>
            {expanded ? (
              <ManuscriptSectionEditor
                scene={item.scene}
                storyId={item.scene.storyId}
                canEdit={canEdit}
                persist={persist}
                onCollapse={() => setExpandedKey(null)}
              />
            ) : item.scene.body ? (
              <TouchableOpacity
                testID={`manuscript-expand-${item.scene.id}`}
                onPress={() => setExpandedKey(item.key)}
              >
                <MarkdownPreview text={item.scene.body} />
              </TouchableOpacity>
            ) : (
              <Button onPress={() => setExpandedKey(item.key)}>
                {t('manuscript_start_writing')}
              </Button>
            )}
          </View>
        </View>
      );
    },
    [expandedKey, canEdit, openScene, persist, styles, t],
  );

  if (loading) {
    return <ScreenLoading padded message={t('loading')} />;
  }
  if (!storyId) {
    return <ScreenError padded message={t('no_story_selected')} onGoBack={() => navigation.goBack()} />;
  }

  return (
    <View style={styles.container}>
      <ManuscriptExportSheet
        visible={exportOpen}
        onClose={() => setExportOpen(false)}
        storyTitle={selectedStory?.title ?? ''}
        isBranching={isBranching}
        routeName={exportRouteName}
        routeSteps={isBranching && effectiveRouteId ? (stepsByRouteId.get(effectiveRouteId) ?? []) : []}
        chapters={chapters}
        scenes={scenes}
        choices={choices}
        looseCount={looseCount}
      />
      <View style={styles.toolbar}>
        {isBranching && (
          <SingleSelectPill
            options={routes.map((entry) => ({ label: entry.name, value: entry.id }))}
            value={effectiveRouteId}
            onValueChange={(value) => {
              setRouteId(value);
              setExpandedKey(null);
            }}
            placeholder={t('manuscript_route')}
          />
        )}
        <View style={styles.searchRow}>
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
        <FlatList
          ref={listRef}
          testID="manuscript-list"
          data={sections}
          keyExtractor={(item) => item.key}
          renderItem={renderSection}
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
      )}
    </View>
  );
};

export default ManuscriptScreen;
