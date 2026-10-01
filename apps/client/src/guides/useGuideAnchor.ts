import { useCallback } from 'react';
import type { GuideRect } from './types';
import { registerGuideAnchor, screenAnchorId, unregisterGuideAnchor } from './anchorRegistry';

interface MeasurableNode {
  measureInWindow?: (
    callback: (x: number, y: number, width: number, height: number) => void,
  ) => void;
}

function measureNode(node: unknown): Promise<GuideRect | null> {
  const measure = (node as MeasurableNode | null)?.measureInWindow;
  if (typeof measure !== 'function') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      measure.call(node, (x, y, width, height) => resolve({ x, y, width, height }));
    } catch {
      resolve(null);
    }
  });
}

/**
 * Registers a host view as a tour target. The ref callback fits any `ref` prop; measurement
 * runs through `measureInWindow` (window coordinates, valid at read time) and degrades to
 * `null` wherever measuring is unavailable, which the host reads as "card-only step".
 *
 * Anchored wrappers need `collapsable={false}` on Android, or view flattening removes the
 * node being measured.
 */
export function useGuideAnchor(id: string): (node: unknown) => void {
  return useCallback(
    (node: unknown) => {
      if (!node) {
        unregisterGuideAnchor(id);
        return;
      }
      registerGuideAnchor(id, () => measureNode(node));
    },
    [id],
  );
}

/** Screen-region anchors in one call: `screen:<Screen>:<part>`. */
export function useScreenAnchor(screen: string, part: string): (node: unknown) => void {
  return useGuideAnchor(screenAnchorId(screen, part));
}
