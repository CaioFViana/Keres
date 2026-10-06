import type { SketchDocument } from '@keres/shared';
import { type MutableRefObject, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppDrizzleClient } from '../db';
import type { SketchSelect } from '../db/schema';
import { saveSketchSnapshot } from '../services/storymanagement/SketchSnapshotService';
import { useNotificationStore } from '../state/notificationStore';
import { useTheme } from '../theme';
import { renderSketchSvg } from '../utils/sketchSvg';
import { buildSketchFileName, deliverMapExport, deliverSvgMap } from '../utils/storyTransfer';

interface UseSketchExportOptions {
  docRef: MutableRefObject<SketchDocument>;
  sketch: SketchSelect | null;
  setSketch: (sketch: SketchSelect) => void;
  db: AppDrizzleClient;
  storyId: string | undefined;
  userId: string | null | undefined;
  /** Runs after every export attempt, successful or not (closes the sheet). */
  onFinished: () => void;
}

/**
 * The three ways out of a sketch: an .svg file, a .png file, or a .png saved into the story gallery
 * and linked as the sketch cover. The PNG is the only bitmap a sketch ever produces, and only when
 * asked; a byte-identical drawing reuses the same file and gallery row by hash.
 */
export function useSketchExport({
  docRef,
  sketch,
  setSketch,
  db,
  storyId,
  userId,
  onFinished,
}: UseSketchExportOptions) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { showNotification } = useNotificationStore();
  const [busy, setBusy] = useState(false);

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

  const buildSvg = useCallback(
    () =>
      renderSketchSvg(docRef.current, {
        title: sketch?.name ?? t('sketches_title'),
        colors: exportColors,
        paper: colors.surface,
      }),
    [colors.surface, docRef, exportColors, sketch?.name, t],
  );

  const run = useCallback(
    async (work: () => Promise<void>, failureKey: string, logLabel: string) => {
      setBusy(true);
      try {
        await work();
      } catch (error) {
        console.log(`useSketchExport: failed to ${logLabel}.`, error);
        showNotification(t(failureKey), 'error');
      } finally {
        setBusy(false);
        onFinished();
      }
    },
    [onFinished, showNotification, t],
  );

  const reportDelivery = useCallback(
    (result: { delivered: boolean; fileName: string; uri?: string | null }) => {
      showNotification(
        result.delivered
          ? t('sketch_export_success', { fileName: result.fileName })
          : t('story_map_export_no_share_target', { path: result.uri ?? result.fileName }),
        result.delivered ? 'success' : 'warning',
      );
    },
    [showNotification, t],
  );

  const handleExportSvg = useCallback(async () => {
    if (!sketch) return;
    await run(
      async () =>
        reportDelivery(await deliverSvgMap(buildSvg(), buildSketchFileName(sketch.name, 'svg'))),
      'sketch_export_failed',
      'export sketch SVG',
    );
  }, [buildSvg, reportDelivery, run, sketch]);

  const handleExportPng = useCallback(async () => {
    if (!sketch) return;
    await run(
      async () =>
        reportDelivery(
          await deliverMapExport(buildSvg(), buildSketchFileName(sketch.name, 'png'), 'png'),
        ),
      'sketch_export_failed',
      'export sketch PNG',
    );
  }, [buildSvg, reportDelivery, run, sketch]);

  const handleSaveToGallery = useCallback(async () => {
    if (!sketch || !storyId || !userId) return;
    await run(
      async () => {
        setSketch(
          await saveSketchSnapshot(db, userId, sketch, docRef.current, {
            colors: exportColors,
            paper: colors.surface,
          }),
        );
        showNotification(t('sketch_gallery_saved'), 'success');
      },
      'sketch_gallery_save_failed',
      'save sketch to gallery',
    );
  }, [
    colors.surface,
    db,
    docRef,
    exportColors,
    run,
    setSketch,
    showNotification,
    sketch,
    storyId,
    t,
    userId,
  ]);

  return { busy, handleExportSvg, handleExportPng, handleSaveToGallery };
}
