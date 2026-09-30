import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import type { ShowcaseStoryDetail } from '@keres/shared';
import { fetchReaderUrl, fetchStory, unlockStory } from '../api/showcaseApi';
import { PasswordGate } from '../components/PasswordGate';
import { useShowcaseTheme } from '../theme/ShowcaseThemeProvider';
import {
  loadReaderSaves,
  readerPaletteOf,
  readerStorageKey,
  readReaderMessage,
  sanitizeReaderSaves,
  storeReaderSaves,
} from '../reader/readerBridge';

/**
 * A story read online: the reader page a publisher shipped with a version, in a frame of its own.
 *
 * The frame is sandboxed (scripts only: no storage, no cookies, no way to reach this page), and the
 * server serves the page under a policy that says the same. What the reader needs from here is the
 * one thing the sandbox denies it - somewhere to keep saves - so it asks by `postMessage` and this
 * page answers only the frame it embeds, keeping only what it can read back into a known shape.
 */
export function ReaderPage() {
  const { storyId = '', publicationId = '' } = useParams();
  const { t } = useTranslation('showcase');
  const frame = useRef<HTMLIFrameElement>(null);
  const { resolved } = useShowcaseTheme();

  // The reader wears the site's colors: sent when it asks for its saves (it is ready then) and
  // again whenever the site's theme changes. The frame's origin is opaque, hence `*`.
  const sendPalette = useCallback(() => {
    frame.current?.contentWindow?.postMessage(
      { keresReader: 1, type: 'host', palette: readerPaletteOf(), scheme: resolved },
      '*',
    );
  }, [resolved]);
  useEffect(() => {
    // After the theme provider has applied the new theme to the document.
    const timer = window.setTimeout(sendPalette, 0);
    return () => window.clearTimeout(timer);
  }, [resolved, sendPalette]);

  const [detail, setDetail] = useState<ShowcaseStoryDetail | null>(null);
  const [locked, setLocked] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(
    async (story: ShowcaseStoryDetail) => {
      const version = story.versions.find((entry) => entry.id === publicationId);
      if (!version?.reader) {
        setError(t('reader.unavailable'));
        return;
      }
      try {
        setSource(await fetchReaderUrl(storyId, publicationId));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : t('reader.failed'));
      }
    },
    [publicationId, storyId, t],
  );

  const load = useCallback(async () => {
    try {
      const result = await fetchStory(storyId);
      if ('protected' in result) {
        setLocked(true);
        return;
      }
      setLocked(false);
      setDetail(result);
      await open(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('reader.failed'));
    }
  }, [open, storyId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const key = readerStorageKey(storyId, publicationId);
    const onMessage = (event: MessageEvent) => {
      // Only the frame this page embeds: any other window posting here is not the reader.
      if (!frame.current || event.source !== frame.current.contentWindow) return;
      const message = readReaderMessage(event.data);
      if (!message) return;
      if (message.type === 'load') {
        // The frame's origin is opaque ("null"), so there is no origin to name: `*` it is, and the
        // saves are the reader's own in any case.
        frame.current.contentWindow?.postMessage(
          { keresReader: 1, type: 'saves', saves: loadReaderSaves(window.localStorage, key) },
          '*',
        );
        sendPalette();
        return;
      }
      const saves = sanitizeReaderSaves(message.saves);
      if (saves) storeReaderSaves(window.localStorage, key, saves);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [storyId, publicationId, sendPalette]);

  if (locked) {
    return (
      <PasswordGate
        onSubmit={async (password) => {
          const opened = await unlockStory(storyId, password);
          setDetail(opened);
          setLocked(false);
          await open(opened);
        }}
      />
    );
  }

  const title = detail?.snapshot.title ?? '';
  const label = detail?.versions.find((entry) => entry.id === publicationId)?.label;

  return (
    <section className="reader-page">
      <div className="reader-head">
        <Link to={`/story/${storyId}`} className="back-link">
          {t('reader.back')}
        </Link>
        {title && (
          <span className="reader-title">
            {title}
            {label && <span className="muted"> · {label}</span>}
          </span>
        )}
      </div>
      {error && <p className="error-text">{error}</p>}
      {!error && !source && <p className="muted">{t('reader.loading')}</p>}
      {source && (
        <iframe
          ref={frame}
          className="reader-frame"
          title={title ? t('reader.frameTitle', { title }) : t('reader.frameTitleBare')}
          src={source}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
        />
      )}
    </section>
  );
}
