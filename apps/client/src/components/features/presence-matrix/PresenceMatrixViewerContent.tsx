import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import GraphNodeSheet from '@/src/components/features/graphs/GraphNodeSheet/GraphNodeSheet';
import {
  CharacterSelect,
  ChapterSelect,
  ItemJourneySelect,
  ItemSelect,
  SceneSelect,
} from '../../../db/schema';
import { useDrizzle } from '../../../db';
import { createCharacterSceneService } from '../../../services/storymanagement/CharacterSceneService';
import { createCharacterService } from '../../../services/storymanagement/CharacterService';
import { createChapterService } from '../../../services/storymanagement/ChapterService';
import { createItemJourneyService } from '../../../services/storymanagement/ItemJourneyService';
import { createItemService } from '../../../services/storymanagement/ItemService';
import { createSceneService } from '../../../services/storymanagement/SceneService';
import { useNotificationStore } from '../../../state/notificationStore';
import { useStoryStore } from '../../../state/storyStore';
import { useTheme } from '../../../theme';
import { buildPresenceMatrixLayout, PresenceMatrixRow } from '../../../utils/presenceMatrixLayout';
import { buildChapterColors } from '../../../utils/storyGraphLayout';
import { deliverSvgMap } from '../../../utils/storyTransfer';
import { renderPresenceMatrixSvg } from '../../../utils/presenceMatrixSvg';
import { getDistinctSeriesColor } from '../../../utils/colorUtils';
import PresenceMatrixCanvas, { PresenceMatrixCanvasHandle } from './PresenceMatrixCanvas';

const SERIES_COLORS = [
  '#0B6E99',
  '#D64545',
  '#6D4BC3',
  '#C87800',
  '#16803C',
  '#B23A7A',
  '#655CDB',
  '#A55A18',
  '#007C83',
  '#A94141',
  '#4D749E',
  '#8D6B13',
];
const MAX_VISIBLE_SERIES = 12;
const seriesColor = (index: number, total: number) =>
  getDistinctSeriesColor(index, total, SERIES_COLORS);
type Request = { kind: 'character'; characterId: string } | { kind: 'item'; itemId: string };

const PresenceMatrixViewerContent: React.FC<{ request: Request; onClose: () => void }> = ({
  request,
  onClose,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const db = useDrizzle();
  const story = useStoryStore((state) => state.selectedStory);
  const notify = useNotificationStore((state) => state.showNotification);
  const canvas = useRef<PresenceMatrixCanvasHandle>(null);
  const [characters, setCharacters] = useState<CharacterSelect[]>([]);
  const [scenes, setScenes] = useState<SceneSelect[]>([]);
  const [chapters, setChapters] = useState<ChapterSelect[]>([]);
  const [presence, setPresence] = useState<{ characterId: string; sceneId: string }[]>([]);
  const [items, setItems] = useState<ItemSelect[]>([]);
  const [itemIds, setItemIds] = useState<string[]>(request.kind === 'item' ? [request.itemId] : []);
  const [journeys, setJourneys] = useState<ItemJourneySelect[]>([]);
  const [ids, setIds] = useState<string[]>(
    request.kind === 'character' ? [request.characterId] : [],
  );
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [selectedItemDetailsId, setSelectedItemDetailsId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const characterColorOf = useCallback(
    (id: string) => seriesColor(Math.max(0, ids.indexOf(id)), ids.length),
    [ids],
  );
  const itemColorOf = useCallback(
    (id: string) => seriesColor(Math.max(0, itemIds.indexOf(id)), itemIds.length),
    [itemIds],
  );
  useEffect(() => {
    setIds(request.kind === 'character' ? [request.characterId] : []);
    if (request.kind === 'item') setItemIds([request.itemId]);
  }, [request]);
  useEffect(() => {
    if (!story) return;
    (async () => {
      setLoading(true);
      try {
        const [cs, ss, hs, ps, loadedItems] = await Promise.all([
          createCharacterService(db).getAllByStoryId(story.id),
          createSceneService(db).getAllByStoryId(story.id),
          createChapterService(db).getAllByStoryId(story.id),
          createCharacterSceneService(db).getRelationsByStoryId(story.id),
          createItemService(db).getAllByStoryId(story.id),
        ]);
        setCharacters(cs.filter((x) => !x.isDeleted));
        setScenes(ss.filter((x) => !x.isDeleted));
        setChapters(hs.filter((x) => !x.isDeleted));
        setPresence(ps.filter((x) => !x.isDeleted));
        setItems(loadedItems.filter((x) => !x.isDeleted));
      } finally {
        setLoading(false);
      }
    })();
  }, [db, story]);
  useEffect(() => {
    if (!story || request.kind !== 'item') {
      setJourneys([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const journeysByItem = await Promise.all(
        itemIds.map((itemId) =>
          createItemJourneyService(db).getItemJourneysByItemId(story.id, itemId),
        ),
      );
      if (!cancelled) setJourneys(journeysByItem.flat().filter((entry) => !entry.isDeleted));
    })();
    return () => {
      cancelled = true;
    };
  }, [db, itemIds, request.kind, story]);
  const selectedItems = useMemo(
    () =>
      itemIds.map((id) => items.find((entry) => entry.id === id)).filter(Boolean) as ItemSelect[],
    [itemIds, items],
  );
  const selectedItemDetails = useMemo(
    () => selectedItems.find((entry) => entry.id === selectedItemDetailsId) ?? null,
    [selectedItemDetailsId, selectedItems],
  );
  const availableIds =
    request.kind === 'character'
      ? characters.map((entry) => entry.id)
      : items.map((entry) => entry.id);
  const activeIds = request.kind === 'character' ? ids : itemIds;
  const isCompleteView =
    availableIds.length > MAX_VISIBLE_SERIES && activeIds.length === availableIds.length;
  const selectAll = () => {
    if (request.kind === 'character') setIds(availableIds);
    else setItemIds(availableIds);
  };
  const selectCompactView = () => {
    if (request.kind === 'character') setIds(availableIds.slice(0, MAX_VISIBLE_SERIES));
    else setItemIds(availableIds.slice(0, MAX_VISIBLE_SERIES));
  };
  const layout = useMemo(() => {
    const byChapter = new Map(chapters.map((x) => [x.id, x]));
    const colorsByChapter = buildChapterColors(chapters);
    const ordered = [...scenes]
      .sort(
        (a, b) =>
          (byChapter.get(a.chapterId)?.index ?? 0) - (byChapter.get(b.chapterId)?.index ?? 0) ||
          a.index - b.index,
      )
      .map((s) => ({
        id: s.id,
        name: s.name,
        chapterName: byChapter.get(s.chapterId)?.name ?? '',
        chapterColor: colorsByChapter.get(s.chapterId) ?? colors.border,
      }));
    let rows: PresenceMatrixRow[] = [];
    if (request.kind === 'item')
      rows = selectedItems.map((entry) => ({
        id: entry.id,
        label: entry.initialState ? `${entry.name} · ${entry.initialState}` : entry.name,
        color: itemColorOf(entry.id),
        cells: new Map(
          journeys
            .filter((journey) => journey.itemId === entry.id)
            .map((journey) => [journey.sceneId, journey.newState]),
        ),
      }));
    if (request.kind === 'character')
      rows = ids.map((id, index) => ({
        id,
        label: characters.find((x) => x.id === id)?.name ?? id,
        color: characterColorOf(id),
        cells: new Map(presence.filter((x) => x.characterId === id).map((x) => [x.sceneId, '✓'])),
      }));
    return buildPresenceMatrixLayout(ordered, rows);
  }, [
    chapters,
    characterColorOf,
    characters,
    colors.border,
    ids,
    itemColorOf,
    journeys,
    presence,
    request.kind,
    scenes,
    selectedItems,
  ]);
  const toggle = (id: string) =>
    setIds((current) =>
      current.includes(id)
        ? current.length > 1
          ? current.filter((x) => x !== id)
          : current
        : current.length < 4
          ? [...current, id]
          : current,
    );
  const exportMap = useCallback(async () => {
    if (!story || !layout.rows.length) return;
    setSaving(true);
    try {
      const svg = renderPresenceMatrixSvg(layout, {
        title: story.title,
        subtitle:
          request.kind === 'item' ? t('presence_matrix_item_title') : t('presence_matrix_title'),
        background: colors.background,
        surface: colors.surface,
        text: colors.text,
        border: colors.border,
      });
      const r = await deliverSvgMap(svg, `${story.title}-presenca.svg`);
      notify(
        r.delivered
          ? t('presence_matrix_export_success', { fileName: r.fileName })
          : t('presence_matrix_export_no_share_target', { path: r.uri || r.fileName }),
        r.delivered ? 'success' : 'warning',
      );
    } finally {
      setSaving(false);
    }
  }, [colors, layout, notify, request.kind, story, t]);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          padding: 12,
          borderBottomWidth: 1,
          borderColor: colors.border,
        },
        title: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '700' },
        chips: {
          flexDirection: 'row',
          gap: 6,
          padding: 8,
          borderBottomWidth: 1,
          borderColor: colors.border,
        },
        chip: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          borderRadius: 14,
          paddingHorizontal: 9,
          paddingVertical: 5,
        },
        controls: { position: 'absolute', right: 14, bottom: 18, gap: 8 },
        bulkActions: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
          gap: 12,
          paddingHorizontal: 12,
          paddingBottom: 8,
        },
        bulkAction: { paddingVertical: 5 },
        bulkActionText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
        bulkHint: {
          color: colors.textSecondary,
          fontSize: 12,
          paddingHorizontal: 12,
          paddingBottom: 8,
        },
        control: {
          width: 42,
          height: 42,
          borderRadius: 21,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        },
        message: { padding: 28, color: colors.textSecondary, textAlign: 'center' },
      }),
    [colors],
  );
  if (story?.type !== 'linear')
    return (
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('presence_matrix_title')}</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={26} color={colors.text} />
          </TouchableOpacity>
        </View>
        <Text style={styles.message}>{t('presence_matrix_branching_unavailable')}</Text>
      </View>
    );
  if (loading)
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {request.kind === 'item' ? t('presence_matrix_item_title') : t('presence_matrix_title')}
        </Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={26} color={colors.text} />
        </TouchableOpacity>
      </View>
      {request.kind === 'character' && (
        <MultiSelectPill
          options={characters.map((character) => ({
            label: character.name,
            value: character.id,
            color: ids.includes(character.id) ? characterColorOf(character.id) : undefined,
          }))}
          selectedValues={ids}
          onSelectionChange={(next) => setIds(next.slice(0, MAX_VISIBLE_SERIES))}
          placeholder={t('characters_title')}
          searchPlaceholder={t('search')}
          selectionSummary={
            isCompleteView ? t('presence_matrix_selected_all', { count: ids.length }) : undefined
          }
          triggerStyle={{ marginHorizontal: 8, marginTop: 10, minHeight: 42, paddingVertical: 5 }}
        />
      )}
      {request.kind === 'item' && (
        <MultiSelectPill
          options={items.map((entry) => ({
            label: entry.name,
            value: entry.id,
            color: itemIds.includes(entry.id) ? itemColorOf(entry.id) : undefined,
          }))}
          selectedValues={itemIds}
          onSelectionChange={(next) => setItemIds(next.slice(0, MAX_VISIBLE_SERIES))}
          placeholder={t('items_title')}
          searchPlaceholder={t('search')}
          selectionSummary={
            isCompleteView
              ? t('presence_matrix_selected_all', { count: itemIds.length })
              : undefined
          }
          triggerStyle={{ marginHorizontal: 8, marginTop: 10, minHeight: 42, paddingVertical: 5 }}
        />
      )}
      <View style={styles.bulkActions}>
        <TouchableOpacity
          style={styles.bulkAction}
          onPress={isCompleteView ? selectCompactView : selectAll}
        >
          <Text style={styles.bulkActionText}>
            {isCompleteView
              ? t('presence_matrix_show_compact', { count: MAX_VISIBLE_SERIES })
              : t('presence_matrix_add_all')}
          </Text>
        </TouchableOpacity>
      </View>
      {isCompleteView && (
        <Text style={styles.bulkHint}>{t('presence_matrix_complete_view_hint')}</Text>
      )}
      <PresenceMatrixCanvas
        ref={canvas}
        layout={layout}
        onPressScene={setSelectedSceneId}
        onPressRow={(id) => {
          if (request.kind === 'character') setSelectedCharacterId(id);
          else setSelectedItemDetailsId(id);
        }}
      />
      <View style={styles.controls}>
        {[
          ['add', () => canvas.current?.zoomBy(1.25)],
          ['remove', () => canvas.current?.zoomBy(0.8)],
          ['scan-outline', () => canvas.current?.fitToScreen()],
          ['image-outline', exportMap],
        ].map(([name, press]) => (
          <TouchableOpacity
            key={name as string}
            style={styles.control}
            onPress={press as () => void}
            disabled={saving}
          >
            <Ionicons name={name as keyof typeof Ionicons.glyphMap} size={20} color={colors.text} />
          </TouchableOpacity>
        ))}
      </View>
      {selectedSceneId && (
        <GraphNodeSheet
          title={scenes.find((scene) => scene.id === selectedSceneId)?.name ?? ''}
          subtitle={{
            text:
              chapters.find(
                (chapter) =>
                  chapter.id === scenes.find((scene) => scene.id === selectedSceneId)?.chapterId,
              )?.name ?? '',
          }}
          sections={[
            {
              title: t('summary'),
              description:
                scenes.find((scene) => scene.id === selectedSceneId)?.summary || t('common_na'),
            },
            {
              title: t('characters_title'),
              items: characters
                .filter((character) =>
                  presence.some(
                    (relation) =>
                      relation.sceneId === selectedSceneId && relation.characterId === character.id,
                  ),
                )
                .map((character) => ({
                  id: character.id,
                  icon: 'person-outline' as const,
                  label: character.name,
                  onPress: () => {
                    setSelectedSceneId(null);
                    setSelectedCharacterId(character.id);
                  },
                })),
            },
          ]}
          actionLabel={t('story_map_open_scene')}
          onAction={() => setSelectedSceneId(null)}
          onClose={() => setSelectedSceneId(null)}
        />
      )}
      {selectedCharacterId && (
        <GraphNodeSheet
          title={characters.find((character) => character.id === selectedCharacterId)?.name ?? ''}
          sections={[
            {
              title: t('description'),
              description:
                characters.find((character) => character.id === selectedCharacterId)?.description ||
                t('common_na'),
            },
            {
              title: t('scenes_title'),
              items: scenes
                .filter((scene) =>
                  presence.some(
                    (relation) =>
                      relation.characterId === selectedCharacterId && relation.sceneId === scene.id,
                  ),
                )
                .map((scene) => ({
                  id: scene.id,
                  icon: 'document-text-outline' as const,
                  label: scene.name,
                  detail: scene.summary || undefined,
                  onPress: () => {
                    setSelectedCharacterId(null);
                    setSelectedSceneId(scene.id);
                  },
                })),
            },
          ]}
          actionLabel={t('close')}
          onAction={() => setSelectedCharacterId(null)}
          onClose={() => setSelectedCharacterId(null)}
        />
      )}
      {selectedItemDetails && (
        <GraphNodeSheet
          title={selectedItemDetails.name}
          sections={[
            {
              title: t('description'),
              description: selectedItemDetails.description || t('common_na'),
            },
            ...(selectedItemDetails.initialState
              ? [
                  {
                    title: t('initial_state'),
                    description: selectedItemDetails.initialState,
                  },
                ]
              : []),
            {
              title: t('scenes_title'),
              items: journeys
                .filter((journey) => journey.itemId === selectedItemDetailsId)
                .map((journey) => {
                  const scene = scenes.find((entry) => entry.id === journey.sceneId);
                  return {
                    id: journey.sceneId,
                    icon: 'document-text-outline' as const,
                    label: scene?.name ?? t('common_na'),
                    detail: journey.newState,
                    onPress: () => {
                      setSelectedItemDetailsId(null);
                      setSelectedSceneId(journey.sceneId);
                    },
                  };
                }),
            },
          ]}
          actionLabel={t('close')}
          onAction={() => setSelectedItemDetailsId(null)}
          onClose={() => setSelectedItemDetailsId(null)}
        />
      )}
    </View>
  );
};
export default PresenceMatrixViewerContent;
