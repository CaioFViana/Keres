import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import type { GuideRect } from './types';

/** How long the hole and the card take to slide to the next target. */
export const SLIDE_MS = 220;

const easeOutCubic = (progress: number) => 1 - (1 - progress) ** 3;

const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;

/**
 * The rect to draw now, sliding toward `target`. It slides only from one target to another: a hole
 * appearing or going away, or a person who asked the system for less motion, gets the new rect at
 * once. The frames are plain state updates (a handful of small paths), not a native animation: the
 * hole is a Skia path string, which an `Animated` value cannot drive.
 */
export function useTweenedRect(target: GuideRect | null, duration = SLIDE_MS): GuideRect | null {
  const [rect, setRect] = useState<GuideRect | null>(target);
  const current = useRef<GuideRect | null>(target);
  const reduceMotion = useRef(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((enabled) => {
        if (alive) reduceMotion.current = enabled;
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const present = target !== null;
  const x = target?.x ?? 0;
  const y = target?.y ?? 0;
  const width = target?.width ?? 0;
  const height = target?.height ?? 0;
  useEffect(() => {
    const next: GuideRect | null = present ? { x, y, width, height } : null;
    const from = current.current;
    const same =
      from &&
      next &&
      from.x === next.x &&
      from.y === next.y &&
      from.width === next.width &&
      from.height === next.height;
    if (same) return;
    if (!from || !next || duration <= 0 || reduceMotion.current) {
      current.current = next;
      setRect(next);
      return;
    }
    const start = Date.now();
    let frame = 0;
    const tick = () => {
      const progress = Math.min(1, (Date.now() - start) / duration);
      const amount = easeOutCubic(progress);
      const moved = {
        x: lerp(from.x, next.x, amount),
        y: lerp(from.y, next.y, amount),
        width: lerp(from.width, next.width, amount),
        height: lerp(from.height, next.height, amount),
      };
      current.current = progress >= 1 ? next : moved;
      setRect(current.current);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [present, x, y, width, height, duration]);

  return rect;
}
