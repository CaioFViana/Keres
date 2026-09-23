export interface ScrollIntoViewInput {
  segTop: number;
  segBottom: number;
  viewTop: number;
  viewBottom: number;
  /** Comfort zone kept clear above and below the segment, in the same units. */
  margin: number;
}

/**
 * How far a scroll view must move to bring a segment into view: negative scrolls up,
 * positive scrolls down, null means it already sits inside the margins. The move is
 * the minimum that satisfies the margin, so a visible match never jumps.
 */
export function computeScrollAdjustment({
  segTop,
  segBottom,
  viewTop,
  viewBottom,
  margin,
}: ScrollIntoViewInput): number | null {
  const minVisible = viewTop + margin;
  const maxVisible = viewBottom - margin;
  if (segTop < minVisible) return segTop - minVisible;
  if (segBottom > maxVisible) return segBottom - maxVisible;
  return null;
}
