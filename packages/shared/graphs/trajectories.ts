/**
 * Derived story trajectories: where a character or item has been, in narrative order.
 * Pure data - no storage, no sync. A trajectory is a list of stops (`sceneId` +
 * `locationId`); map screens project stops onto their points, detail screens list them.
 *
 * Ordering is honest per story shape. Linear stories sort by `(chapter.index,
 * scene.index)` - the same pair the rest of the app treats as canonical order;
 * unchaptered scenes sort after every chapter. Branching stories order by an explicit
 * Route's steps (loops and revisits preserved); without selected steps there is no
 * order to show, so the result is empty rather than a silent best-effort.
 */

export interface TrajectoryScene {
  id: string;
  chapterId: string | null;
  index: number;
  locationId: string | null;
}

export interface TrajectoryChapter {
  id: string;
  index: number;
}

export interface TrajectoryStep {
  sceneId: string;
  position: number;
}

export interface TrajectoryStop {
  sceneId: string;
  locationId: string;
}

export interface TrajectoryInput {
  scenes: readonly TrajectoryScene[];
  chapters: readonly TrajectoryChapter[];
  /** Scenes relevant to the entity: appearances for a character, journey scenes for an item. */
  relevantSceneIds: ReadonlySet<string>;
  storyType: 'linear' | 'branching';
  /** Required for branching stories; ignored for linear ones. */
  steps?: readonly TrajectoryStep[];
}

/**
 * Ordered stops for one entity. Scenes without a location cannot be placed and are
 * skipped; consecutive stops at the same location collapse into one.
 */
export function buildTrajectoryStops(input: TrajectoryInput): TrajectoryStop[] {
  const sceneById = new Map(input.scenes.map((scene) => [scene.id, scene]));
  const orderedSceneIds =
    input.storyType === 'linear'
      ? orderLinearSceneIds(input.scenes, input.chapters, input.relevantSceneIds)
      : orderRouteSceneIds(input.steps ?? [], input.relevantSceneIds);
  const stops: TrajectoryStop[] = [];
  for (const sceneId of orderedSceneIds) {
    const locationId = sceneById.get(sceneId)?.locationId ?? null;
    if (!locationId) continue;
    if (stops.length > 0 && stops[stops.length - 1].locationId === locationId) continue;
    stops.push({ sceneId, locationId });
  }
  return stops;
}

function orderLinearSceneIds(
  scenes: readonly TrajectoryScene[],
  chapters: readonly TrajectoryChapter[],
  relevant: ReadonlySet<string>,
): string[] {
  const chapterIndexById = new Map(chapters.map((chapter) => [chapter.id, chapter.index]));
  return scenes
    .filter((scene) => relevant.has(scene.id))
    .map((scene) => ({
      id: scene.id,
      chapterIndex:
        scene.chapterId != null
          ? (chapterIndexById.get(scene.chapterId) ?? Number.MAX_SAFE_INTEGER)
          : Number.MAX_SAFE_INTEGER,
      index: scene.index,
    }))
    .sort((left, right) => left.chapterIndex - right.chapterIndex || left.index - right.index)
    .map((scene) => scene.id);
}

function orderRouteSceneIds(
  steps: readonly TrajectoryStep[],
  relevant: ReadonlySet<string>,
): string[] {
  return [...steps]
    .sort((left, right) => left.position - right.position)
    .map((step) => step.sceneId)
    .filter((sceneId) => relevant.has(sceneId));
}

export interface TrajectoryMapPoint {
  locationId: string;
  x: number;
  y: number;
}

export interface ProjectedTrajectory {
  /** World points for the stops that have a node on this map, in stop order. */
  points: { x: number; y: number }[];
  /** Stops whose location has no node on this map. */
  offMap: number;
}

/**
 * Projects stops onto one map's points (first point wins; maps keep locations unique).
 * A path needs at least two projected points to draw; callers check `points.length`.
 */
export function projectTrajectoryStops(
  stops: readonly TrajectoryStop[],
  points: readonly TrajectoryMapPoint[],
): ProjectedTrajectory {
  const pointByLocation = new Map<string, { x: number; y: number }>();
  for (const point of points) {
    if (!pointByLocation.has(point.locationId)) {
      pointByLocation.set(point.locationId, { x: point.x, y: point.y });
    }
  }
  const projected: { x: number; y: number }[] = [];
  let offMap = 0;
  for (const stop of stops) {
    const point = pointByLocation.get(stop.locationId);
    if (point) projected.push(point);
    else offMap += 1;
  }
  return { points: projected, offMap };
}
