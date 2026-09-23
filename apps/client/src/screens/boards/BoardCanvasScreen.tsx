import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import type { BoardCanvasHandle } from '@/src/components/features/boards/BoardCanvas';
import BoardCanvas from '@/src/components/features/boards/BoardCanvas';
import BoardCanvasHeaderActions from '@/src/components/features/boards/BoardCanvasHeaderActions';
import BoardCanvasTools from '@/src/components/features/boards/BoardCanvasTools';
import BoardConnectionModal from '@/src/components/features/boards/BoardConnectionModal';
import BoardNodeSheet from '@/src/components/features/boards/BoardNodeSheet';
import OverlaySheet from '@/src/components/features/graphs/CanvasOverlay/OverlaySheet';
import GraphCanvasControls from '@/src/components/features/graphs/GraphCanvasControls/GraphCanvasControls';
import type { BoardContentType, BoardNodeType, BoardPinEntity } from '@keres/shared';
import { generateBoardLocalId } from '@keres/shared';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useDrizzle } from '../../db';
import type { BoardSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useScreenTour } from '../../guides/useScreenTour';
import { useBoardCanvasLayout } from '../../hooks/useBoardCanvasLayout';
import { useCanvasOverlayActions } from '../../hooks/useCanvasOverlayActions';
import { useBoardNodeTitles } from '../../hooks/useBoardNodeTitles';
import { decodeBoardPinValue, useBoardPinOptions } from '../../hooks/useBoardPinOptions';
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
import { galleryMediaForNode, nextStaggeredPosition } from '../../utils/boardLayout';
import type { NavigableEntityType } from '../../utils/entityNavigation';
import { toNavigableEntityType } from '../../utils/entityNavigation';
import { buildBoardMapFileName, deliverMapExport } from '../../utils/storyTransfer';
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
  const [connectionMode, setConnectionMode] = useState(false);
  const [connectionPair, setConnectionPair] = useState<{ from: string; to: string } | null>(null);
  const [pickerValues, setPickerValues] = useState<string[]>([]);
  const { titles, nodeTitles } = useBoardNodeTitles(content.nodes, options);
  const [exporting, setExporting] = useState(false);
  const [galleryMediaById, setGalleryMediaById] = useState<BoardGalleryMediaById>({});
  const [selectedSummary, setSelectedSummary] = useState<BoardEntitySummary | null>(null);
  const [summariesByNode, setSummariesByNode] = useState<Record<string, BoardEntitySummary | null>>(
    {},
  );
  const { handleMoveNode, handleResizeNode, moveNodeLayer } = useBoardCanvasLayout(setContent);

  const addNote = () => {
    let created: BoardNodeType | null = null;
    setContent((current) => {
      const existing = new Set([
        ...current.nodes.map((node) => node.id),
        ...current.edges.map((edge) => edge.id),
      ]);
      const center = canvasRef.current?.viewportWorldCenter() ?? { x: 200, y: 160 };
      const position = nextStaggeredPosition(current, { x: center.x - 110, y: center.y - 40 });
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

  const generateOverlayId = useCallback(
    () =>
      generateBoardLocalId(
        new Set([
          ...content.nodes.map((node) => node.id),
          ...content.edges.map((edge) => edge.id),
          ...(content.overlays ?? []).map((overlay) => overlay.id),
        ]),
      ),
    [content],
  );
  const overlayActions = useCanvasOverlayActions({
    setContent,
    generateOverlayId,
    onAddNote: addNote,
  });

  const dirty = JSON.stringify(content) !== JSON.stringify(savedContent);

  useBackButtonHandler({
    showWebBackButton: true,
    onBack: () => navigation.goBack(),
  });
  useScreenTour('BoardCanvas', canEdit);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const row = await createBoardService(db).getById(boardId);
      if (!row || row.isDeleted) {
        setError(t('board_not_found'));
        setBoard(null);
        return;
      }
      const keep = storyId ? await useBoardDraftStore.getState().hydrate(storyId, boardId) : null;
      setBoard(row);
      if (keep && keep.boardId === boardId && keep.storyId === storyId) {
        setContent(keep.content);
        setSavedContent(row.content);
        const savedChangedSinceDraft =
          JSON.stringify(row.content) !== JSON.stringify(keep.savedContent);
        showNotification(
          t(savedChangedSinceDraft ? 'canvas_draft_conflicts_with_saved' : 'canvas_draft_restored'),
          savedChangedSinceDraft ? 'warning' : 'info',
        );
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
  }, [boardId, db, showNotification, storyId, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- `load` sets loading synchronously for its event callers and everything else after `await`; the rule cannot verify across the callback boundary.
    void load();
  }, [load]);

  const [prevStoryId, setPrevStoryId] = useState(storyId);
  if (storyId !== prevStoryId) {
    setPrevStoryId(storyId);
    if (!storyId) {
      setGalleryMediaById({});
    }
  }

  useEffect(() => {
    if (!storyId) {
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

  const [prevDb, setPrevDb] = useState(db);
  const [prevSelected, setPrevSelected] = useState(selected);
  if (db !== prevDb || selected !== prevSelected) {
    setPrevDb(db);
    setPrevSelected(selected);
    setSelectedSummary(null);
  }

  useEffect(() => {
    let cancelled = false;
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

  useScreenHeader({
    target: 'parent',
    title: board?.name ?? t('boards_title'),
    renderActions: useCallback(
      () =>
        canEdit ? (
          <BoardCanvasHeaderActions dirty={dirty} onRevert={revert} onSave={() => void save()} />
        ) : null,
      [canEdit, dirty, revert, save],
    ),
  });

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
          primary: colors.primary,
        },
        titles,
        galleryMediaById,
        summaries: summariesByNode,
      });
      const result = await deliverMapExport(
        svg,
        buildBoardMapFileName(selectedStory.title, board?.name ?? 'board'),
        useUserSettingsStore.getState().exportFormat,
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

  const addEntities = (values: string[]) => {
    let created: BoardNodeType[] = [];
    setContent((current) => {
      let next = current;
      created = [];
      const center = canvasRef.current?.viewportWorldCenter() ?? { x: 160, y: 160 };
      const origin = { x: center.x - 80, y: center.y - 40 };
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

  const handlePickEntity = (values: string[]) => {
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
  };

  const sheetOverlay =
    (content.overlays ?? []).find((overlay) => overlay.id === overlayActions.sheetOverlayId) ??
    null;

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
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
        <BoardCanvasTools
          groupedOptions={groupedOptions}
          pickerValues={pickerValues}
          onPickEntity={handlePickEntity}
          onAddNote={addNote}
          onObjectsAction={overlayActions.handleObjectsAction}
          drawTool={overlayActions.drawTool}
          canFinish={overlayActions.canFinish}
          onFinishDraw={overlayActions.finishDraft}
          onCancelDraw={overlayActions.cancelDraw}
          layoutEditing={layoutEditing}
          connectionMode={connectionMode}
          overlayEditing={overlayActions.selectMode}
          onToggleLayout={() => {
            setLayoutEditing((current) => !current);
            setConnectionMode(false);
            overlayActions.cancelSelect();
            setLayoutSelectedNodeId(null);
          }}
          onToggleConnectionMode={() => {
            setConnectionMode((current) => !current);
            setLayoutEditing(false);
            overlayActions.cancelSelect();
            setLayoutSelectedNodeId(null);
          }}
          onToggleOverlayEdit={() => {
            if (overlayActions.selectMode) {
              overlayActions.cancelInteraction();
              return;
            }
            overlayActions.handleObjectsAction('select');
            setLayoutEditing(false);
            setConnectionMode(false);
            setLayoutSelectedNodeId(null);
          }}
        />
      )}
      <BoardCanvas
        ref={canvasRef}
        content={content}
        titles={titles}
        selectedNodeId={layoutEditing ? layoutSelectedNodeId : null}
        layoutEditing={layoutEditing}
        connectionMode={connectionMode}
        overlayEditing={overlayActions.selectMode}
        galleryMediaById={galleryMediaById}
        summaries={summariesByNode}
        onSelectNode={(node) => {
          overlayActions.cancelInteraction();
          if (layoutEditing) setLayoutSelectedNodeId(node.id);
          else setSelected(node);
        }}
        onMoveNode={handleMoveNode}
        onResizeNode={handleResizeNode}
        onOpenNodeDetails={setSelected}
        onBringNodeToFront={(id) => moveNodeLayer(id, 'front')}
        onSendNodeToBack={(id) => moveNodeLayer(id, 'back')}
        onConnectNodes={(from, to) => setConnectionPair({ from, to })}
        interactionMode={overlayActions.interactionMode}
        draft={overlayActions.draft}
        selectedOverlayId={overlayActions.selectedOverlayId}
        overlayCallbacks={overlayActions}
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
          galleryMedia={galleryMediaForNode(selected, galleryMediaById)}
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
      {connectionPair && (
        <BoardConnectionModal
          pair={connectionPair}
          nodeTitles={nodeTitles}
          setContent={setContent}
          onClose={() => setConnectionPair(null)}
        />
      )}
      {sheetOverlay && (
        <OverlaySheet
          overlay={sheetOverlay}
          canEdit={canEdit}
          defaultColor={colors.text}
          onChange={(patch) => overlayActions.updateOverlay(sheetOverlay.id, patch)}
          onRemove={() => overlayActions.deleteOverlay(sheetOverlay.id)}
          onClose={overlayActions.closeOverlaySheet}
        />
      )}
    </View>
  );
};

export default BoardCanvasScreen;
