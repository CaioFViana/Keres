import { useEffect, useState } from 'react';
import { fetchCoverUrl } from '@/showcase/api/showcaseApi';

/**
 * The cover of a story, when it has one: drawn small beside a card, or large on the story's page. With a `workId`
 * it is the cover of one released work of the story instead. Nothing at all (no empty frame) for a story without a
 * cover, or while the picture is on its way.
 */
export function StoryCover({
  storyId,
  workId,
  hasCover,
  className,
}: {
  storyId: string;
  workId?: string;
  hasCover: boolean | undefined;
  className: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!hasCover) {
      setUrl(null);
      return;
    }
    let alive = true;
    let made: string | null = null;
    void fetchCoverUrl(storyId, workId).then((address) => {
      if (!alive) {
        if (address) URL.revokeObjectURL(address);
        return;
      }
      made = address;
      setUrl(address);
    });
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [storyId, workId, hasCover]);

  if (!url) return null;
  return <img src={url} alt="" className={className} loading="lazy" />;
}
