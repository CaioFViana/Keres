import keresLogoUrl from 'virtual:keres-logo';
import { useShowcaseConfig } from '@/showcase/config/ShowcaseConfigProvider';

/**
 * Where a page's thread starts. With the Keres mark, the thread leaves the end of its hair; a server with a logo of
 * its own has the thread leave the bottom of that picture, whatever it draws.
 */
export function ThreadMark() {
  const config = useShowcaseConfig();
  const own = Boolean(config?.logoUrl);
  return (
    <div
      className="thread-origin"
      data-thread-origin
      data-ox={own ? '0.5' : '0.569'}
      data-oy={own ? '1' : '0.98'}
    >
      <img src={config?.logoUrl || keresLogoUrl} alt="" aria-hidden="true" />
    </div>
  );
}
