import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import type { SketchCanvasHandle } from '@/src/components/features/sketches/SketchCanvas';
import SketchCanvas from '@/src/components/features/sketches/SketchCanvas';
import SketchCanvasHeaderActions from '@/src/components/features/sketches/SketchCanvasHeaderActions';
import SketchCanvasTools from '@/src/components/features/sketches/SketchCanvasTools';
import SketchExportSheet from '@/src/components/features/sketches/SketchExportSheet';
import SketchLayerSheet, {
  SKETCH_BASE_LAYER_KEY,
} from '@/src/components/features/sketches/SketchLayerSheet';
import SketchPageSheet from '@/src/components/features/sketches/SketchPageSheet';
import SketchPresetPicker from '@/src/components/features/sketches/SketchPresetPicker';
import OverlaySheet from '@/src/components/features/graphs/CanvasOverlay/OverlaySheet';
import OverlayDrawBar from '@/src/components/features/graphs/CanvasOverlay/OverlayDrawBar';
import type {
  SketchContentType,
  SketchLayerType,
} from '@keres/shared';
import {
  generateSketchLocalId,
  MAX_SKETCH_LAYERS,
  validateSketchContent,
} from '@keres/shared';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View } from 'react-native';
import { useDrizzle } from '../../db';
import type { SketchSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useCanvasHistory } from '../../hooks/useCanvasHistory';
import { useCanvasOverlayActions } from '../../hooks/useCanvasOverlayActions';
import { useStoryRole } from '../../hooks/useStoryRole';
import type { OverlayDrawTool } from '../../components/features/graphs/CanvasOverlay/overlayTools';
import { useScreenTour } from '../../guides/useScreenTour';
import type { SketchStackParamList } from '../../navigation/MainSystemStack';
import { createGalleryService } from '../../services/storymanagement/GalleryService';
import { createSketchService } from '../../services/storymanagement/SketchService';
import { mediaFileService } from '../../services/MediaFileService';
import { useSketchDraftStore } from '../../state/sketchDraftStore';
import { useNotificationStore } from '../../state/notificationStore';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { renderSketchSvg } from '../../utils/sketchSvg';
import {
  buildSketchFileName,
  deliverMapExport,
  deliverSvgMap,
} from '../../utils/storyTransfer';
import { fitRasterSize, rasterizeMapSvg } from '../../utils/svgRaster';

const EMPTY_CONTENT: SketchContentType = {
  page: { width: 794, height: 1123, preset: 'a4' },
  layers: [],
  overlays: [],
};

const SketchCanvasScreen = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<SketchStackParamList, 'SketchCanvas'>>();
  const { sketchId } = useRoute<RouteProp<SketchStackParamList, 'SketchCanvas'>>().params;
  const db = useDrizzle();
  const selectedStory = useStoryStore((state) => state.selectedStory);
  const storyId = selectedStory?.id;
  const { canEdit } = useStoryRole(storyId);
  const { userId } = useUserSettingsStore();
  const { showNotification } = useNotificationStore();
  const canvasRef = useRef<SketchCanvasHandle>(null);

  const [sketch, setSketch] = useState<SketchSelect | null>(null);
  const history = useCanvasHistory<SketchContentType>(EMPTY_CONTENT);
  const { value: content, set: setContent, reset: resetContent, undo, redo, canUndo, canRedo } = history;
  const [savedContent, setSavedContent] = useState<SketchContentType>(EMPTY_CONTENT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [showPresets, setShowPresets] = useState(false);
  const [showPage, setShowPage] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [busy, setBusy] = useState(false);
  const [canvasRotation, setCanvasRotation] = useState(0);

  const generateOverlayId = useCallback(() => {
    const existing = new Set([
      ...(content.overlays ?? []).map((overlay) => overlay.id),
      ...content.layers.map((layer) => layer.id),
    ]);
    return generateSketchLocalId(existing);
  }, [content]);
  const overlayActions = useCanvasOverlayActions({
    setContent,
    generateOverlayId,
    activeLayerId,
  });

  const dirty = JSON.stringify(content) !== JSON.stringify(savedContent);

  useBackButtonHandler({
    showWebBackButton: true,
    onBack: () => navigation.goBack(),
  });
  useScreenTour('SketchCanvas', canEdit);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const row = await createSketchService(db).getById(sketchId);
      if (!row || row.isDeleted) {
        setError(t('sketch_not_found'));
        setSketch(null);
        return;
      }
      const keep = storyId ? await useSketchDraftStore.getState().hydrate(storyId, sketchId) : null;
      setSketch(row);
      if (keep && keep.sketchId === sketchId && keep.storyId === storyId) {
        resetContent(keep.content);
        setSavedContent(row.content);
        const savedChangedSinceDraft =
          JSON.stringify(row.content) !== JSON.stringify(keep.savedContent);
        showNotification(
          t(savedChangedSinceDraft ? 'canvas_draft_conflicts_with_saved' : 'canvas_draft_restored'),
          savedChangedSinceDraft ? 'warning' : 'info',
        );
      } else {
        resetContent(row.content);
        setSavedContent(row.content);
      }
      setActiveLayerId(null);
      setError(null);
    } catch (loadError) {
      console.log('SketchCanvasScreen: failed to load sketch.', loadError);
      setError(t('sketch_load_failed'));
    } finally {
      setLoading(false);
    }
  }, [db, resetContent, showNotification, sketchId, storyId, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- `load` sets loading synchronously for its event callers and everything else after `await`; the rule cannot verify across the callback boundary.
    void load();
  }, [load]);

  const save = useCallback(async () => {
    if (!userId || !sketch) return;
    try {
      const validated = validateSketchContent(content);
      const updated = await createSketchService(db).updateSketch(userId, sketch.id, {
        content: validated,
      });
      setSketch(updated);
      setSavedContent(updated.content);
      showNotification(t('sketch_saved'), 'success');
    } catch (saveError) {
      console.log('SketchCanvasScreen: failed to save sketch.', saveError);
      showNotification(t('sketch_save_failed'), 'error');
    }
  }, [content, db, showNotification, sketch, t, userId]);

  const revert = useCallback(() => {
    resetContent(savedContent);
    overlayActions.cancelInteraction();
  }, [overlayActions, resetContent, savedContent]);

  useEffect(() => {
    if (!storyId || !sketch || sketch.id !== sketchId) return;
    useSketchDraftStore.getState().remember({
      sketchId: sketch.id,
      storyId,
      content,
      savedContent,
    });
  }, [content, savedContent, sketch, sketchId, storyId]);

  // Ctrl/Cmd+Z / Ctrl+Shift+Z / Ctrl+Y on desktop web. Skipped inside text fields so
  // typing keeps the platform's own undo.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [redo, undo]);

  useScreenHeader({
    target: 'parent',
    title: sketch?.name ?? t('sketches_title'),
    renderActions: useCallback(
      () =>
        canEdit ? (
          <SketchCanvasHeaderActions dirty={dirty} onRevert={revert} onSave={() => void save()} />
        ) : null,
      [canEdit, dirty, revert, save],
    ),
  });

  const overlayCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const overlay of content.overlays ?? []) {
      const key = overlay.layerId ?? SKETCH_BASE_LAYER_KEY;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [content.overlays]);

  const handleAddLayer = useCallback(() => {
    if (content.layers.length >= MAX_SKETCH_LAYERS) return;
    setContent((current) => {
      const existing = new Set([
        ...current.layers.map((layer) => layer.id),
        ...(current.overlays ?? []).map((overlay) => overlay.id),
      ]);
      const layer: SketchLayerType = {
        id: generateSketchLocalId(existing),
        name: t('sketch_layer_default_name', { count: current.layers.length + 1 }),
        visible: true,
        opacity: 1,
      };
      return { ...current, layers: [...current.layers, layer] };
    });
  }, [content.layers.length, setContent, t]);

  const handleDeleteLayer = useCallback(
    (layerId: string) => {
      setContent((current) => ({
        ...current,
        layers: current.layers.filter((layer) => layer.id !== layerId),
        overlays: (current.overlays ?? []).filter((overlay) => overlay.layerId !== layerId),
      }));
      if (activeLayerId === layerId) setActiveLayerId(null);
      overlayActions.cancelInteraction();
    },
    [activeLayerId, overlayActions, setContent],
  );

  const handleApplyPage = useCallback(
    (page: { width: number; height: number; preset: string | null }) => {
      setContent((current) => ({ ...current, page }));
    },
    [setContent],
  );

  const exportColors = useMemo(
    () => ({
      background: colors.background,
      surface: colors.surface,
      text: colors.text,
      textSecondary: colors.textSecondary,
      border: colors.border,
      primary: colors.primary,
    }),
    [colors],
  );

  const buildSvg = useCallback(() => {
    const validated = validateSketchContent(content);
    return renderSketchSvg(validated, {
      title: sketch?.name ?? t('sketches_title'),
      colors: exportColors,
      paper: colors.surface,
    });
  }, [colors.surface, content, exportColors, sketch?.name, t]);

  const handleExportSvg = useCallback(async () => {
    if (!sketch) return;
    setBusy(true);
    try {
      const result = await deliverSvgMap(
        buildSvg(),
        buildSketchFileName(sketch.name, 'svg'),
      );
      if (result.delivered) {
        showNotification(t('sketch_export_success', { fileName: result.fileName }), 'success');
      } else {
        showNotification(
          t('story_map_export_no_share_target', { path: result.uri ?? result.fileName }),
          'warning',
        );
      }
    } catch (exportError) {
      console.log('SketchCanvasScreen: failed to export sketch SVG.', exportError);
      showNotification(t('sketch_export_failed'), 'error');
    } finally {
      setBusy(false);
      setShowExport(false);
    }
  }, [buildSvg, showNotification, sketch, t]);

  const handleExportPng = useCallback(async () => {
    if (!sketch) return;
    setBusy(true);
    try {
      const result = await deliverMapExport(
        buildSvg(),
        buildSketchFileName(sketch.name, 'png'),
        useUserSettingsStore.getState().exportFormat,
      );
      if (result.delivered) {
        showNotification(t('sketch_export_success', { fileName: result.fileName }), 'success');
      } else {
        showNotification(
          t('story_map_export_no_share_target', { path: result.uri ?? result.fileName }),
          'warning',
        );
      }
    } catch (exportError) {
      console.log('SketchCanvasScreen: failed to export sketch PNG.', exportError);
      showNotification(t('sketch_export_failed'), 'error');
    } finally {
      setBusy(false);
      setShowExport(false);
    }
  }, [buildSvg, showNotification, sketch, t]);

  /**
   * Rasterizes the page and stores it as a gallery image, linked as the sketch's cover:
   * outside the canvas the sketch reads as that image. Re-saving replaces the cover row's
   * link... a byte-identical drawing reuses the same file and row by hash.
   */
  const handleSaveToGallery = useCallback(async () => {
    if (!sketch || !storyId || !userId) return;
    setBusy(true);
    try {
      const svg = buildSvg();
      const pixels = fitRasterSize(content.page.width, content.page.height);
      const bytes = await rasterizeMapSvg(svg, pixels.width, pixels.height);
      const snapshot = await mediaFileService.saveSnapshot(storyId, 'image/png', bytes);
      const galleryService = createGalleryService(db);
      const existing = await galleryService.getByHash(storyId, snapshot.hash);
      const row =
        existing ??
        (await galleryService.createGallery(userId, {
          storyId,
          mediaType: 'image',
          mimeType: 'image/png',
          fileName: buildSketchFileName(sketch.name, 'png'),
          hash: snapshot.hash,
          sizeBytes: snapshot.sizeBytes,
          localPath: snapshot.localPath,
          title: sketch.name,
        }));
      const updated = await createSketchService(db).updateSketch(userId, sketch.id, {
        coverGalleryId: row.id,
      });
      setSketch(updated);
      showNotification(t('sketch_gallery_saved'), 'success');
    } catch (snapshotError) {
      console.log('SketchCanvasScreen: failed to save sketch to gallery.', snapshotError);
      showNotification(t('sketch_gallery_save_failed'), 'error');
    } finally {
      setBusy(false);
      setShowExport(false);
    }
  }, [buildSvg, content.page.height, content.page.width, db, showNotification, sketch, storyId, t, userId]);

  const sheetOverlay =
    (content.overlays ?? []).find((overlay) => overlay.id === overlayActions.sheetOverlayId) ??
    null;

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
  });

  if (loading) return <ScreenLoading message={t('loading')} padded />;
  if (error || !sketch) {
    return (
      <ScreenError
        message={error || t('sketch_not_found')}
        onGoBack={() => navigation.goBack()}
        padded
      />
    );
  }

  const drawTool: OverlayDrawTool | null = overlayActions.drawTool;

  return (
    <View style={styles.container}>
      {canEdit && (
        <SketchCanvasTools
          drawTool={drawTool}
          selectMode={overlayActions.selectMode}
          canEdit={canEdit}
          canUndo={canUndo}
          canRedo={canRedo}
          rotationActive={canvasRotation !== 0}
          onSelectMode={() => overlayActions.handleObjectsAction('select')}
          onDrawTool={(tool) => overlayActions.handleObjectsAction(`draw:${tool}`)}
          onOpenPresets={() => setShowPresets(true)}
          onUndo={undo}
          onRedo={redo}
          onResetRotation={() => canvasRef.current?.resetRotation()}
          onOpenLayers={() => setShowLayers(true)}
          onOpenPage={() => setShowPage(true)}
        />
      )}
      {canEdit && drawTool && drawTool !== 'stamp' && drawTool !== 'freehand' && drawTool !== 'text' && (
        <OverlayDrawBar
          tool={drawTool}
          canFinish={overlayActions.canFinish}
          onFinish={overlayActions.finishDraft}
          onCancel={overlayActions.cancelDraw}
        />
      )}
      {canEdit && (drawTool === 'stamp' || drawTool === 'freehand' || drawTool === 'text') && (
        <OverlayDrawBar
          tool={drawTool}
          canFinish={false}
          onFinish={overlayActions.cancelDraw}
          onCancel={overlayActions.cancelDraw}
        />
      )}
      <SketchCanvas
        ref={canvasRef}
        content={content}
        interactionMode={overlayActions.interactionMode}
        draft={overlayActions.draft}
        drawTool={drawTool}
        selectedOverlayId={overlayActions.selectedOverlayId}
        overlayCallbacks={overlayActions}
        onFreehandCommit={overlayActions.commitFreehand}
        onPlaceText={overlayActions.placeText}
        onZoomIn={() => canvasRef.current?.zoomBy(1.25)}
        onZoomOut={() => canvasRef.current?.zoomBy(0.8)}
        onFit={() => canvasRef.current?.fitToScreen()}
        onExport={() => setShowExport(true)}
        onRotationChange={setCanvasRotation}
      />
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
      {showPresets && (
        <SketchPresetPicker
          onPick={(tool) => overlayActions.handleObjectsAction(tool)}
          onClose={() => setShowPresets(false)}
        />
      )}
      {showPage && (
        <SketchPageSheet
          page={content.page}
          onApply={handleApplyPage}
          onClose={() => setShowPage(false)}
        />
      )}
      {showLayers && (
        <SketchLayerSheet
          layers={content.layers}
          activeLayerId={activeLayerId}
          canEdit={canEdit}
          overlayCounts={overlayCounts}
          onSelectActive={setActiveLayerId}
          onAdd={handleAddLayer}
          onRename={(layerId, name) =>
            setContent((current) => ({
              ...current,
              layers: current.layers.map((layer) =>
                layer.id === layerId ? { ...layer, name } : layer,
              ),
            }))
          }
          onToggleVisible={(layerId) =>
            setContent((current) => ({
              ...current,
              layers: current.layers.map((layer) =>
                layer.id === layerId ? { ...layer, visible: !layer.visible } : layer,
              ),
            }))
          }
          onSetOpacity={(layerId, opacity) =>
            setContent((current) => ({
              ...current,
              layers: current.layers.map((layer) =>
                layer.id === layerId ? { ...layer, opacity } : layer,
              ),
            }))
          }
          onDelete={handleDeleteLayer}
          onClose={() => setShowLayers(false)}
        />
      )}
      {showExport && (
        <SketchExportSheet
          hasCover={sketch.coverGalleryId !== null}
          busy={busy}
          onExportSvg={() => void handleExportSvg()}
          onExportPng={() => void handleExportPng()}
          onSaveToGallery={() => void handleSaveToGallery()}
          onClose={() => setShowExport(false)}
        />
      )}
    </View>
  );
};

export default SketchCanvasScreen;
