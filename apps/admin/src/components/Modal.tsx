import type { MouseEvent, ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Modals can stack (a dialog opening another on top). Escape must close only
 * the topmost one: the handler answers only when its own overlay is the last
 * `.modal-overlay` in the document. (A mount-order stack does not work here -
 * React runs child effects before parent ones, so the inner dialog would
 * register first.)
 */

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * A dialog over the page: scrollable content, a close button at the top right, and dismissal
 * by clicking outside or pressing Escape. Used for long forms (tier editing) and for the
 * notices that used to be native `alert()` calls.
 */
export function Modal({ title, onClose, children }: ModalProps) {
  const { t } = useTranslation('admin');
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const overlays = Array.from(document.querySelectorAll('.modal-overlay'));
      if (overlays[overlays.length - 1] === overlayRef.current) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const onOverlayMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div className="modal-overlay" ref={overlayRef} onMouseDown={onOverlayMouseDown}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="detail-header modal-head">
          <h3>{title}</h3>
          <button type="button" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
