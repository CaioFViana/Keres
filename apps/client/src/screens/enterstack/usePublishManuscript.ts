import type { ManuscriptFormat } from '@keres/shared';
import { isLooseScene } from '@keres/shared';
import { useCallback, useState } from 'react';
import type { AppDrizzleClient } from '../../db';
import type { RouteSelect, StorySelect } from '../../db/schema';
import type { PublishManuscriptOptions } from '../../services/PublicationApiService';
import { createChapterService } from '../../services/storymanagement/ChapterService';
import { createRouteService } from '../../services/storymanagement/RouteService';
import { createSceneService } from '../../services/storymanagement/SceneService';

/** The manuscript choice of one expanded story on the publish screen. */
export function usePublishManuscript(drizzleDb: AppDrizzleClient) {
  const [attachManuscript, setAttachManuscript] = useState(false);
  const [manuscriptFormat, setManuscriptFormat] = useState<ManuscriptFormat>('docx');
  const [includeLooseScenes, setIncludeLooseScenes] = useState(true);
  const [manuscriptRouteId, setManuscriptRouteId] = useState<string | null>(null);
  const [manuscriptRoutes, setManuscriptRoutes] = useState<RouteSelect[]>([]);
  const [manuscriptLooseCount, setManuscriptLooseCount] = useState(0);

  // What the manuscript section needs: branching picks one of the story's routes,
  // linear counts its loose scenes the same way the manuscript screen does.
  const resetForStory = useCallback(
    (story: StorySelect) => {
      setAttachManuscript(false);
      setManuscriptFormat('docx');
      setIncludeLooseScenes(true);
      setManuscriptRouteId(null);
      setManuscriptRoutes([]);
      setManuscriptLooseCount(0);
      void (async () => {
        try {
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
    (story: StorySelect, t: (key: string) => string): PublishManuscriptOptions | undefined => {
      const effectiveRouteId =
        story.type === 'branching'
          ? (manuscriptRouteId ?? manuscriptRoutes[0]?.id ?? null)
          : null;
      if (!attachManuscript || (story.type === 'branching' && !effectiveRouteId)) {
        return undefined;
      }
      return {
        format: manuscriptFormat,
        includeLooseScenes: story.type === 'linear' ? includeLooseScenes : true,
        ...(effectiveRouteId ? { routeId: effectiveRouteId } : {}),
        labels: {
          goToPage: t('export_manuscript_go_to_page'),
          goToScene: t('export_manuscript_go_to_scene'),
          looseHeading: t('export_manuscript_loose_heading'),
          tocHeading: t('export_manuscript_index_heading'),
        },
      };
    },
    [attachManuscript, includeLooseScenes, manuscriptFormat, manuscriptRouteId, manuscriptRoutes],
  );

  return {
    attachManuscript,
    setAttachManuscript,
    manuscriptFormat,
    setManuscriptFormat,
    includeLooseScenes,
    setIncludeLooseScenes,
    manuscriptRouteId,
    setManuscriptRouteId,
    manuscriptRoutes,
    manuscriptLooseCount,
    resetForStory,
    buildOptions,
  };
}

export type PublishManuscriptState = ReturnType<typeof usePublishManuscript>;
