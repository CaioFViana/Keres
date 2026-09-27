import { isLooseScene } from '@keres/shared';
import { useCallback, useState } from 'react';
import {
  defaultExportSettings,
  FORMAT_CAPABILITIES,
  styleForExport,
  type ManuscriptExportSettings,
} from '../../components/features/manuscript/export/manuscriptExportSettings';
import type { AppDrizzleClient } from '../../db';
import type { RouteSelect, StorySelect } from '../../db/schema';
import type { PublishManuscriptOptions } from '../../services/PublicationApiService';
import { createChapterService } from '../../services/storymanagement/ChapterService';
import { createRouteService } from '../../services/storymanagement/RouteService';
import { createSceneService } from '../../services/storymanagement/SceneService';
import { createStoryArcService } from '../../services/storymanagement/StoryArcService';

/**
 * The manuscript choice of one expanded story on the publish screen: the same settings the device
 * export asks (`ManuscriptExportOptions`), plus the attach switch and, for a branching story, the route.
 */
export function usePublishManuscript(drizzleDb: AppDrizzleClient) {
  const [attachManuscript, setAttachManuscript] = useState(false);
  const [settings, setSettings] = useState<ManuscriptExportSettings>(() => defaultExportSettings());
  const [manuscriptRouteId, setManuscriptRouteId] = useState<string | null>(null);
  const [manuscriptRoutes, setManuscriptRoutes] = useState<RouteSelect[]>([]);
  const [manuscriptLooseCount, setManuscriptLooseCount] = useState(0);
  const [manuscriptArcs, setManuscriptArcs] = useState<{ id: string; title: string }[]>([]);

  // What the manuscript section needs: branching picks one of the story's routes,
  // linear counts its loose scenes the same way the manuscript screen does.
  const resetForStory = useCallback(
    (story: StorySelect) => {
      setAttachManuscript(false);
      setSettings(defaultExportSettings(story.author ?? ''));
      setManuscriptRouteId(null);
      setManuscriptRoutes([]);
      setManuscriptLooseCount(0);
      setManuscriptArcs([]);
      void (async () => {
        try {
          const arcs = await createStoryArcService(drizzleDb).getArcsForStory(story.id);
          setManuscriptArcs(arcs.map((arc) => ({ id: arc.id, title: arc.title })));
          if (story.type === 'branching') {
            const storyRoutes = await createRouteService(drizzleDb).getAllByStoryId(story.id);
            setManuscriptRoutes(storyRoutes);
            setManuscriptRouteId(storyRoutes[0]?.id ?? null);
          } else {
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

  // Render options, never bytes: the server compiles from its own copy in the
  // publisher's language. A branching story without a route sends nothing.
  const buildOptions = useCallback(
    (
      story: StorySelect,
      t: (key: string) => string,
      language: string,
    ): PublishManuscriptOptions | undefined => {
      const effectiveRouteId =
        story.type === 'branching' ? (manuscriptRouteId ?? manuscriptRoutes[0]?.id ?? null) : null;
      if (!attachManuscript || (story.type === 'branching' && !effectiveRouteId)) {
        return undefined;
      }
      const branching = story.type === 'branching';
      return {
        format: settings.format,
        includeLooseScenes: !branching && settings.includeLooseScenes,
        includeSceneNames: settings.includeSceneNames,
        includeToc: FORMAT_CAPABILITIES[settings.format].index && settings.includeIndex,
        resetSceneNumbers: !branching && settings.includeSceneNames && settings.resetSceneNumbers,
        style: styleForExport(
          settings,
          {
            byLine: t('export_manuscript_title_page_by'),
            copyright: t('export_manuscript_title_page_copyright'),
          },
          new Date(),
        ),
        ...(effectiveRouteId ? { routeId: effectiveRouteId } : {}),
        ...(settings.arcId ? { arcId: settings.arcId } : {}),
        labels: {
          goToPage: t('export_manuscript_go_to_page'),
          goToScene: t('export_manuscript_go_to_scene'),
          looseHeading: t('export_manuscript_loose_heading'),
          tocHeading: t('export_manuscript_index_heading'),
        },
        author: settings.author.trim() || null,
        language,
      };
    },
    [attachManuscript, settings, manuscriptRouteId, manuscriptRoutes],
  );

  return {
    attachManuscript,
    setAttachManuscript,
    settings,
    setSettings,
    manuscriptRouteId,
    setManuscriptRouteId,
    manuscriptRoutes,
    manuscriptLooseCount,
    manuscriptArcs,
    resetForStory,
    buildOptions,
  };
}

export type PublishManuscriptState = ReturnType<typeof usePublishManuscript>;
