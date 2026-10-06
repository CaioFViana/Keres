import {
  compileLinearManuscript,
  compileGamebookManuscript,
  isLooseScene,
  sceneSeparatorText,
} from '@keres/shared';
import { containsCjk } from '@keres/shared/manuscript/export';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AppAlert } from '../../../utils/AppAlert';
import {
  CJK_PACK_SIZE_LABEL,
  cjkPackState,
  downloadCjkPack,
  loadCjkMatrix,
} from '../../../services/cjkFontPack';
import { exportManuscript } from '../../../components/features/manuscript/export/manuscriptExport';
import {
  styleForExport,
  type ManuscriptExportSettings,
} from '../../../components/features/manuscript/export/manuscriptExportSettings';
import { useAsyncOperation } from '../../../hooks/useAsyncOperation';
import { useManuscriptData } from '../../../hooks/useManuscriptData';
import { useStoryArcs } from '../../../hooks/useStoryArcs';
import { useNotificationStore } from '../../../state/notificationStore';
import { useStoryStore } from '../../../state/storyStore';
import { chapterBelongsToArc, sceneBelongsToActiveArc } from '../../../utils/storyArcFilter';
import { exportFileLanguage } from '../../../utils/storyTransfer';

/**
 * The manuscript export of the selected story: what the export screen needs to show (the loose
 * scenes, the arcs) and the run itself - compile the read model into format-neutral
 * blocks with the chosen content, present and draw them, and hand the file to the share sheet (a
 * browser download on web). A delivered file notifies success; a build with no share target says
 * where the file is instead; anything thrown notifies failure. Resolves true once the file was
 * made, so the screen can close; a failure keeps it open to try again.
 */
export function useManuscriptExport() {
  const { t, i18n } = useTranslation();
  const { selectedStory } = useStoryStore();
  const activeArcId = useStoryStore((state) => state.activeArcId);
  const { arcs } = useStoryArcs();
  const { showNotification } = useNotificationStore();
  const { pending: exporting, run } = useAsyncOperation();
  const isBranching = selectedStory?.type === 'branching';
  const { chapters, scenes, choices, loading, loadChoiceAnnotations } = useManuscriptData(
    selectedStory?.id ?? null,
  );
  const chaptersById = useMemo(
    () => new Map(chapters.map((chapter) => [chapter.id, chapter])),
    [chapters],
  );

  // The count follows the visible manuscript: other-arc containers are gone, and their scenes
  // went with them, so nothing hidden leaks into the loose switch.
  const looseCount = useMemo(() => {
    if (isBranching) return 0;
    const visibleById = new Map(
      chapters
        .filter((chapter) => chapterBelongsToArc(chapter, activeArcId))
        .map((chapter) => [chapter.id, chapter]),
    );
    return scenes.filter(
      (scene) =>
        sceneBelongsToActiveArc(scene, chaptersById, activeArcId) &&
        !scene.isDeleted &&
        isLooseScene(scene, visibleById),
    ).length;
  }, [isBranching, chapters, scenes, chaptersById, activeArcId]);

  const promptCjkPack = useCallback(
    () =>
      new Promise<'download' | 'without' | 'cancel'>((resolve) => {
        AppAlert.alert(
          t('export_manuscript_cjk_title'),
          t('export_manuscript_cjk_message', { size: CJK_PACK_SIZE_LABEL }),
          [
            {
              text: t('export_manuscript_cjk_download', { size: CJK_PACK_SIZE_LABEL }),
              onPress: () => resolve('download'),
            },
            { text: t('export_manuscript_cjk_without'), onPress: () => resolve('without') },
            { text: t('cancel'), style: 'cancel', onPress: () => resolve('cancel') },
          ],
        );
      }),
    [t],
  );

  const exportWith = useCallback(
    async (settings: ManuscriptExportSettings) => {
      let made = false;
      await run(async () => {
        try {
          const labels = {
            goToPage: t('export_manuscript_go_to_page'),
            goToScene: t('export_manuscript_go_to_scene'),
            tocHeading: t('export_manuscript_index_heading'),
          };
          // A specific arc exports as its own book: the arc title replaces the story title on
          // the cover and in the file name, and only its scenes ship.
          const exportArc = settings.arcId
            ? (arcs.find((arc) => arc.id === settings.arcId) ?? null)
            : null;
          const title = exportArc?.title ?? selectedStory?.title ?? '';
          const exportScenes = settings.arcId
            ? scenes.filter((scene) => sceneBelongsToActiveArc(scene, chaptersById, settings.arcId))
            : scenes;
          // CJK resolves before compiling: the pack downloads once
          // (app-private on native, in memory on web), the export retries
          // with it, and skipping exports with `?` placeholders after a
          // warning.
          let cjkMatrix: Uint8Array | null = null;
          // True once the export owes CJK glyphs: pack ready, or downloaded
          // just now. A null matrix past this point means a corrupt pack, and
          // a legacy PDF past this point means the serif failed - both warn.
          let cjkExpected = false;
          const needsCjk =
            settings.format === 'pdf' &&
            containsCjk([title, ...exportScenes.map((scene) => scene.body ?? '')].join('\n'));
          if (needsCjk) {
            if ((await cjkPackState()) === 'ready') {
              cjkExpected = true;
              cjkMatrix = await loadCjkMatrix();
            } else {
              const choice = await promptCjkPack();
              if (choice === 'cancel') return;
              if (choice === 'download') {
                showNotification(
                  t('export_manuscript_cjk_downloading', { size: CJK_PACK_SIZE_LABEL }),
                  'info',
                );
                try {
                  await downloadCjkPack();
                  cjkExpected = true;
                  cjkMatrix = await loadCjkMatrix();
                  showNotification(t('export_manuscript_cjk_ready'), 'success');
                } catch (error) {
                  console.log('useManuscriptExport: CJK pack download failed.', error);
                  showNotification(
                    t('export_manuscript_cjk_failed', {
                      reason: (error as Error)?.message ?? 'unknown error',
                    }),
                    'error',
                  );
                  return;
                }
              } else {
                showNotification(t('export_manuscript_cjk_skipped'), 'warning');
              }
            }
          }
          // Check and effect lines resolve here, at export time: reading never pays for them.
          const annotations = await loadChoiceAnnotations(t);
          const annotatedChoices = choices.map((choice) => {
            const lines = annotations.get(choice.id);
            return lines ? { ...choice, ...lines } : choice;
          });
          const sceneSeparator = sceneSeparatorText(settings.style);
          const manuscript = isBranching
            ? compileGamebookManuscript({
                title,
                scenes: exportScenes,
                choices: annotatedChoices,
                order: settings.sceneOrder,
                showSceneNames: settings.includeSceneNames,
                endLabel: t('export_manuscript_end_of_excerpt'),
                startLabels: {
                  choose: t('export_manuscript_choose_start'),
                  begin: t('export_manuscript_begin_at'),
                },
                sceneSeparator,
              })
            : compileLinearManuscript({
                title,
                chapters,
                scenes,
                choices: annotatedChoices,
                includeLooseScenes: settings.includeLooseScenes,
                looseHeadingLabel: t('export_manuscript_loose_heading'),
                includeSceneNames: settings.includeSceneNames,
                resetSceneNumbersPerChapter: settings.resetSceneNumbers,
                arcId: settings.arcId,
                sceneSeparator,
              });
          const now = new Date();
          const result = await exportManuscript({
            storyTitle: title,
            manuscript,
            format: settings.format,
            labels,
            cjkMatrix,
            options: { includeToc: settings.includeIndex },
            style: styleForExport(
              settings,
              {
                byLine: t('export_manuscript_title_page_by'),
                copyright: t('export_manuscript_title_page_copyright'),
              },
              now,
            ),
            metadata: { author: settings.author.trim() || null, language: i18n.language },
            language: exportFileLanguage(i18n.language),
          });
          // A CJK book on the legacy path exports every such char as `?`:
          // say so instead of letting the success toast imply it worked.
          if (cjkExpected && !result.unicodePdf) {
            showNotification(t('export_manuscript_cjk_fallback'), 'warning');
          } else {
            showNotification(
              result.delivered
                ? t('export_manuscript_success', { fileName: result.fileName })
                : t('export_story_no_share_target', { path: result.uri || result.fileName }),
              result.delivered ? 'success' : 'warning',
            );
          }
          made = true;
        } catch (error) {
          console.log('useManuscriptExport: manuscript export failed.', error);
          showNotification(t('export_manuscript_failed_body'), 'error');
        }
      });
      return made;
    },
    [
      run,
      t,
      i18n,
      arcs,
      selectedStory,
      scenes,
      chaptersById,
      loadChoiceAnnotations,
      choices,
      isBranching,
      chapters,
      showNotification,
      promptCjkPack,
    ],
  );

  return {
    loading,
    exporting,
    isBranching,
    looseCount,
    arcs,
    storyAuthor: selectedStory?.author ?? '',
    exportWith,
  };
}
