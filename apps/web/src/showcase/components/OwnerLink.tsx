import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

/** Where an author's page lives on the site. */
export function authorPath(username: string): string {
  return `/author/${encodeURIComponent(username)}`;
}

/**
 * A link to an author's page that may sit inside another link (a story card is one): an anchor cannot hold an
 * anchor, so this is a focusable element that navigates on its own and keeps the click from reaching the card.
 */
export function OwnerLink({
  username,
  className,
  children,
}: {
  username: string;
  className?: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const open = (event: MouseEvent | KeyboardEvent) => {
    event.preventDefault();
    event.stopPropagation();
    navigate(authorPath(username));
  };
  return (
    <span
      role="link"
      tabIndex={0}
      className={className ? `${className} owner-link` : 'owner-link'}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === 'Enter') open(event);
      }}
    >
      {children}
    </span>
  );
}
