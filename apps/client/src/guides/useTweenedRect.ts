import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import type { GuideRect } from './types';

/** How long the hole and the card take to slide to the next target. */
export const SLIDE_MS = 280;

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

  const key = target ? `${target.x}|${target.y}|${target.width}|${target.height}` : '';
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` stands for the numbers in `target`; the object itself is new on every render.
  useEffect(() => {
    const from = current.current;
    const same =
      from &&
      target &&
      from.x === target.x &&
      from.y === target.y &&
      from.width === target.width &&
      from.height === target.height;
    if (same) return;
    if (!from || !target || duration <= 0 || reduceMotion.current) {
      current.current = target;
      setRect(target);
      return;
    }
    const start = Date.now();
    let frame = 0;
    const tick = () => {
      const progress = Math.min(1, (Date.now() - start) / duration);
      const amount = easeOutCubic(progress);
      const next = {
        x: lerp(from.x, target.x, amount),
        y: lerp(from.y, target.y, amount),
        width: lerp(from.width, target.width, amount),
        height: lerp(from.height, target.height, amount),
      };
      current.current = progress >= 1 ? target : next;
      setRect(current.current);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [key, duration]);

  return rect;
}
