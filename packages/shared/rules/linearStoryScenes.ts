/** The minimum the rule needs to know about a scene. */
export interface SceneStartFinishFlags {
  id: string;
  isStart?: boolean | null;
  isFinish?: boolean | null;
}

/**
 * In a linear story there is at most one start scene and one finish scene; if the imported file
 * brings more than one, the first wins and the rest lose the flag.
 *
 * Importing happens on both sides - the client reads a `.keres` from disk, the server receives a
 * published story - and both ran the same scan, line by line, each in its own copy. The decision of
 * which scenes lose the flag is the same; all that differs is the `update` each database runs
 * afterwards.
 */
export function scenesToUnflag(scenes: readonly SceneStartFinishFlags[]): {
  start: string[];
  finish: string[];
} {
  const start: string[] = [];
  const finish: string[] = [];
  let startSeen = false;
  let finishSeen = false;

  for (const scene of scenes) {
    if (scene.isStart) {
      if (startSeen) start.push(scene.id);
      else startSeen = true;
    }
    if (scene.isFinish) {
      if (finishSeen) finish.push(scene.id);
      else finishSeen = true;
    }
  }

  return { start, finish };
}
