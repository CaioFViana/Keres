/**
 * The `{version, seen[]}` JSON stored in `client_settings.seen_tutorials`: which guided-tour ids
 * the device already completed or skipped. A tour id is marked only on finish or skip, never on
 * display, so an interrupted tour shows again.
 *
 * `version` is the escape hatch for a big tour redesign: parsing a version this build does not know
 * resets to empty, re-showing every tour once.
 */
export const TUTORIAL_PROGRESS_VERSION = 1;

export type FirstStoryChoice = 'create' | 'example';

/**
 * The "first story in 5 minutes" trail: which starting point the user picked, whether the trail
 * completed (the dashboard was reached afterwards), or was dismissed. Absent means never started.
 */
export interface FirstStoryProgress {
  choice: FirstStoryChoice | null;
  done: boolean;
  dismissed: boolean;
}

export interface TutorialProgress {
  version: number;
  /** Tour ids in the order they were first completed or skipped. */
  seen: string[];
  firstStory?: FirstStoryProgress;
}

export function defaultTutorialProgress(): TutorialProgress {
  return { version: TUTORIAL_PROGRESS_VERSION, seen: [] };
}

export function defaultFirstStoryProgress(): FirstStoryProgress {
  return { choice: null, done: false, dismissed: false };
}

/** Total: garbage, unknown versions and non-string entries all degrade to a usable value. */
export function parseTutorialProgress(raw: unknown): TutorialProgress {
  if (typeof raw !== 'string' || raw.trim() === '') return defaultTutorialProgress();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return defaultTutorialProgress();
  }
  if (typeof parsed !== 'object' || parsed === null) return defaultTutorialProgress();
  const { version, seen, firstStory } = parsed as {
    version?: unknown;
    seen?: unknown;
    firstStory?: unknown;
  };
  if (version !== TUTORIAL_PROGRESS_VERSION || !Array.isArray(seen)) {
    return defaultTutorialProgress();
  }
  const progress: TutorialProgress = {
    version: TUTORIAL_PROGRESS_VERSION,
    seen: [...new Set(seen.filter(isTourId))],
  };
  const trail = parseFirstStory(firstStory);
  if (trail) progress.firstStory = trail;
  return progress;
}

export function encodeTutorialProgress(progress: TutorialProgress): string {
  return JSON.stringify({
    version: progress.version,
    seen: progress.seen,
    ...(progress.firstStory ? { firstStory: progress.firstStory } : {}),
  });
}

/** Adds the id once, keeping first-seen order; returns the input untouched when already present. */
export function withTutorialSeen(progress: TutorialProgress, screenId: string): TutorialProgress {
  if (progress.seen.includes(screenId)) return progress;
  return { ...progress, seen: [...progress.seen, screenId] };
}

/** Merges a trail update onto the stored progress, starting from the default when absent. */
export function withFirstStoryProgress(
  progress: TutorialProgress,
  patch: Partial<FirstStoryProgress>,
): TutorialProgress {
  return {
    ...progress,
    firstStory: { ...(progress.firstStory ?? defaultFirstStoryProgress()), ...patch },
  };
}

/** Whether the dashboard arrival should complete the trail and celebrate it. */
export function shouldCompleteFirstStory(progress: TutorialProgress): boolean {
  const trail = progress.firstStory;
  return Boolean(trail && trail.choice && !trail.done && !trail.dismissed);
}

function isTourId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function parseFirstStory(raw: unknown): FirstStoryProgress | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const { choice, done, dismissed } = raw as {
    choice?: unknown;
    done?: unknown;
    dismissed?: unknown;
  };
  if (choice !== null && choice !== 'create' && choice !== 'example') return undefined;
  if (typeof done !== 'boolean' || typeof dismissed !== 'boolean') return undefined;
  return { choice, done, dismissed };
}
