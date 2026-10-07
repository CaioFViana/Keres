import type { GuideRect } from './types';

/** The gap the step card keeps from the window's edges, in points. */
export const CARD_MARGIN = 20;

interface PlacementInput {
  /** The padded hole the card must not cover, in window coordinates; none when the step has no target. */
  spot: GuideRect | null;
  windowHeight: number;
  /** The card's measured height, or its best guess before it is measured. */
  cardHeight: number;
  topInset: number;
  bottomInset: number;
}

/**
 * Which edge the step card sits on. It rests at the bottom, where a thumb reaches, and moves to the
 * top whenever the bottom would cover the very thing it is talking about - the last group of a menu,
 * a button on the foot of the screen. When it fits on neither side it takes the one it covers less.
 */
export function cardPlacement({
  spot,
  windowHeight,
  cardHeight,
  topInset,
  bottomInset,
}: PlacementInput): 'top' | 'bottom' {
  if (!spot) return 'bottom';
  const spotBottom = spot.y + spot.height;
  const cardTopAtBottom = windowHeight - bottomInset - CARD_MARGIN - cardHeight;
  const cardBottomAtTop = topInset + CARD_MARGIN + cardHeight;
  const coveredAtBottom = Math.max(0, spotBottom - cardTopAtBottom);
  const coveredAtTop = Math.max(0, cardBottomAtTop - spot.y);
  if (coveredAtBottom === 0) return 'bottom';
  if (coveredAtTop === 0) return 'top';
  return coveredAtTop < coveredAtBottom ? 'top' : 'bottom';
}
