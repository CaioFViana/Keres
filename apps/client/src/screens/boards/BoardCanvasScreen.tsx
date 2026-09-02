import Button from '@/src/components/common/controls/Button/Button';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import type { BoardCanvasHandle } from '@/src/components/features/boards/BoardCanvas';
import BoardCanvas from '@/src/components/features/boards/BoardCanvas';
import BoardCanvasHeaderActions from '@/src/components/features/boards/BoardCanvasHeaderActions';
import BoardNodeSheet from '@/src/components/features/boards/BoardNodeSheet';
import GraphCanvasControls from '@/src/components/features/graphs/GraphCanvasControls/GraphCanvasControls';
import type { BoardContentType, BoardNodeType, BoardPinEntity } from '@keres/shared';
import { generateBoardLocalId } from '@keres/shared';
import type { RouteProp } from '@react-navigation/native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useDrizzle } from '../../db';
import type { BoardSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import {
  decodeBoardPinValue,
  useBoardPinOptions,
  type BoardPinOption,
} from '../../hooks/useBoardPinOptions';
import { useNavigateToEntityDetail } from '../../hooks/useNavigateToEntityDetail';
import { useStoryRole } from '../../hooks/useStoryRole';
import type { BoardStackParamList } from '../../navigation/MainSystemStack';
import { createBoardService } from '../../services/storymanagement/BoardService';
import { createGalleryService } from '../../services/storymanagement/GalleryService';
import { useBoardDraftStore } from '../../state/boardDraftStore';
import { useNotificationStore } from '../../state/notificationStore';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { loadBoardEntitySummary, type BoardEntitySummary } from '../../utils/boardEntitySummary';
import type { BoardGalleryMedia, BoardGalleryMediaById } from '../../utils/boardLayout';
import { nextStaggeredPosition } from '../../utils/boardLayout';
import {
  boardPinAppearanceType,
  boardPinTypeKey,
  getBoardPinAppearance,
  worldPieceSectionFromBoardPinGroup,
} from '../../utils/boardPinAppearance';
import { setDocumentTitle } from '../../utils/documentTitle';
import type { NavigableEntityType } from '../../utils/entityNavigation';
import { toNavigableEntityType } from '../../utils/entityNavigation';
import { buildBoardMapFileName, deliverSvgMap } from '../../utils/storyTransfer';
import { buildStandaloneBoardSvg } from '../../utils/storyMapSvgExport';

const BoardCanvasScreen = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<BoardStackParamList, 'BoardCanvas'>>();
  const { boardId } = useRoute<RouteProp<BoardStackParamList, 'BoardCanvas'>>().params;
  const db = useDrizzle();
  const selectedStory = useStoryStore((state) => state.selectedStory);
  const storyId = selectedStory?.id;
  const { canEdit } = useStoryRole(storyId);
  const { userId } = useUserSettingsStore();
  const { showNotification } = useNotificationStore();
  const navigateToEntity = useNavigateToEntityDetail();
  const { groupedOptions, options } = useBoardPinOptions(storyId, boardId);
  const canvasRef = useRef<BoardCanvasHandle>(null);

  const [board, setBoard] = useState<BoardSelect | null>(null);
  const [content, setContent] = useState<BoardContentType>({ nodes: [], edges: [] });
  const [savedContent, setSavedContent] = useState<BoardContentType>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<BoardNodeType | null>(null);
  const [layoutSelectedNodeId, setLayoutSelectedNodeId] = useState<string | null>(null);
  const [layoutEditing, setLayoutEditing] = useState(false);
  const [pickerValues, setPickerValues] = useState<string[]>([]);
  const [livePins, setLivePins] = useState<
    Record<string, { label: string; group: BoardPinOption['group'] }>
  >({});
  const [exporting, setExporting] = useState(false);
  /** Media of the story's galleries, keyed by gallery id - lets Gallery pins show their image. */
  const [galleryMediaById, setGalleryMediaById] = useState<BoardGalleryMediaById>({});
  /** Light summary of the selected entity pin, loaded when the sheet opens. */
  const [selectedSummary, setSelectedSummary] = useState<BoardEntitySummary | null>(null);
  const [summariesByNode, setSummariesByNode] = useState<Record<string, BoardEntitySummary | null>>(
    {},
  );

  const dirty = JSON.stringify(content) !== JSON.stringify(savedContent);

  useBackButtonHandler({
    showWebBackButton: true,
    onBack: () => navigation.goBack(),
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const row = await createBoardService(db).getById(boardId);
      if (!row || row.isDeleted) {
        setError(t('board_not_found'));
        setBoard(null);
        return;
      }
      const draft = useBoardDraftStore.getState().draft;
      if (draft && (draft.boardId !== boardId || draft.storyId !== storyId)) {
        useBoardDraftStore.getState().clear();
      }
      const keep = useBoardDraftStore.getState().draft;
      setBoard(row);
      if (keep && keep.boardId === boardId && keep.storyId === storyId) {
        setContent(keep.content);
        setSavedContent(row.content);
      } else {
        setContent(row.content);
        setSavedContent(row.content);
      }
      setError(null);
    } catch (loadError) {
      console.log('BoardCanvasScreen: failed to load board.', loadError);
      setError(t('board_load_failed'));
    } finally {
      setLoading(false);
    }
  }, [boardId, db, storyId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const next: Record<string, { label: string; group: BoardPinOption['group'] }> = {};
    for (const option of options) {
      next[`${option.entityType}:${option.entityId}`] = {
        label: option.label,
        group: option.group,
      };
    }
    setLivePins(next);
  }, [options]);

  useEffect(() => {
    if (!storyId) {
      setGalleryMediaById({});
      return;
    }
    let cancelled = false;
    (async () => {
      const rows = await createGalleryService(db).getGalleriesByStoryId(storyId);
      if (cancelled) return;
      const next: Record<string, BoardGalleryMedia> = {};
      for (const row of rows) {
        next[row.id] = {
          mediaType: row.mediaType,
          mimeType: row.mimeType,
          localPath: row.localPath,
          thumbnailPath: row.thumbnailPath ?? null,
        };
      }
      setGalleryMediaById(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, storyId]);

  useEffect(() => {
    let cancelled = false;
    setSelectedSummary(null);
    if (!selected || selected.kind !== 'entity') return;
    (async () => {
      const summary = await loadBoardEntitySummary(
        db,
        selected.entityType as BoardPinEntity,
        selected.entityId,
      );
      if (!cancelled) setSelectedSummary(summary);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, selected]);

  useEffect(() => {
    let cancelled = false;
    const entityNodes = content.nodes.filter(
      (node): node is Extract<BoardNodeType, { kind: 'entity' }> => node.kind === 'entity',
    );
    void Promise.all(
      entityNodes.map(
        async (node) =>
          [node.id, await loadBoardEntitySummary(db, node.entityType, node.entityId)] as const,
      ),
    ).then((entries) => {
      if (!cancelled) setSummariesByNode(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [content.nodes, db]);

  const save = useCallback(async () => {
    if (!userId || !board) return;
    try {
      const updated = await createBoardService(db).updateBoard(userId, board.id, { content });
      setBoard(updated);
      setSavedContent(updated.content);
      showNotification(t('board_saved'), 'success');
    } catch (saveError) {
      console.log('BoardCanvasScreen: failed to save board.', saveError);
      showNotification(t('board_save_failed'), 'error');
    }
  }, [board, content, db, showNotification, t, userId]);

  const revert = useCallback(() => {
    setContent(savedContent);
  }, [savedContent]);

  useEffect(() => {
    if (!storyId || !board || board.id !== boardId) return;
    useBoardDraftStore.getState().remember({
      boardId: board.id,
      storyId,
      content,
      savedContent,
    });
  }, [board, boardId, content, savedContent, storyId]);

  useFocusEffect(
    useCallback(() => {
      setDocumentTitle(board?.name ?? t('boards_title'));
      navigation.getParent()?.setOptions({
        title: board?.name ?? t('boards_title'),
        headerRight: canEdit
          ? () => (
              <BoardCanvasHeaderActions
                dirty={dirty}
                layoutEditing={layoutEditing}
                onRevert={revert}
                onSave={() => void save()}
                onToggleLayout={() => {
                  setLayoutEditing((current) => !current);
                  setLayoutSelectedNodeId(null);
                }}
              />
            )
          : undefined,
      });
    }, [
      board?.name,
      canEdit,
      colors.primary,
      colors.text,
      colors.textSecondary,
      dirty,
      layoutEditing,
      navigation,
      revert,
      save,
      t,
    ]),
  );

  const titles = useMemo(() => {
    const map: Record<
      string,
      {
        title: string;
        typeLabel: string;
        appearanceType?: string;
        appearance?: { color: string; icon: string };
        ghost?: boolean;
      }
    > = {};
    for (const node of content.nodes) {
      const live =
        node.kind === 'entity' ? livePins[`${node.entityType}:${node.entityId}`] : undefined;
      const appearanceType = boardPinAppearanceType(
        node.kind,
        node.kind === 'entity' ? node.entityType : undefined,
        live?.group,
      );
      const worldPieceSection = worldPieceSectionFromBoardPinGroup(live?.group);
      const typeLabel = worldPieceSection
        ? t(`world_piece_section_${worldPieceSection}`)
        : t(
            boardPinTypeKey(
              node.kind,
              node.kind === 'entity' ? node.entityType : undefined,
              live?.group,
            ),
          );
      const appearance = getBoardPinAppearance(
        node.kind,
        node.kind === 'entity' ? node.entityType : undefined,
        live?.group,
      );
      if (node.kind === 'note') {
        map[node.id] = {
          title: node.title.trim() || t('board_note'),
          typeLabel,
          appearanceType,
          appearance,
        };
        continue;
      }
      map[node.id] = live
        ? { title: live.label, typeLabel, appearanceType, appearance }
        : {
            title: node.labelAtPin || t('board_deleted_entity'),
            typeLabel: `${typeLabel} · ${t('board_deleted_entity')}`,
            appearanceType,
            appearance,
            ghost: true,
          };
    }
    return map;
  }, [content.nodes, livePins, t]);

  const handleExport = useCallback(async () => {
    if (!selectedStory) return;
    setExporting(true);
    try {
      const svg = await buildStandaloneBoardSvg(content, {
        title: board?.name ?? t('boards_title'),
        subtitle: t('board_export_subtitle', {
          story: selectedStory.title,
          pinCount: content.nodes.length,
          edgeCount: content.edges.length,
        }),
        colors: {
          background: colors.background,
          surface: colors.surface,
          text: colors.text,
          textSecondary: colors.textSecondary,
          border: colors.border,
        },
        titles,
        galleryMediaById,
        summaries: summariesByNode,
      });
      const result = await deliverSvgMap(
        svg,
        buildBoardMapFileName(selectedStory.title, board?.name ?? 'board'),
      );
      if (result.delivered) {
        showNotification(t('board_export_success', { fileName: result.fileName }), 'success');
      } else {
        showNotification(
          t('story_map_export_no_share_target', { path: result.uri ?? result.fileName }),
          'warning',
        );
      }
    } catch (exportError) {
      console.log('BoardCanvasScreen: failed to export board.', exportError);
      showNotification(t('board_export_failed'), 'error');
    } finally {
      setExporting(false);
    }
  }, [
    board?.name,
    colors,
    content,
    galleryMediaById,
    selectedStory,
    showNotification,
    summariesByNode,
    t,
    titles,
  ]);

  const nodeTitles = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [id, meta] of Object.entries(titles)) map[id] = meta.title;
    return map;
  }, [titles]);

  const handleMoveNode = useCallback((id: string, x: number, y: number) => {
    setContent((current) => ({
      ...current,
      nodes: current.nodes.map((node) => (node.id === id ? { ...node, x, y } : node)),
    }));
  }, []);

  const handleResizeNode = useCallback((id: string, width: number, height: number) => {
    setContent((current) => ({
      ...current,
      nodes: current.nodes.map((node) =>
        node.id === id
          ? {
              ...node,
              width: Math.min(720, Math.max(148, width)),
              height: Math.min(720, Math.max(86, height)),
            }
          : node,
      ),
    }));
  }, []);

  const moveNodeLayer = useCallback((id: string, direction: 'front' | 'back') => {
    setContent((current) => {
      const levels = current.nodes.map((node) => node.zIndex ?? 0);
      const target =
        direction === 'front' ? Math.max(0, ...levels) + 1 : Math.min(0, ...levels) - 1;
      return {
        ...current,
        nodes: current.nodes.map((node) => (node.id === id ? { ...node, zIndex: target } : node)),
      };
    });
  }, []);

  const addEntities = (values: string[]) => {
    let created: BoardNodeType[] = [];
    setContent((current) => {
      let next = current;
      created = [];
      const origin = { x: 80, y: 80 };
      for (const value of values) {
        const decoded = decodeBoardPinValue(value);
        if (!decoded) continue;
        const option = options.find(
          (item) => item.entityType === decoded.entityType && item.entityId === decoded.entityId,
        );
        const existing = new Set([
          ...next.nodes.map((node) => node.id),
          ...next.edges.map((edge) => edge.id),
        ]);
        const position = nextStaggeredPosition(next, origin);
        const node: BoardNodeType = {
          id: generateBoardLocalId(existing),
          kind: 'entity',
          x: position.x,
          y: position.y,
          entityType: decoded.entityType as BoardPinEntity,
          entityId: decoded.entityId,
          labelAtPin: option?.label ?? decoded.entityId,
          displayMode: 'compact',
          cardNote: null,
        };
        created.push(node);
        next = { ...next, nodes: [...next.nodes, node] };
      }
      return next;
    });
    if (created.length === 1) {
      const pin = created[0];
      const name = pin.kind === 'entity' ? pin.labelAtPin : t('board_note');
      showNotification(t('board_pin_added', { name }), 'success');
    } else if (created.length > 1) {
      showNotification(t('board_pins_added', { count: created.length }), 'success');
    }
  };

  const addNote = () => {
    let created: BoardNodeType | null = null;
    setContent((current) => {
      const existing = new Set([
        ...current.nodes.map((node) => node.id),
        ...current.edges.map((edge) => edge.id),
      ]);
      const position = nextStaggeredPosition(current, { x: 120, y: 120 });
      created = {
        id: generateBoardLocalId(existing),
        kind: 'note',
        x: position.x,
        y: position.y,
        title: '',
        body: null,
      };
      return { ...current, nodes: [...current.nodes, created] };
    });
    if (created) setSelected(created);
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    tools: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    toolRow: { flexDirection: 'row', gap: 8 },
    toolControl: { flex: 1 },
  });

  if (loading) return <ScreenLoading message={t('loading')} padded />;
  if (error || !board) {
    return (
      <ScreenError
        message={error || t('board_not_found')}
        onGoBack={() => navigation.goBack()}
        padded
      />
    );
  }

  return (
    <View style={styles.container}>
      {canEdit && (
        <View style={styles.tools}>
          <View style={styles.toolRow}>
            <MultiSelectPill
              style={styles.toolControl}
              groups={groupedOptions}
              selectedValues={pickerValues}
              onSelectionChange={(values) => {
                const selectedValue = values[0];
                if (!selectedValue) {
                  setPickerValues([]);
                  return;
                }
                // A board picker is an action, not a persistent filter: every selection creates a
                // fresh pin, so the same entity must be immediately available for another pin.
                addEntities([selectedValue]);
                setPickerValues([selectedValue]);
                requestAnimationFrame(() => setPickerValues([]));
              }}
              placeholder={t('board_add_entity')}
              noOptionsText={t('board_no_entities')}
              singleSelect
            />
            <View style={styles.toolControl}>
              <Button onPress={addNote} style={{ height: 50 }}>
                {t('board_add_note')}
              </Button>
            </View>
          </View>
        </View>
      )}
      <BoardCanvas
        ref={canvasRef}
        content={content}
        titles={titles}
        selectedNodeId={layoutEditing ? layoutSelectedNodeId : null}
        layoutEditing={layoutEditing}
        galleryMediaById={galleryMediaById}
        summaries={summariesByNode}
        onSelectNode={(node) => {
          if (layoutEditing) setLayoutSelectedNodeId(node.id);
          else setSelected(node);
        }}
        onMoveNode={handleMoveNode}
        onResizeNode={handleResizeNode}
        onOpenNodeDetails={setSelected}
        onBringNodeToFront={(id) => moveNodeLayer(id, 'front')}
        onSendNodeToBack={(id) => moveNodeLayer(id, 'back')}
      />
      <GraphCanvasControls
        onZoomIn={() => canvasRef.current?.zoomBy(1.25)}
        onZoomOut={() => canvasRef.current?.zoomBy(0.8)}
        onFit={() => canvasRef.current?.fitToScreen()}
        onExport={() => void handleExport()}
        exporting={exporting}
        exportLabel={t('board_export')}
      />
      {selected && (
        <BoardNodeSheet
          node={content.nodes.find((node) => node.id === selected.id) ?? selected}
          title={titles[selected.id]?.title ?? selected.id}
          typeLabel={titles[selected.id]?.typeLabel ?? ''}
          ghost={!!titles[selected.id]?.ghost}
          summary={selectedSummary}
          content={content}
          nodeTitles={nodeTitles}
          canEdit={canEdit}
          onClose={() => setSelected(null)}
          onChangeContent={setContent}
          onChangeNote={(title, body) => {
            setContent((current) => ({
              ...current,
              nodes: current.nodes.map((node) =>
                node.id === selected.id && node.kind === 'note' ? { ...node, title, body } : node,
              ),
            }));
          }}
          onChangeEntityPresentation={(displayMode, cardNote) => {
            setContent((current) => ({
              ...current,
              nodes: current.nodes.map((node) =>
                node.id === selected.id && node.kind === 'entity'
                  ? { ...node, displayMode, cardNote }
                  : node,
              ),
            }));
          }}
          onOpenEntity={() => {
            if (selected.kind !== 'entity') return;
            setSelected(null);
            if (selected.entityType === 'Board') {
              navigation.navigate('BoardCanvas', { boardId: selected.entityId });
              return;
            }
            if (selected.entityType === 'Gallery') {
              navigation.getParent()?.navigate('GalleryStack', {
                screen: 'GalleryDetail',
                params: { galleryId: selected.entityId },
              });
              return;
            }
            const type = toNavigableEntityType(selected.entityType);
            if (!type) return;
            navigateToEntity(type as NavigableEntityType, selected.entityId);
          }}
        />
      )}
    </View>
  );
};

export default BoardCanvasScreen;
