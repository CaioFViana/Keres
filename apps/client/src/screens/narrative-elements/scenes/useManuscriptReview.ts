import { useCallback, useMemo, useRef, useState } from 'react';
import type { TFunction } from 'i18next';
import type { ManuscriptSection } from '@keres/shared';
import type { HeaderAction } from '../../../components/common/navigation/HeaderActions/HeaderActions';
import type {
  ManuscriptReviewBar,
  ManuscriptReviewThread,
} from '../../../components/features/manuscript/ManuscriptReviewTools/ManuscriptReviewTools';
import { trackSelectionContainer } from '../../../hooks/useWebSelectionClip';
import { useSceneBodyComments } from '../../../hooks/useSceneBodyComments';

export type ManuscriptReviewMode = 'read' | 'review';

export const MANUSCRIPT_MODES: {
  mode: ManuscriptReviewMode;
  icon: HeaderAction['icon'];
  activeIcon: HeaderAction['icon'];
}[] = [
  { mode: 'read', icon: 'book-outline', activeIcon: 'book' },
  { mode: 'review', icon: 'chatbubbles-outline', activeIcon: 'chatbubbles' },
];

/** Header toggle mirroring the scene editor's mode switch (no write mode here). */
export function manuscriptModeHeaderActions(
  t: TFunction,
  mode: ManuscriptReviewMode,
  onModeChange: (mode: ManuscriptReviewMode) => void,
): HeaderAction[] {
  return MANUSCRIPT_MODES.map((candidate) => {
    const active = candidate.mode === mode;
    return {
      id: `mode-${candidate.mode}`,
      icon: active ? candidate.activeIcon : candidate.icon,
      label: t(`manuscript_mode_${candidate.mode}`),
      active,
      onPress: () => onModeChange(candidate.mode),
    };
  });
}

export type ManuscriptSceneSection = Extract<ManuscriptSection, { kind: 'scene' }>;

/**
 * Which scene the fixed review bar addresses: the reader's current section when it
 * is a scene, else the nearest scene (next first, then back), else the first scene
 * when nothing is positioned yet. Null only when the manuscript has no scenes.
 */
export function resolveReviewScene(
  sections: ManuscriptSection[],
  index: number | null,
): ManuscriptSceneSection | null {
  if (index == null) {
    return sections.find((section): section is ManuscriptSceneSection => section.kind === 'scene') ?? null;
  }
  const current = sections[index];
  if (current?.kind === 'scene') return current;
  for (let next = index + 1; next < sections.length; next += 1) {
    const section = sections[next];
    if (section?.kind === 'scene') return section;
  }
  for (let prev = index - 1; prev >= 0; prev -= 1) {
    const section = sections[prev];
    if (section?.kind === 'scene') return section;
  }
  return null;
}

/**
 * Everything the manuscript's review mode owns: the scenes' body threads (the same
 * `body` threads the scene editor reads and writes), per-scene excerpt lists for
 * marking, the open thread, the bar's target scene, and stable per-row selection
 * refs for web excerpt pre-fill.
 */
export function useManuscriptReview(
  storyId: string | undefined,
  sections: ManuscriptSection[],
  currentSectionIndex: number | null,
) {
  const sceneIds = useMemo(
    () => [
      ...new Set(
        sections.flatMap((section) => (section.kind === 'scene' ? [section.scene.id] : [])),
      ),
    ],
    [sections],
  );
  const {
    commentsBySceneId,
    canComment,
    isStoryOwner,
    currentUserId,
    addComment,
    updateComment,
    deleteComment,
  } = useSceneBodyComments(storyId, sceneIds);

  const excerptsBySceneId = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const [sceneId, sceneComments] of Object.entries(commentsBySceneId)) {
      const excerpts = sceneComments.flatMap((comment) =>
        comment.excerptText ? [comment.excerptText] : [],
      );
      if (excerpts.length > 0) map[sceneId] = excerpts;
    }
    return map;
  }, [commentsBySceneId]);

  const [threadSceneId, setThreadSceneId] = useState<string | null>(null);
  const openThread = useCallback((sceneId: string) => setThreadSceneId(sceneId), []);
  const closeThread = useCallback(() => setThreadSceneId(null), []);
  // Route loops visit one scene twice: the thread is per scene, the first row wins.
  const threadSection =
    sections.find(
      (section): section is ManuscriptSceneSection =>
        section.kind === 'scene' && section.scene.id === threadSceneId,
    ) ?? null;

  const barSection = resolveReviewScene(sections, currentSectionIndex);
  // Bar and thread props, ready-made for the chrome: building them here (not in the
  // screen's JSX) is what keeps `ManuscriptScreen` under the file-size ceiling.
  const bar: ManuscriptReviewBar | null = useMemo(
    () =>
      barSection
        ? {
            sceneLabel: `${barSection.position}. ${barSection.scene.name}`,
            count: (commentsBySceneId[barSection.scene.id] ?? []).length,
          }
        : null,
    [barSection, commentsBySceneId],
  );
  const thread: ManuscriptReviewThread | null = useMemo(
    () =>
      threadSection
        ? {
            key: threadSection.key,
            sceneId: threadSection.scene.id,
            label: `${threadSection.position}. ${threadSection.scene.name}`,
            snapshot: threadSection.scene.body ?? '',
            comments: commentsBySceneId[threadSection.scene.id] ?? [],
          }
        : null,
    [threadSection, commentsBySceneId],
  );
  const openBarThread = useCallback(() => {
    if (barSection) openThread(barSection.scene.id);
  }, [barSection, openThread]);
  // The thread posts against the scene's saved body, like the editor posts against
  // its live doc: both anchor the same `body` field, so both stay in sync for free.
  const submitThread = useCallback(
    (input: { commentText: string; excerptText: string | null; criticality: number }) => {
      if (!threadSection) return Promise.resolve();
      return addComment(threadSection.scene.id, {
        ...input,
        contentSnapshot: threadSection.scene.body,
      });
    },
    [threadSection, addComment],
  );

  // Stable per-row callbacks: an inline closure would unregister/re-register the
  // selection container on every render of every visible row.
  const rowRefCallbacks = useRef(new Map<string, (node: unknown) => void>());
  const rowRefFor = useCallback((key: string) => {
    let ref = rowRefCallbacks.current.get(key);
    if (!ref) {
      ref = (node: unknown) => trackSelectionContainer(key, node);
      rowRefCallbacks.current.set(key, ref);
    }
    return ref;
  }, []);

  return {
    commentsBySceneId,
    excerptsBySceneId,
    canComment,
    isStoryOwner,
    currentUserId,
    addComment,
    updateComment,
    deleteComment,
    openThread,
    closeThread,
    rowRefFor,
    bar,
    thread,
    openBarThread,
    submitThread,
  };
}
