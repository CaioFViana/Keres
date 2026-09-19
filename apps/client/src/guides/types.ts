/**
 * Shared vocabulary of the guided tours. A tour id is the route name of the screen it belongs to
 * (the same vocabulary as `screenHelpPage`), so "seen" state and content stay in one language.
 */

/** The two drawers a tour can end in, by navigator. */
export type GuideDrawerId = 'story-selection' | 'main-system';

/** A measured target in window coordinates, as `measureInWindow` reports. */
export interface GuideRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GuideStep {
  id: string;
  /**
   * Anchor ids whose union is spotlighted. Empty or absent means a card-only step: no
   * measurement, no scrolling, no failure mode.
   */
  anchors?: readonly string[];
  /**
   * Set for steps whose anchors live inside a drawer: entering the step opens that drawer
   * (front type only) and scrolls the union into view. Screen steps leave it unset.
   */
  drawerId?: GuideDrawerId;
  titleKey: string;
  bodyKey: string;
}

export interface Guide {
  /** Route name of the owning screen; also the id recorded in the seen history. */
  id: string;
  /** Drawer used by the guide's drawer steps and by the "Open help" link. */
  drawerId: GuideDrawerId;
  /** Help page opened by the step card's "Open help" link, when the guide has one. */
  helpPageId?: string;
  steps: readonly GuideStep[];
}
