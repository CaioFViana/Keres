import { type ArcMedium, isLooseScene, type ReaderLabels } from '@keres/shared';
import { useCallback, useState } from 'react';
import {
  defaultExportSettings,
  FORMAT_CAPABILITIES,
  isScreenplayFormat,
  styleForExport,
  type ManuscriptExportSettings,
} from '../../components/features/manuscript/export/manuscriptExportSettings';
import type { AppDrizzleClient } from '../../db';
import type { StorySelect } from '../../db/schema';
import type {
  PublishManuscriptOptions,
  PublishReaderOptions,
} from '../../services/PublicationApiService';
import { createChapterService } from '../../services/storymanagement/ChapterService';
import { createSceneService } from '../../services/storymanagement/SceneService';
import { createStoryArcService } from '../../services/storymanagement/StoryArcService';

/** A work of the story the person can release on its own. */
export type PublishableArc = {
  id: string;
  title: string;
  author: string | null;
  medium: ArcMedium;
};

/** The words of the reader's own interface, in the publisher's language. */
function readerLabelsOf(t: (key: string) => string): ReaderLabels {
  return {
    back: t('reader_back'),
    path: t('reader_path'),
    inventory: t('reader_inventory'),
    inventoryEmpty: t('reader_inventory_empty'),
    saves: t('reader_saves'),
    save: t('reader_save'),
    saveName: t('reader_save_name'),
    load: t('reader_load'),
    remove: t('reader_remove'),
    autosave: t('reader_autosave'),
    noSaves: t('reader_no_saves'),
    notSaving: t('reader_not_saving'),
    continueLabel: t('reader_continue'),
    newGame: t('reader_new_game'),
    restart: t('reader_restart'),
    theEnd: t('reader_the_end'),
    contents: t('reader_contents'),
    appearance: t('reader_appearance'),
    theme: t('reader_theme'),
    themeAuto: t('reader_theme_auto'),
    themeLight: t('reader_theme_light'),
    themeDark: t('reader_theme_dark'),
    themeSepia: t('reader_theme_sepia'),
    textSize: t('reader_text_size'),
    stepsWord: t('reader_steps_word'),
    scene: t('reader_scene'),
    journey: t('reader_journey'),
    empty: t('reader_empty'),
    close: t('close'),
  };
}

/**
 * The manuscript choice of one expanded story on the publish screen: the same settings the device
 * export asks (`ManuscriptExportOptions`), plus the attach switch.
 */
export function usePublishManuscript(drizzleDb: AppDrizzleClient) {
  const [attachManuscript, setAttachManuscript] = useState(false);
  const [publishReader, setPublishReader] = useState(false);
  // The story file (.zip) is what a version has always been; it may be left out when a manuscript
  // and/or the online reader are published instead.
  const [includePackage, setIncludePackage] = useState(true);
  const [settings, setSettings] = useState<ManuscriptExportSettings>(() => defaultExportSettings());
  const [manuscriptLooseCount, setManuscriptLooseCount] = useState(0);
  const [manuscriptArcs, setManuscriptArcs] = useState<PublishableArc[]>([]);
  // What goes out: `null` is the whole universe; an id is one work of it (manuscript and/or reader only).
  const [releaseArcId, setReleaseArcIdState] = useState<string | null>(null);

  // What the manuscript section needs: linear counts its loose scenes the same way the
  // manuscript screen does; a branching story is exported whole, so it needs nothing.
  const resetForStory = useCallback(
    (story: StorySelect) => {
      setAttachManuscript(false);
      setPublishReader(false);
      setIncludePackage(true);
      setSettings(defaultExportSettings(story.author ?? ''));
      setManuscriptLooseCount(0);
      setManuscriptArcs([]);
      setReleaseArcIdState(null);
      void (async () => {
        try {
          const arcs = await createStoryArcService(drizzleDb).getArcsForStory(story.id);
          setManuscriptArcs(
            arcs.map((arc) => ({
              id: arc.id,
              title: arc.title,
              author: arc.author,
              medium: arc.medium,
            })),
          );
          if (story.type !== 'branching') {
            const [storyChapters, storyScenes] = await Promise.all([
              createChapterService(drizzleDb).getAllByStoryId(story.id, null),
              createSceneService(drizzleDb).getAllByStoryId(story.id),
            ]);
            const chaptersById = new Map(storyChapters.map((chapter) => [chapter.id, chapter]));
            setManuscriptLooseCount(
              storyScenes.filter((scene) => !scene.isDeleted && isLooseScene(scene, chaptersById))
                .length,
            );
          }
        } catch (optionsError) {
          console.log('PublishStoryScreen: could not load manuscript options.', optionsError);
        }
      })();
    },
    [drizzleDb],
  );

  /**
   * Chooses the whole universe or one of its works. A work never carries the story file (that is
   * the whole story), its manuscript is that work's alone, and it is credited to its own author.
   */
  const setReleaseArcId = useCallback(
    (arcId: string | null, story: StorySelect) => {
      setReleaseArcIdState(arcId);
      const arc = arcId ? manuscriptArcs.find((row) => row.id === arcId) : undefined;
      setIncludePackage(arcId === null);
      setSettings((current) => ({
        ...current,
        arcId,
        author: arc ? (arc.author ?? story.author ?? '') : (story.author ?? ''),
      }));
    },
    [manuscriptArcs],
  );

  // What shapes the file, whichever of the two the server compiles: the manuscript and the online
  // reader are made from the same choices.
  const shapeOf = useCallback(
    (
      story: StorySelect,
      t: (key: string) => string,
      language: string,
      format: PublishManuscriptOptions['format'],
    ): PublishManuscriptOptions => {
      const branching = story.type === 'branching';
      // What the file can honor follows the format it is made in (the reader is a web page).
      const forFormat = { ...settings, format };
      return {
        format,
        includeLooseScenes: !branching && settings.includeLooseScenes,
        includeSceneNames: settings.includeSceneNames,
        includeToc: FORMAT_CAPABILITIES[format].index && settings.includeIndex,
        resetSceneNumbers: !branching && settings.includeSceneNames && settings.resetSceneNumbers,
        style: styleForExport(
          forFormat,
          {
            byLine: t('export_manuscript_title_page_by'),
            copyright: t('export_manuscript_title_page_copyright'),
          },
          new Date(),
        ),
        ...(branching ? { sceneOrder: settings.sceneOrder } : {}),
        ...(settings.arcId ? { arcId: settings.arcId } : {}),
        ...(isScreenplayFormat(format) ? { screenplay: { ...settings.screenplay } } : {}),
        labels: {
          goToPage: t('export_manuscript_go_to_page'),
          goToScene: t('export_manuscript_go_to_scene'),
          looseHeading: t('export_manuscript_loose_heading'),
          tocHeading: t('export_manuscript_index_heading'),
          endOfExcerpt: t('export_manuscript_end_of_excerpt'),
          chooseStart: t('export_manuscript_choose_start'),
          beginAt: t('export_manuscript_begin_at'),
        },
        // Left out when empty so the server credits the work's author, the story's, then the handle.
        ...(settings.author.trim() ? { author: settings.author.trim() } : {}),
        language,
      };
    },
    [settings],
  );

  // Render options, never bytes: the server compiles from its own copy in the
  // publisher's language.
  const buildOptions = useCallback(
    (
      story: StorySelect,
      t: (key: string) => string,
      language: string,
    ): PublishManuscriptOptions | undefined =>
      attachManuscript ? shapeOf(story, t, language, settings.format) : undefined,
    [attachManuscript, settings.format, shapeOf],
  );

  // The reading page is html on the server's side; the file format the person picked is the
  // manuscript's business, and its own interface words travel with it.
  const buildReaderOptions = useCallback(
    (
      story: StorySelect,
      t: (key: string) => string,
      language: string,
    ): PublishReaderOptions | undefined => {
      if (!publishReader) return undefined;
      const { format: _format, ...shape } = shapeOf(story, t, language, 'html');
      return { ...shape, readerLabels: readerLabelsOf(t) };
    },
    [publishReader, shapeOf],
  );

  return {
    attachManuscript,
    setAttachManuscript,
    publishReader,
    setPublishReader,
    includePackage,
    setIncludePackage,
    /** A version with nothing in it: none of the three is on. */
    nothingSelected: !includePackage && !attachManuscript && !publishReader,
    settings,
    setSettings,
    manuscriptLooseCount,
    manuscriptArcs,
    releaseArcId,
    setReleaseArcId,
    resetForStory,
    buildOptions,
    buildReaderOptions,
  };
}

export type PublishManuscriptState = ReturnType<typeof usePublishManuscript>;
