import { createContext, useContext, useMemo } from 'react';
import {
  EMPTY_MENTION_MATCHER,
  type MentionMatcher,
  type MentionRef,
} from '../utils/entityMentions';
import type { MentionBacklink, MentionBacklinkIndex } from './mentionBacklinks';

/**
 * The story's mention matcher and the way to open one, for any component that draws text.
 *
 * Split from its providers for the same reason `ThemeContext` is: `DetailField` is a presentation
 * component whose entire import graph is asserted to stay clear of `db/`, `services/` and `state/`
 * (see `test/architecture/importBoundaries.test.ts`). Here the hook costs `react` and two types.
 *
 * There are **two** contexts because the two halves have different lifetimes:
 *
 * - the matcher is built once per story, high in the tree (`MentionMatcherProvider`), so a story
 *   with hundreds of entities is queried and indexed once rather than per drawer stack;
 * - `openMention` needs the drawer's navigation object, which only exists *inside* a drawer screen,
 *   so it is supplied per screen through the navigator's `screenLayout`
 *   (`MentionNavigationProvider`).
 *
 * Both default to inert rather than throwing, unlike `useTheme`: a detail screen rendered outside
 * either provider - a test, the story-selection stack - should draw plain text, not crash.
 */

export const MentionMatcherContext = createContext<MentionMatcher>(EMPTY_MENTION_MATCHER);
export const MentionBacklinksContext = createContext<MentionBacklinkIndex>(new Map());

export type OpenMention = (ref: MentionRef) => void;

const NO_OP: OpenMention = () => {};

export const MentionNavigationContext = createContext<OpenMention>(NO_OP);

export interface MentionsAccess {
  matcher: MentionMatcher;
  openMention: OpenMention;
}

export const useMentions = (): MentionsAccess => {
  const matcher = useContext(MentionMatcherContext);
  const openMention = useContext(MentionNavigationContext);
  return useMemo(() => ({ matcher, openMention }), [matcher, openMention]);
};

export const useMentionBacklinks = (type: MentionRef['type'], id: string): MentionBacklink[] => {
  const backlinks = useContext(MentionBacklinksContext);
  return backlinks.get(`${type}:${id}`) ?? [];
};
