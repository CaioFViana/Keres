import {
  compileGamebookManuscript,
  compileLinearManuscript,
  countSongsPrintedWhole,
  estimateManuscriptPages,
  isLooseScene,
  type ManuscriptPageEstimate,
  type ManuscriptScene,
  type ManuscriptSizeAssessment,
  manuscriptSizeAssessment,
  PAGE_FORMAT_ASPECT,
  pageFormatFor,
  presentManuscript,
  renderOptionsOf,
  sceneSeparatorText,
  utf8ByteLength,
} from '@keres/shared';
import { containsCjk } from '@keres/shared/manuscript/export';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppAlert } from '../../../utils/AppAlert';
import {
  CJK_PACK_SIZE_LABEL,
  cjkPackState,
  downloadCjkPack,
  loadCjkMatrix,
} from '../../../services/cjkFontPack';
import {
  deliverScreenplay,
  exportManuscript,
} from '../../../components/features/manuscript/export/manuscriptExport';
import {
  isScreenplayFormat,
  styleForExport,
  type ManuscriptExportSettings,
} from '../../../components/features/manuscript/export/manuscriptExportSettings';
import {
  compileScreenplayManuscript,
  screenplayEstimateOf,
  screenplayInputOf,
  screenplayOptionsOf,
} from '../../../components/features/manuscript/export/screenplayExport';
import { useDrizzle } from '../../../db';
import type { LocationSelect } from '../../../db/schema';
import { createLocationService } from '../../../services/storymanagement/LocationService';
import {
  loadManuscriptMusic,
  storyMusicFacts,
  withManuscriptMusic,
} from '../../../services/storymanagement/ManuscriptMusicService';
import {
  estimateManuscriptPageBytes,
  loadManuscriptPages,
} from '../../../services/storymanagement/ManuscriptPagesService';
import { songPrintOf } from '../../../components/features/manuscript/export/songPrintOf';
import { useUserSettingsStore } from '../../../state/userSettingsStore';
import { entityEventEmitter } from '../../../utils/EventEmitter';
import { useAsyncOperation } from '../../../hooks/useAsyncOperation';
import { useManuscriptData } from '../../../hooks/useManuscriptData';
import { useStoryArcs } from '../../../hooks/useStoryArcs';
import { useNotificationStore } from '../../../state/notificationStore';
import { useStoryStore } from '../../../state/storyStore';
import { chapterBelongsToArc, sceneBelongsToActiveArc } from '../../../utils/storyArcFilter';
import { exportFileLanguage } from '../../../utils/storyTransfer';

// What there is while there is no story: the same empty values every time, so nothing draws again for them.
const NO_LOCATIONS: LocationSelect[] = [];
const NO_MUSIC_FACTS = { hasMusic: false, hasSungSongs: false };
const NO_PAGE_BYTES = new Map<string, number[]>();

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
  const db = useDrizzle();
  const { selectedStory } = useStoryStore();
  const activeArcId = useStoryStore((state) => state.activeArcId);
  const { arcs } = useStoryArcs();
  const { showNotification } = useNotificationStore();
  const { userId } = useUserSettingsStore();
  const { pending: exporting, run } = useAsyncOperation();
  const isBranching = selectedStory?.type === 'branching';
  const { chapters, scenes, choices, loading, loadChoiceAnnotations } = useManuscriptData(
    selectedStory?.id ?? null,
  );
  const chaptersById = useMemo(
    () => new Map(chapters.map((chapter) => [chapter.id, chapter])),
    [chapters],
  );
  // The places a screenplay writes its scene headings from; read only when the story has them to give.
  const [loadedLocations, setLocations] = useState<LocationSelect[]>(NO_LOCATIONS);
  const storyId = selectedStory?.id;
  // No story, no places: read off the story, not set from an effect.
  const locations = storyId ? loadedLocations : NO_LOCATIONS;
  useEffect(() => {
    if (!storyId) return;
    let alive = true;
    const load = () =>
      void createLocationService(db)
        .getAllByStoryId(storyId)
        .then((rows) => alive && setLocations(rows))
        .catch(() => alive && setLocations(NO_LOCATIONS));
    load();
    entityEventEmitter.on('location_changed', load);
    return () => {
      alive = false;
      entityEventEmitter.off('location_changed', load);
    };
  }, [db, storyId]);

  // What the music of the scenes offers the export: only with some does it offer to write it, and
  // only where a song is sung does it offer to print the song.
  const [loadedMusicFacts, setMusicFacts] = useState(NO_MUSIC_FACTS);
  const musicFacts = storyId ? loadedMusicFacts : NO_MUSIC_FACTS;
  useEffect(() => {
    const none = NO_MUSIC_FACTS;
    // The same facts keep the same state: a new object each time would draw the screen again for nothing.
    const keep = (next: typeof none) => (current: typeof none) =>
      current.hasMusic === next.hasMusic && current.hasSungSongs === next.hasSungSongs
        ? current
        : next;
    if (!storyId) return;
    let alive = true;
    const load = () =>
      void storyMusicFacts(db, storyId)
        .then((facts) => alive && setMusicFacts(keep(facts)))
        .catch(() => alive && setMusicFacts(keep(none)));
    load();
    entityEventEmitter.on('scene_music_changed', load);
    return () => {
      alive = false;
      entityEventEmitter.off('scene_music_changed', load);
    };
  }, [db, storyId]);

  // The pictures of each scene's pages, in bytes, from what is known without reading a file.
  const [loadedPageBytes, setPageBytes] = useState<Map<string, number[]>>(NO_PAGE_BYTES);
  const pageBytes = storyId ? loadedPageBytes : NO_PAGE_BYTES;
  useEffect(() => {
    if (!storyId) return;
    let alive = true;
    const load = () =>
      void estimateManuscriptPageBytes(db, storyId)
        .then((sizes) => alive && setPageBytes(sizes))
        .catch(() => alive && setPageBytes(NO_PAGE_BYTES));
    load();
    entityEventEmitter.on('scene_page_changed', load);
    entityEventEmitter.on('gallery_changed', load);
    return () => {
      alive = false;
      entityEventEmitter.off('scene_page_changed', load);
      entityEventEmitter.off('gallery_changed', load);
    };
  }, [db, storyId]);

  /** The length of the script under the settings, with the layout it stands on; null off screenplay. */
  const screenplayEstimate = useCallback(
    (settings: ManuscriptExportSettings) => {
      if (isBranching || !isScreenplayFormat(settings.format)) return null;
      const input = screenplayInputOf({
        title: selectedStory?.title ?? '',
        chapters,
        scenes,
        locations,
        arcs,
      });
      return screenplayEstimateOf(input, settings, i18n.language);
    },
    [isBranching, selectedStory, chapters, scenes, locations, arcs, i18n.language],
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

  /**
   * How big the file will be, from what is already known - the text in scope - and stood against the
   * limit. Said before the export, so the writer is not told only after the work is done.
   */
  const sizeEstimate = useCallback(
    (settings: ManuscriptExportSettings): ManuscriptSizeAssessment => {
      const inScope = scenes.filter(
        (scene) =>
          !scene.isDeleted &&
          sceneBelongsToActiveArc(scene, chaptersById, settings.arcId) &&
          (isBranching || settings.includeLooseScenes || !isLooseScene(scene, chaptersById)),
      );
      const imageBytes = inScope.flatMap((scene) => pageBytes.get(scene.id) ?? []);
      const textBytes = inScope.reduce(
        (sum, scene) =>
          sum +
          utf8ByteLength(scene.body ?? '') +
          (settings.includeSceneNames ? utf8ByteLength(scene.name) + 16 : 0),
        0,
      );
      return manuscriptSizeAssessment({ format: settings.format, textBytes, imageBytes });
    },
    [scenes, chaptersById, isBranching, pageBytes],
  );

  /**
   * How many pages the PDF would have under the settings, counted by the layout that draws it. Asked for
   * on demand: laying out a whole book is work, and the number only means something for the settings it
   * was counted with. Pictures are not drawn, and a branching story has no page count worth giving.
   */
  const estimatePages = useCallback(
    (settings: ManuscriptExportSettings): ManuscriptPageEstimate | null => {
      if (isBranching || isScreenplayFormat(settings.format)) return null;
      const arc = settings.arcId ? (arcs.find((row) => row.id === settings.arcId) ?? null) : null;
      const title = arc?.title ?? selectedStory?.title ?? '';
      const inArc = settings.arcId
        ? scenes.filter((scene) => sceneBelongsToActiveArc(scene, chaptersById, settings.arcId))
        : scenes;
      const manuscript = compileLinearManuscript({
        title,
        chapters,
        scenes: inArc,
        choices,
        includeLooseScenes: settings.includeLooseScenes,
        looseHeadingLabel: t('export_manuscript_loose_heading'),
        includeSceneNames: settings.includeSceneNames,
        resetSceneNumbersPerChapter: settings.resetSceneNumbers,
        arcId: settings.arcId,
        sceneSeparator: sceneSeparatorText(settings.style),
      });
      const style = styleForExport(
        settings,
        {
          byLine: t('export_manuscript_title_page_by'),
          copyright: t('export_manuscript_title_page_copyright'),
        },
        new Date(),
      );
      const presented = presentManuscript(manuscript, style, i18n.language === 'pt' ? 'pt' : 'en');
      return estimateManuscriptPages(
        presented,
        {
          goToPage: t('export_manuscript_go_to_page'),
          tocHeading: t('export_manuscript_index_heading'),
        },
        { ...renderOptionsOf(style), includeToc: settings.includeIndex },
      );
    },
    [isBranching, arcs, selectedStory, scenes, chaptersById, chapters, choices, t, i18n.language],
  );

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
          // The music is read only for an export that writes it, and the words of a song only for one
          // that prints songs.
          const sceneMusic =
            (settings.includeMusicCues || settings.includeSongs) && selectedStory?.id
              ? await loadManuscriptMusic(db, selectedStory.id, {
                  withSongs: settings.includeSongs,
                })
              : null;
          // The songs in the scenes print the parts they name; one whose parts are all gone prints whole
          // instead, which the export says rather than leaves to be found in the book.
          const wholeSongs =
            sceneMusic && settings.includeSongs ? countSongsPrintedWhole(sceneMusic.values()) : 0;
          if (
            wholeSongs > 0 &&
            (isScreenplayFormat(settings.format) || settings.songsPlacement === 'after-scene')
          ) {
            showNotification(t('export_songs_printed_whole', { count: wholeSongs }), 'warning');
          }
          if (isScreenplayFormat(settings.format)) {
            const compiled = compileScreenplayManuscript(
              screenplayInputOf({
                title: selectedStory?.title ?? '',
                chapters,
                scenes,
                locations,
                arcs,
                music: sceneMusic,
              }),
              screenplayOptionsOf(
                settings,
                i18n.language,
                t('export_manuscript_music_label'),
                t('export_manuscript_songs_heading'),
              ),
            );
            const delivered = await deliverScreenplay({
              storyTitle: title,
              bytes: compiled.bytes,
              format: settings.format,
              language: exportFileLanguage(i18n.language),
            });
            showNotification(
              delivered.delivered
                ? t('export_manuscript_success', { fileName: delivered.fileName })
                : t('export_story_no_share_target', { path: delivered.uri || delivered.fileName }),
              delivered.delivered ? 'success' : 'warning',
            );
            made = true;
            return;
          }
          const scenesInArc = settings.arcId
            ? scenes.filter((scene) => sceneBelongsToActiveArc(scene, chaptersById, settings.arcId))
            : scenes;
          // The pages of the scenes that ship, with their pictures read from this device (a Sketch's
          // snapshot is redrawn first if the drawing changed). Only formats that can show them read any.
          const shipping = scenesInArc.filter(
            (scene) =>
              !scene.isDeleted &&
              (isBranching || settings.includeLooseScenes || !isLooseScene(scene, chaptersById)),
          );
          // Only these formats can show a picture; the others keep a page's caption and text.
          const carriesPictures = ['docx', 'pdf', 'epub', 'html'].includes(settings.format);
          const loadedPages =
            userId && selectedStory?.id
              ? await loadManuscriptPages(
                  db,
                  userId,
                  selectedStory.id,
                  new Set(shipping.map((scene) => scene.id)),
                  carriesPictures,
                )
              : null;
          const withPages = (list: typeof scenes): typeof scenes =>
            loadedPages
              ? list.map((scene) => {
                  const pages = loadedPages.pagesByScene.get(scene.id);
                  return pages
                    ? ({ ...scene, pages } as ManuscriptScene as (typeof scenes)[number])
                    : scene;
                })
              : list;
          const exportScenes = withManuscriptMusic(withPages(scenesInArc), sceneMusic);
          const arcInEffect = settings.arcId
            ? exportArc
            : activeArcId
              ? (arcs.find((arc) => arc.id === activeArcId) ?? null)
              : arcs.length === 1
                ? arcs[0]
                : null;
          const pageWords = {
            caption: t(
              arcInEffect?.medium === 'storyboard'
                ? 'export_manuscript_frame_label'
                : 'export_manuscript_page_label',
            ),
            removed: t('export_manuscript_media_removed'),
            ...(settings.includeMusicCues
              ? { musicLabel: t('export_manuscript_music_label') }
              : {}),
            ...(settings.includeSongs
              ? { songs: songPrintOf(settings, t('export_manuscript_songs_heading')) }
              : {}),
          };
          const pageAspect =
            PAGE_FORMAT_ASPECT[
              pageFormatFor(arcInEffect?.medium ?? 'generic', arcInEffect?.pageFormat)
            ];
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
                pageWords,
              })
            : compileLinearManuscript({
                title,
                chapters,
                scenes: exportScenes,
                choices: annotatedChoices,
                includeLooseScenes: settings.includeLooseScenes,
                looseHeadingLabel: t('export_manuscript_loose_heading'),
                includeSceneNames: settings.includeSceneNames,
                resetSceneNumbersPerChapter: settings.resetSceneNumbers,
                arcId: settings.arcId,
                sceneSeparator,
                pageWords,
              });
          const now = new Date();
          const result = await exportManuscript({
            storyTitle: title,
            manuscript: loadedPages
              ? { ...manuscript, images: loadedPages.media, pageAspect }
              : manuscript,
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
          // Pages that could not bring their picture are said, not left as a blank nobody explained.
          const left = loadedPages
            ? loadedPages.problems.missing +
              loadedPages.problems.unsupported +
              loadedPages.problems.snapshot
            : 0;
          if (carriesPictures && left > 0) {
            showNotification(t('export_manuscript_pages_problems', { count: left }), 'warning');
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
      locations,
      db,
      userId,
      activeArcId,
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
    screenplayEstimate,
    estimatePages,
    sizeEstimate,
    hasMusic: musicFacts.hasMusic,
    hasSongs: musicFacts.hasSungSongs,
  };
}
