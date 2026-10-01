import { useCallback, useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * The DOM surface the clip reads: a real `Range` satisfies this structurally.
 * Kept minimal so jest (no DOM) tests the clip with hand-rolled stubs.
 */
export interface ClippableRange {
  readonly startContainer: unknown;
  readonly endContainer: unknown;
  intersectsNode(node: unknown): boolean;
  cloneRange(): ClippableRange;
  setStart(node: unknown, offset: number): void;
  setEnd(node: unknown, offset: number): void;
  toString(): string;
}

/** A real `Element` satisfies this structurally. */
export interface ClippableContainer {
  contains(node: unknown | null): boolean;
  readonly childNodes: { readonly length: number };
}

/**
 * The selection's text clipped to one field container: fully inside returns it
 * all, fully outside returns null, a straddle returns only the within-field
 * part. Collapsed carets clip to null - there is no selection to pre-fill.
 * Pure over the structural interfaces above.
 */
export function clipRangeToContainer(
  range: ClippableRange,
  container: ClippableContainer,
): string | null {
  if (!range.intersectsNode(container)) return null;
  const clipped = range.cloneRange();
  if (!container.contains(clipped.startContainer)) clipped.setStart(container, 0);
  if (!container.contains(clipped.endContainer)) {
    clipped.setEnd(container, container.childNodes.length);
  }
  const text = clipped.toString().trim();
  return text ? text : null;
}

const containers = new Map<string, ClippableContainer>();
const clippedByKey = new Map<string, string>();

function webDocument(): Document | null {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return null;
  return document;
}

function refreshClipped(): void {
  const doc = webDocument();
  if (!doc) return;
  const selection = doc.getSelection();
  const range =
    selection && selection.rangeCount > 0 && !selection.isCollapsed
      ? (selection.getRangeAt(0) as unknown as ClippableRange)
      : null;
  for (const [key, container] of containers) {
    const clipped = range ? clipRangeToContainer(range, container) : null;
    if (clipped) clippedByKey.set(key, clipped);
    else clippedByKey.delete(key);
  }
}

function setListening(doc: Document, on: boolean): void {
  if (on) doc.addEventListener('selectionchange', refreshClipped);
  else doc.removeEventListener('selectionchange', refreshClipped);
}

/**
 * Track one commentable field's container (a `View` ref, which is the DOM
 * element on web) under `key`. Web-only: native `Text` exposes no selection,
 * so registration is a no-op there and reads always return null.
 * The clipped text snapshots on every `selectionchange` - by click time the
 * button press has already collapsed the live selection.
 */
export function trackSelectionContainer(key: string, node: unknown): void {
  const doc = webDocument();
  if (!doc) return;
  if (node && typeof (node as ClippableContainer).contains === 'function') {
    const wasEmpty = containers.size === 0;
    containers.set(key, node as ClippableContainer);
    if (wasEmpty) setListening(doc, true);
    refreshClipped();
    return;
  }
  if (containers.delete(key)) clippedByKey.delete(key);
  if (containers.size === 0) setListening(doc, false);
}

/** The last selection clipped to `key`'s container, or null when none applies. */
export function readClippedSelection(key: string): string | null {
  return clippedByKey.get(key) ?? null;
}

/** One field's registration: attach the ref to its container, read on open. */
export function useWebSelectionClip(key: string): {
  containerRef: (node: unknown) => void;
  readSelection: () => string | null;
} {
  useEffect(() => () => trackSelectionContainer(key, null), [key]);
  const containerRef = useCallback((node: unknown) => trackSelectionContainer(key, node), [key]);
  const readSelection = useCallback(() => readClippedSelection(key), [key]);
  return { containerRef, readSelection };
}
