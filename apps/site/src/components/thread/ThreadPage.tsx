import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { createThread } from './thread';
import './thread.css';

/**
 * A page the thread runs through (see `thread.ts` for the markers it reads). The frame carries the page's
 * own custom properties - a story's palette tints the thread because the frame is what wears it.
 */
export function ThreadPage({
  children,
  className,
  style,
  testId,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  testId?: string;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const content = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!frame.current || !svg.current || !content.current) return;
    const thread = createThread(frame.current, svg.current, content.current);
    return () => thread.destroy();
  }, []);

  return (
    <div
      ref={frame}
      className={className ? `thread-page ${className}` : 'thread-page'}
      {...(style ? { style } : {})}
      {...(testId ? { 'data-testid': testId } : {})}
    >
      <svg ref={svg} className="thread" aria-hidden="true" focusable="false" />
      <div ref={content} className="thread-content">
        {children}
      </div>
    </div>
  );
}
