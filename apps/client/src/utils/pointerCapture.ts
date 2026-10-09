import type { GestureResponderEvent } from 'react-native';

/** Routes the rest of a web pointer gesture to the element it started on. A no-op on native. */
export function capturePointer(event: GestureResponderEvent | undefined): void {
  const pointerId = (event?.nativeEvent as { pointerId?: number } | undefined)?.pointerId;
  const target = event?.currentTarget as unknown as
    | { setPointerCapture?: (id: number) => void }
    | undefined;
  if (pointerId != null) target?.setPointerCapture?.(pointerId);
}

/** Hands a captured web pointer back when its gesture ends. A no-op on native. */
export function releasePointer(event: GestureResponderEvent | undefined): void {
  const pointerId = (event?.nativeEvent as { pointerId?: number } | undefined)?.pointerId;
  const target = event?.currentTarget as unknown as
    | { releasePointerCapture?: (id: number) => void }
    | undefined;
  if (pointerId != null) target?.releasePointerCapture?.(pointerId);
}
