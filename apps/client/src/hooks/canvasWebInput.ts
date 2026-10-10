import type { Platform } from 'react-native';
import { KEY_PAN_STEP, KEY_ZOOM_STEP, wheelZoomFactor } from './canvasCameraMath';

export interface CanvasWebInputHandlers {
  /** Zoom by `factor` keeping fixed the point under `focus` (screen pixels within the canvas). */
  zoomAt(factor: number, focus: { x: number; y: number }): void;
  /** Move the camera by this many screen pixels (positive moves the drawing right and down). */
  panBy(dx: number, dy: number): void;
  fit(): void;
}

interface DomNode {
  addEventListener?: (type: string, listener: (event: never) => void, options?: unknown) => void;
  removeEventListener?: (type: string, listener: (event: never) => void, options?: unknown) => void;
  getBoundingClientRect?: () => { left: number; top: number; width: number; height: number };
  focus?: (options?: { preventScroll: boolean }) => void;
}

interface WheelLike {
  deltaY: number;
  deltaMode: number;
  clientX: number;
  clientY: number;
  preventDefault: () => void;
}

interface KeyLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  target?: { tagName?: string; isContentEditable?: boolean } | null;
  preventDefault: () => void;
}

const TEXT_ENTRY_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/**
 * Mouse wheel and keyboard for a canvas on web: the wheel zooms under the cursor; `+`, `-` and `0`
 * zoom and fit; the arrows pan. Native has neither, a host node without DOM listeners (the test
 * renderer) takes none, and typing into a field inside the canvas is left alone.
 * Returns the detach cleanup, or undefined when nothing was attached.
 */
export function attachCanvasWebInput(
  container: { current: unknown },
  platformOS: typeof Platform.OS,
  handlers: CanvasWebInputHandlers,
): (() => void) | undefined {
  if (platformOS !== 'web') return undefined;
  const node = container.current as DomNode | null;
  if (!node?.addEventListener || !node.removeEventListener) return undefined;

  const onWheel = (event: WheelLike) => {
    event.preventDefault();
    const box = node.getBoundingClientRect?.();
    handlers.zoomAt(wheelZoomFactor(event.deltaY, event.deltaMode), {
      x: event.clientX - (box?.left ?? 0),
      y: event.clientY - (box?.top ?? 0),
    });
  };

  const onKeyDown = (event: KeyLike) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    if (target?.isContentEditable || (target?.tagName && TEXT_ENTRY_TAGS.has(target.tagName))) {
      return;
    }
    const box = node.getBoundingClientRect?.();
    const centre = { x: (box?.width ?? 0) / 2, y: (box?.height ?? 0) / 2 };
    switch (event.key) {
      case '+':
      case '=':
        handlers.zoomAt(KEY_ZOOM_STEP, centre);
        break;
      case '-':
      case '_':
        handlers.zoomAt(1 / KEY_ZOOM_STEP, centre);
        break;
      case '0':
        handlers.fit();
        break;
      case 'ArrowLeft':
        handlers.panBy(KEY_PAN_STEP, 0);
        break;
      case 'ArrowRight':
        handlers.panBy(-KEY_PAN_STEP, 0);
        break;
      case 'ArrowUp':
        handlers.panBy(0, KEY_PAN_STEP);
        break;
      case 'ArrowDown':
        handlers.panBy(0, -KEY_PAN_STEP);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  // A pointer press gives the canvas the keyboard, since the responder system swallows the focus.
  const onPointerDown = () => node.focus?.({ preventScroll: true });

  // Passive off: the wheel must be allowed to cancel the page's own scrolling.
  node.addEventListener('wheel', onWheel as never, { passive: false });
  node.addEventListener('keydown', onKeyDown as never);
  node.addEventListener('pointerdown', onPointerDown as never);
  return () => {
    node.removeEventListener?.('wheel', onWheel as never);
    node.removeEventListener?.('keydown', onKeyDown as never);
    node.removeEventListener?.('pointerdown', onPointerDown as never);
  };
}
