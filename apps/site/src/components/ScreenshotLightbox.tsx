import { type MouseEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ScreenshotLightboxProps {
  source: string;
  title: string;
  width: number;
  height: number;
  onClose: () => void;
}

/**
 * The enlarged screenshot, on top of the page.
 *
 * A native `<dialog>`, not a `div` with `position: fixed`: Esc closes it, the rest of the page
 * goes inert and focus does not escape behind the backdrop - all of it for free and with no
 * library.
 *
 * Zoom is a toggle, not a continuous control: the screenshots are 1440px wide and the page
 * shrinks them to fit, so the two states that matter are "the whole screen" and "real size,
 * where the scene text becomes readable again". Enlarged, the image scrolls inside the frame,
 * and the point that was clicked is the one that ends up in the middle.
 */
export function ScreenshotLightbox({
  source,
  title,
  width,
  height,
  onClose,
}: ScreenshotLightboxProps) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    // No cleanup that closes the dialog: `close()` fires the native `close` event, which is the
    // same path as Esc and would call `onClose`. In `StrictMode` the effect mounts, cleans up and
    // mounts again - and the screenshot closed itself on the first click. Unmounting already
    // removes the element from the DOM, which is what closes the top layer. The guard covers the
    // second mount: `showModal` on an already-open dialog throws.
    if (element && !element.open) element.showModal?.();
  }, []);

  /** Where the reader clicked, as a fraction of the image: the point that ends up centred after zooming. */
  const focus = useRef({ horizontal: 0.5, vertical: 0.5 });

  const toggleZoom = (event: MouseEvent<HTMLImageElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    focus.current = {
      horizontal: (event.clientX - rect.left) / rect.width,
      vertical: (event.clientY - rect.top) / rect.height,
    };
    setZoomed((previous) => !previous);
  };

  // `useLayoutEffect`, not `requestAnimationFrame`: the layout effect runs after the DOM already
  // has the image at full size, and it runs even with the tab hidden - where rAF does not fire
  // and the scroll would stay in the corner.
  useLayoutEffect(() => {
    const area = viewport.current;
    if (!zoomed || !area) return;
    area.scrollLeft = focus.current.horizontal * area.scrollWidth - area.clientWidth / 2;
    area.scrollTop = focus.current.vertical * area.scrollHeight - area.clientHeight / 2;
  }, [zoomed]);

  return (
    <dialog
      ref={dialog}
      className="lightbox"
      aria-label={title}
      onClose={onClose}
      // Clicking the backdrop closes it: with the `<dialog>` stretched out, the target is the element
      // itself only when the click lands outside the content.
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
    >
      <div className="lightbox-bar">
        <h3>{title}</h3>
        <button type="button" onClick={onClose} aria-label={t('showcase.lightbox.close')}>
          ✕
        </button>
      </div>
      <div className={`lightbox-viewport${zoomed ? ' is-zoomed' : ''}`} ref={viewport}>
        <img src={source} alt={title} width={width} height={height} onClick={toggleZoom} />
      </div>
      <p className="lightbox-hint">
        {t(zoomed ? 'showcase.lightbox.shrink' : 'showcase.lightbox.zoom')}
      </p>
    </dialog>
  );
}
