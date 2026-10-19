import type { GuideRect } from './types';

/** The gap the step card keeps from the window's edges, in points. */
export const CARD_MARGIN = 20;
/** The gap between the card and the target it points at, which the arrow crosses. */
export const CARD_GAP = 14;
/** The widest the card gets. */
export const CARD_MAX_WIDTH = 480;
/** How far from the card's corners the arrow keeps, so it never sits on a rounded corner. */
const ARROW_INSET = 28;

export type CardMode = 'below' | 'above' | 'bottom' | 'top';

export interface CardLayout {
  mode: CardMode;
  width: number;
  left: number;
  /** Distance from the top of the window, for every mode: an edge is just a place the card rests. */
  top: number;
  /** Where the arrow sits along the card's width, when the card points at the target. */
  arrowX?: number;
}

interface LayoutInput {
  /** The padded hole as it is drawn now (it slides between steps); none for a step with no target. */
  spot: GuideRect | null;
  /** The hole the card is going to; the card chooses its side from this, so it never flips mid-slide. */
  target: GuideRect | null;
  windowWidth: number;
  windowHeight: number;
  /** The card's measured height, or its best guess before it is measured. */
  cardHeight: number;
  topInset: number;
  bottomInset: number;
}

/** The mode: next to the target, below it if there is room, above it if not, else on an edge. */
export function cardMode({
  target,
  windowHeight,
  cardHeight,
  topInset,
  bottomInset,
}: Pick<
  LayoutInput,
  'target' | 'windowHeight' | 'cardHeight' | 'topInset' | 'bottomInset'
>): CardMode {
  if (!target) return 'bottom';
  // A target scrolled out of the window cannot be pointed at: the card rests on the bottom edge, where
  // it can be read, instead of following the target out of sight.
  if (target.y + target.height <= topInset || target.y >= windowHeight - bottomInset)
    return 'bottom';
  const need = cardHeight + CARD_GAP;
  const below = windowHeight - bottomInset - CARD_MARGIN - (target.y + target.height);
  const above = target.y - topInset - CARD_MARGIN;
  if (below >= need) return 'below';
  if (above >= need) return 'above';
  // Too big a target for the card to sit beside: it rests on the edge that covers less of it.
  const cardTopAtBottom = windowHeight - bottomInset - CARD_MARGIN - cardHeight;
  const cardBottomAtTop = topInset + CARD_MARGIN + cardHeight;
  const coveredAtBottom = Math.max(0, target.y + target.height - cardTopAtBottom);
  const coveredAtTop = Math.max(0, cardBottomAtTop - target.y);
  return coveredAtTop < coveredAtBottom ? 'top' : 'bottom';
}

/** Where the arrow sits along a card that starts at `left`, under the middle of the hole, kept off the corners. */
export function arrowOffset(spot: GuideRect, left: number, width: number): number {
  return Math.min(Math.max(spot.x + spot.width / 2 - left, ARROW_INSET), width - ARROW_INSET);
}

/**
 * Where the step card goes. It points at its target like a balloon - below it, or above when the
 * bottom is too tight - following the hole as it slides from one step to the next, and gives way
 * to an edge of the window only when the target is too large to sit beside. It never covers what
 * it is explaining.
 */
export function cardLayout(input: LayoutInput): CardLayout {
  const { spot, windowWidth, windowHeight, cardHeight, topInset, bottomInset } = input;
  const width = Math.min(CARD_MAX_WIDTH, windowWidth - CARD_MARGIN * 2);
  const centred = (windowWidth - width) / 2;
  const mode = cardMode(input);
  if (!spot || mode === 'bottom' || mode === 'top') {
    return mode === 'top'
      ? { mode, width, left: centred, top: topInset + CARD_MARGIN }
      : {
          mode: 'bottom',
          width,
          left: centred,
          top: windowHeight - bottomInset - CARD_MARGIN - cardHeight,
        };
  }
  const centreX = spot.x + spot.width / 2;
  const left = Math.min(
    Math.max(centreX - width / 2, CARD_MARGIN),
    windowWidth - CARD_MARGIN - width,
  );
  const arrowX = arrowOffset(spot, left, width);
  const wanted =
    mode === 'below' ? spot.y + spot.height + CARD_GAP : spot.y - CARD_GAP - cardHeight;
  // Always inside the window, even while the hole is still sliding in from somewhere else.
  const top = Math.min(
    Math.max(wanted, topInset + CARD_MARGIN),
    windowHeight - bottomInset - CARD_MARGIN - cardHeight,
  );
  return { mode, width, left, top, arrowX };
}
