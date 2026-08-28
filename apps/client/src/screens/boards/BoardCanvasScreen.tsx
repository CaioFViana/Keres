import { Ionicons } from '@expo/vector-icons';
import type {
  BoardContentType,
  BoardNodeType,
  BoardPinEntity,
} from '@keres/shared';
import { generateBoardLocalId } from '@keres/shared';
import type { RouteProp } from '@react-navigation/native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import BoardCanvas from '@/src/components/features/boards/BoardCanvas';
import type { BoardCanvasHandle } from '@/src/components/features/boards/BoardCanvas';
import BoardNodeSheet from '@/src/components/features/boards/BoardNodeSheet';
import GraphCanvasControls from '@/src/components/features/graphs/GraphCanvasControls/GraphCanvasControls';
import { useDrizzle } from '../../db';
import type { BoardSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useBoardPinOptions, decodeBoardPinValue } from '../../hooks/useBoardPinOptions';
import { useNavigateToEntityDetail } from '../../hooks/useNavigateToEntityDetail';
import { useStoryRole } from '../../hooks/useStoryRole';
import type { BoardStackParamList } from '../../navigation/MainSystemStack';
import { createBoardService } from '../../services/storymanagement/BoardService';
import { useBoardDraftStore } from '../../state/boardDraftStore';
import { useNotificationStore } from '../../state/notificationStore';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { nextStaggeredPosition } from '../../utils/boardLayout';
import { boardPinTypeKey } from '../../utils/boardPinAppearance';
import { renderBoardSvg } from '../../utils/boardSvg';
import { setDocumentTitle } from '../../utils/documentTitle';
import { buildBoardMapFileName, deliverSvgMap } from '../../utils/storyTransfer';
import type { NavigableEntityType } from '../../utils/entityNavigation';
import { toNavigableEntityType } from '../../utils/entityNavigation';

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
  const { groupedOptions, options } = useBoardPinOptions(storyId);
  const canvasRef = useRef<BoardCanvasHandle>(null);

  const [board, setBoard] = useState<BoardSelect | null>(null);
  const [content, setContent] = useState<BoardContentType>({ nodes: [], edges: [] });
  const [savedContent, setSavedContent] = useState<BoardContentType>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<BoardNodeType | null>(null);
  const [pickerValues, setPickerValues] = useState<string[]>([]);
  const [liveNames, setLiveNames] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState(false);

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
    const names: Record<string, string> = {};
    for (const option of options) {
      names[`${option.entityType}:${option.entityId}`] = option.label;
    }
    setLiveNames(names);
  }, [options]);

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
              <View style={{ flexDirection: 'row', marginRight: 12, gap: 14 }}>
                <TouchableOpacity onPress={revert} disabled={!dirty} accessibilityLabel={t('board_revert')}>
                  <Ionicons
                    name="arrow-undo-outline"
                    size={24}
                    color={dirty ? colors.text : colors.textSecondary}
                  />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => void save()} disabled={!dirty} accessibilityLabel={t('board_save')}>
                  <Ionicons
                    name="checkmark-outline"
                    size={26}
                    color={dirty ? colors.primary : colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            )
          : undefined,
      });
    }, [board?.name, canEdit, colors.primary, colors.text, colors.textSecondary, dirty, navigation, revert, save, t]),
  );

  const titles = useMemo(() => {
    const map: Record<string, { title: string; typeLabel: string; ghost?: boolean }> = {};
    for (const node of content.nodes) {
      const typeLabel = t(
        boardPinTypeKey(node.kind, node.kind === 'entity' ? node.entityType : undefined),
      );
      if (node.kind === 'note') {
        map[node.id] = { title: node.title.trim() || t('board_note'), typeLabel };
        continue;
      }
      const live = liveNames[`${node.entityType}:${node.entityId}`];
      map[node.id] = live
        ? { title: live, typeLabel }
        : {
            title: node.labelAtPin || t('board_deleted_entity'),
            typeLabel: `${typeLabel} · ${t('board_deleted_entity')}`,
            ghost: true,
          };
    }
    return map;
  }, [content.nodes, liveNames, t]);

  const handleExport = useCallback(async () => {
    if (!selectedStory) return;
    setExporting(true);
    try {
      const svg = renderBoardSvg(content, {
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
  }, [board?.name, colors, content, selectedStory, showNotification, t, titles]);

  const nodeTitles = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [id, meta] of Object.entries(titles)) map[id] = meta.title;
    return map;
  }, [titles]);

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
        };
        created.push(node);
        next = { ...next, nodes: [...next.nodes, node] };
      }
      return next;
    });
    const last = created[created.length - 1];
    if (last) setSelected(last);
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
  });

  if (loading) return <ScreenLoading message={t('loading')} padded />;
  if (error || !board) {
    return <ScreenError message={error || t('board_not_found')} onGoBack={() => navigation.goBack()} padded />;
  }

  return (
    <View style={styles.container}>
      {canEdit && (
        <View style={styles.tools}>
          <MultiSelectPill
            groups={groupedOptions}
            selectedValues={pickerValues}
            onSelectionChange={(values) => {
              const added = values.filter((value) => !pickerValues.includes(value));
              if (added.length > 0) addEntities(added);
              setPickerValues(values);
            }}
            placeholder={t('board_add_entity')}
            noOptionsText={t('board_no_entities')}
          />
          <TouchableOpacity
            onPress={addNote}
            style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}
            accessibilityLabel={t('board_add_note')}
          >
            <Ionicons name="create-outline" size={18} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 14 }}>{t('board_add_note')}</Text>
          </TouchableOpacity>
        </View>
      )}
      <BoardCanvas
        ref={canvasRef}
        content={content}
        titles={titles}
        selectedNodeId={selected?.id ?? null}
        onSelectNode={setSelected}
        onMoveNode={(id, x, y) =>
          setContent((current) => ({
            ...current,
            nodes: current.nodes.map((node) => (node.id === id ? { ...node, x, y } : node)),
          }))
        }
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
          onOpenEntity={() => {
            if (selected.kind !== 'entity') return;
            setSelected(null);
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
