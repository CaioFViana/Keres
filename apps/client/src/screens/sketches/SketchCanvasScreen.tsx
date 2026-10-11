import {
  clearLayer,
  decodeSketchDocument,
  duplicateLayer,
  encodeSketchDocument,
  findLayer,
  mergeLayerDown,
  moveLayer,
  patchLayer,
  quantizeSketchAlpha,
  removeLayer,
  addLayer,
  allLayerIds,
  generateSketchLocalId,
  setLayerItems,
  validateSketchContent,
  type SketchBrushId,
  type SketchDocument,
} from '@keres/shared';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View } from 'react-native';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import GraphCanvasControls from '@/src/components/features/graphs/GraphCanvasControls/GraphCanvasControls';
import OverlaySheet from '@/src/components/features/graphs/CanvasOverlay/OverlaySheet';
import type { SketchCanvasHandle } from '@/src/components/features/sketches/SketchCanvas';
import SketchCanvas from '@/src/components/features/sketches/SketchCanvas';
import SketchCanvasHeaderActions from '@/src/components/features/sketches/SketchCanvasHeaderActions';
import SketchCanvasTools from '@/src/components/features/sketches/SketchCanvasTools';
import SketchColorSheet from '@/src/components/features/sketches/SketchColorSheet';
import SketchExportSheet from '@/src/components/features/sketches/SketchExportSheet';
import SketchLayerSheet from '@/src/components/features/sketches/SketchLayerSheet';
import SketchOptionsBar from '@/src/components/features/sketches/SketchOptionsBar';
import SketchPageSheet from '@/src/components/features/sketches/SketchPageSheet';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { useDrizzle } from '../../db';
import type { SketchSelect } from '../../db/schema';
import { useScreenTour } from '../../guides/useScreenTour';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useCanvasHistory } from '../../hooks/useCanvasHistory';
import { useCanvasOverlayActions } from '../../hooks/useCanvasOverlayActions';
import { useSketchDrawing } from '../../hooks/useSketchDrawing';
import { useSketchExport } from '../../hooks/useSketchExport';
import { useSketchSelection } from '../../hooks/useSketchSelection';
import { useStoryRole } from '../../hooks/useStoryRole';
import type { SketchStackParamList } from '../../navigation/MainSystemStack';
import { createSketchService } from '../../services/storymanagement/SketchService';
import { useNotificationStore } from '../../state/notificationStore';
import { useSketchDraftStore } from '../../state/sketchDraftStore';
import { isObjectTool, useSketchToolStore, type SketchTool } from '../../state/sketchToolStore';
import { useHeaderBackActionStore } from '../../state/headerBackActionStore';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { type ThemeColors, useTheme } from '../../theme';
import { useThemedStyles } from '../../theme/useThemedStyles';

/** Placeholder until the row loads; never rendered or saved. */
const EMPTY_DOC: SketchDocument = {
  page: { width: 794, height: 1123, preset: 'a4', background: 'paper' },
  layers: [{ id: '00000000', name: '-', visible: true, opacity: 1, locked: false, items: [] }],
  overlays: [],
};

/** Snapshots share their items, so a deep history costs little; whole-reference equality is the dedupe. */
const sameDocument = (left: unknown, right: unknown) => left === right;
const HISTORY_LIMIT = 300;

const SketchCanvasScreen = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<SketchStackParamList, 'SketchCanvas'>>();
  const { sketchId } = useRoute<RouteProp<SketchStackParamList, 'SketchCanvas'>>().params;
  const db = useDrizzle();
  const selectedStory = useStoryStore((state) => state.selectedStory);
  const storyId = selectedStory?.id;
  const { canEdit } = useStoryRole(storyId);
  const { userId } = useUserSettingsStore();
  const { showNotification } = useNotificationStore();
  const canvasRef = useRef<SketchCanvasHandle>(null);

  const tool = useSketchToolStore((state) => state.tool);
  const brush = useSketchToolStore((state) => state.brush);
  const color = useSketchToolStore((state) => state.color);
  const alphaByBrush = useSketchToolStore((state) => state.alphaByBrush);
  const sizeByBrush = useSketchToolStore((state) => state.sizeByBrush);
  const eraserSize = useSketchToolStore((state) => state.eraserSize);
  const recentColors = useSketchToolStore((state) => state.recentColors);
  const setTool = useSketchToolStore((state) => state.setTool);
  const setColor = useSketchToolStore((state) => state.setColor);
  const activeTool: SketchTool = canEdit ? tool : 'hand';

  const [sketch, setSketch] = useState<SketchSelect | null>(null);
  const history = useCanvasHistory<SketchDocument>(EMPTY_DOC, {
    equals: sameDocument,
    limit: HISTORY_LIMIT,
  });
  const { value: doc, set: setDoc, reset: resetDoc, undo, redo, canUndo, canRedo } = history;
  const docRef = useRef(doc);
  useEffect(() => {
    docRef.current = doc;
  }, [doc]);
  const [savedDoc, setSavedDoc] = useState<SketchDocument>(EMPTY_DOC);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeLayer, setActiveLayer] = useState<string | null>(null);
  const [showColor, setShowColor] = useState(false);
  const [showPage, setShowPage] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [canvasRotation, setCanvasRotation] = useState(0);

  const dirty = doc !== savedDoc;

  // ---------------------------------------------------------------- document

  const activeLayerId =
    activeLayer && doc.layers.some((layer) => layer.id === activeLayer)
      ? activeLayer
      : doc.layers[doc.layers.length - 1].id;

  const generateOverlayId = useCallback(
    () => generateSketchLocalId(allLayerIds(docRef.current)),
    [],
  );
  const overlayActions = useCanvasOverlayActions({ setContent: setDoc, generateOverlayId });
  const { handleObjectsAction, cancelDraw: cancelObjectDraw } = overlayActions;

  const drawing = useSketchDrawing({
    docRef,
    setDoc,
    activeLayerId,
    paperColor: colors.surface,
  });
  const displayDoc = useMemo(
    () =>
      drawing.eraseView
        ? setLayerItems(doc, drawing.eraseView.layerId, drawing.eraseView.items)
        : doc,
    [doc, drawing.eraseView],
  );
  const {
    selection,
    transformMatrix,
    setTransformMatrix,
    clearSelection,
    handleLassoCommit,
    handleSelectTap,
    applyMatrix,
    selectionActions,
  } = useSketchSelection({
    doc,
    displayDoc,
    docRef,
    setDoc,
    activeLayerId,
    setActiveLayer,
    selectOverlay: overlayActions.selectOverlay,
  });
  const closeExport = useCallback(() => setShowExport(false), []);
  const { busy, handleExportSvg, handleExportPng, handleSaveToGallery } = useSketchExport({
    docRef,
    sketch,
    setSketch,
    db,
    storyId,
    userId,
    onFinished: closeExport,
  });

  useBackButtonHandler({
    showWebBackButton: true,
    // Opened from a scene's pages as well as from the list: back takes the way back the page registered, if any.
    onBack: () => {
      const wayBack = useHeaderBackActionStore
        .getState()
        .consumeCrossStackReturnAction('SketchCanvas');
      if (wayBack) wayBack();
      else navigation.goBack();
    },
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
      const saved = decodeSketchDocument(validateSketchContent(row.content));
      const remembered = storyId
        ? await useSketchDraftStore.getState().hydrate(storyId, sketchId)
        : null;
      // The store also still holds the drawing of a session that ended clean (saved, then closed): its `doc`
      // and `savedDoc` are the same object. That is no unsaved work, so it is not restored - and must not be
      // used as the document, because the dirty check is by identity and the saved copy decoded just above is
      // a different object: the sketch would open "changed" with nothing changed.
      const keep = remembered && remembered.doc !== remembered.savedDoc ? remembered : null;
      setSketch(row);
      setSavedDoc(saved);
      if (keep && keep.sketchId === sketchId && keep.storyId === storyId) {
        resetDoc(keep.doc);
        showNotification(
          t(
            keep.baseVersion !== row.version
              ? 'canvas_draft_conflicts_with_saved'
              : 'canvas_draft_restored',
          ),
          keep.baseVersion !== row.version ? 'warning' : 'info',
        );
      } else {
        resetDoc(saved);
      }
      setActiveLayer(null);
      clearSelection();
      setError(null);
    } catch (loadError) {
      console.log('SketchCanvasScreen: failed to load sketch.', loadError);
      setError(t('sketch_load_failed'));
    } finally {
      setLoading(false);
    }
  }, [clearSelection, db, resetDoc, showNotification, sketchId, storyId, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- `load` sets loading synchronously for its event callers and everything else after `await`; the rule cannot verify across the callback boundary.
    void load();
  }, [load]);

  const save = useCallback(async () => {
    if (!userId || !sketch) return;
    try {
      const validated = validateSketchContent(encodeSketchDocument(docRef.current));
      const savedFrom = docRef.current;
      const updated = await createSketchService(db).updateSketch(userId, sketch.id, {
        content: validated,
      });
      setSketch(updated);
      setSavedDoc(savedFrom);
      showNotification(t('sketch_saved'), 'success');
    } catch (saveError) {
      console.log('SketchCanvasScreen: failed to save sketch.', saveError);
      const tooLarge = saveError instanceof Error && /too large/i.test(saveError.message);
      showNotification(t(tooLarge ? 'sketch_too_large' : 'sketch_save_failed'), 'error');
    }
  }, [db, showNotification, sketch, t, userId]);

  const revert = useCallback(() => {
    resetDoc(savedDoc);
    clearSelection();
    overlayActions.cancelInteraction();
  }, [clearSelection, overlayActions, resetDoc, savedDoc]);

  useEffect(() => {
    if (!storyId || !sketch || sketch.id !== sketchId) return;
    useSketchDraftStore.getState().remember({
      sketchId: sketch.id,
      storyId,
      doc,
      savedDoc,
      baseVersion: sketch.version,
    });
  }, [doc, savedDoc, sketch, sketchId, storyId]);

  // ---------------------------------------------------------------- tools

  const handleBrush = useCallback(
    (kind: SketchBrushId) => {
      useSketchToolStore.getState().setBrush(kind);
      clearSelection();
    },
    [clearSelection],
  );

  const handleTool = useCallback(
    (next: SketchTool) => {
      setTool(next);
      if (next !== 'select') clearSelection();
      else setTransformMatrix(null);
    },
    [clearSelection, setTool, setTransformMatrix],
  );

  // Object tools (text, balloon, stamp) arm the overlay actions; every other tool disarms them.
  useEffect(() => {
    if (activeTool === 'text') handleObjectsAction('draw:text');
    else if (activeTool === 'balloon') handleObjectsAction('draw:balloon');
    else if (activeTool === 'stamp') handleObjectsAction('draw:stamp');
    else cancelObjectDraw();
  }, [activeTool, cancelObjectDraw, handleObjectsAction]);

  // An object tool puts itself away after placing its object; hand the toolbar back to select.
  const objectArmed = overlayActions.drawTool !== null;
  const wasObjectArmed = useRef(false);
  const toolRef = useRef(tool);
  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);
  useEffect(() => {
    if (wasObjectArmed.current && !objectArmed && isObjectTool(toolRef.current)) setTool('select');
    wasObjectArmed.current = objectArmed;
  }, [objectArmed, setTool]);

  // Ctrl/Cmd+Z / Ctrl+Shift+Z / Ctrl+Y and single-key tool shortcuts on desktop web. Skipped inside
  // text fields so typing keeps the platform's own behavior.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const shortcuts: Record<string, SketchTool> = {
      b: 'brush',
      e: 'eraser',
      g: 'fill',
      i: 'eyedropper',
      v: 'select',
      h: 'hand',
      l: 'line',
      r: 'rect',
      o: 'ellipse',
      t: 'text',
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      )
        return;
      const key = event.key.toLowerCase();
      if (event.ctrlKey || event.metaKey) {
        if (event.altKey) return;
        if (key === 'z' && !event.shiftKey) {
          event.preventDefault();
          undo();
        } else if ((key === 'z' && event.shiftKey) || key === 'y') {
          event.preventDefault();
          redo();
        }
        return;
      }
      if (event.altKey || !canEdit) return;
      if (key === '[' || key === ']') {
        const store = useSketchToolStore.getState();
        const factor = key === '[' ? 0.85 : 1.18;
        if (store.tool === 'eraser') store.setEraserSize(store.eraserSize * factor);
        else store.setSize(store.sizeByBrush[store.brush] * factor);
        return;
      }
      const next = shortcuts[key];
      if (next) handleTool(next);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canEdit, handleTool, redo, undo]);

  // ---------------------------------------------------------------- layers and page

  const layerLabel = useCallback((count: number) => t('sketch_layer_default_name', { count }), [t]);

  const handleApplyPage = useCallback(
    (page: SketchDocument['page']) => setDoc((current) => ({ ...current, page })),
    [setDoc],
  );

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

  const sheetOverlay =
    doc.overlays.find((overlay) => overlay.id === overlayActions.sheetOverlayId) ?? null;
  const brushStyle = useMemo(
    () => ({
      brush,
      color,
      alpha: quantizeSketchAlpha(alphaByBrush[brush]),
      size: sizeByBrush[brush],
    }),
    [alphaByBrush, brush, color, sizeByBrush],
  );

  const styles = useThemedStyles(createStyles);

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

  return (
    <View style={styles.container}>
      <SketchCanvasTools
        tool={activeTool}
        brush={brush}
        canEdit={canEdit}
        canUndo={canUndo}
        canRedo={canRedo}
        rotationActive={canvasRotation !== 0}
        onTool={handleTool}
        onBrush={handleBrush}
        onUndo={undo}
        onRedo={redo}
        onResetRotation={() => canvasRef.current?.resetRotation()}
        onOpenLayers={() => setShowLayers(true)}
        onOpenPage={() => setShowPage(true)}
      />
      {canEdit && (
        <SketchOptionsBar
          tool={activeTool}
          objectTool={objectArmed}
          onCancelObject={() => setTool('select')}
          onOpenColor={() => setShowColor(true)}
          selection={selectionActions}
        />
      )}
      <SketchCanvas
        ref={canvasRef}
        doc={displayDoc}
        tool={activeTool}
        brushStyle={brushStyle}
        eraserSize={eraserSize}
        selection={selection}
        transformMatrix={transformMatrix}
        interactionMode={overlayActions.interactionMode}
        selectedOverlayId={overlayActions.selectedOverlayId}
        overlayCallbacks={overlayActions}
        onPlaceText={overlayActions.placeText}
        onStrokeCommit={drawing.handleStrokeCommit}
        onErase={drawing.handleErase}
        onEraseEnd={drawing.handleEraseEnd}
        erasePreview={drawing.erasePreview}
        onFillTap={drawing.handleFillTap}
        onPick={drawing.handlePick}
        onLassoCommit={handleLassoCommit}
        onSelectTap={handleSelectTap}
        onTransformPreview={setTransformMatrix}
        onTransformCommit={applyMatrix}
        onRotationChange={setCanvasRotation}
      />
      {/* Fixed to the screen's right edge like every other canvas, not carried by the page. */}
      <GraphCanvasControls
        onZoomIn={() => canvasRef.current?.zoomBy(1.25)}
        onZoomOut={() => canvasRef.current?.zoomBy(0.8)}
        onFit={() => canvasRef.current?.fitToScreen()}
        onExport={() => setShowExport(true)}
      />
      {sheetOverlay && (
        <OverlaySheet
          overlay={sheetOverlay}
          canEdit={canEdit}
          defaultColor={colors.text}
          defaultFillColor={colors.surface}
          onChange={(patch) => overlayActions.updateOverlay(sheetOverlay.id, patch)}
          onRemove={() => overlayActions.deleteOverlay(sheetOverlay.id)}
          onClose={overlayActions.closeOverlaySheet}
        />
      )}
      {showColor && (
        <SketchColorSheet
          color={color}
          recentColors={recentColors}
          onPick={setColor}
          onClose={() => setShowColor(false)}
        />
      )}
      {showPage && (
        <SketchPageSheet
          page={doc.page}
          onApply={handleApplyPage}
          onClose={() => setShowPage(false)}
        />
      )}
      {showLayers && (
        <SketchLayerSheet
          layers={doc.layers}
          activeLayerId={activeLayerId}
          canEdit={canEdit}
          onSelectActive={(layerId) => {
            setActiveLayer(layerId);
            clearSelection();
          }}
          onAdd={() => {
            const next = addLayer(
              docRef.current,
              layerLabel(docRef.current.layers.length + 1),
              activeLayerId,
            );
            setDoc(next);
            const created = next.layers.find(
              (layer) => !docRef.current.layers.some((old) => old.id === layer.id),
            );
            if (created) setActiveLayer(created.id);
          }}
          onPatch={(layerId, patch) => setDoc((current) => patchLayer(current, layerId, patch))}
          onMove={(layerId, delta) => setDoc((current) => moveLayer(current, layerId, delta))}
          onDuplicate={(layerId) =>
            setDoc((current) =>
              duplicateLayer(
                current,
                layerId,
                t('sketch_layer_copy_name', { name: findLayer(current, layerId)?.name ?? '' }),
              ),
            )
          }
          onMergeDown={(layerId) => {
            setDoc((current) => mergeLayerDown(current, layerId));
            clearSelection();
          }}
          onClear={(layerId) => {
            setDoc((current) => clearLayer(current, layerId));
            clearSelection();
          }}
          onDelete={(layerId) => {
            setDoc((current) => removeLayer(current, layerId));
            clearSelection();
          }}
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

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
  });

export default SketchCanvasScreen;
