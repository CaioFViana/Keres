import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import keresLogoUrl from 'virtual:keres-logo';
import { fetchLegalDocument, type LegalDocument } from '../api/landing';
import { ThreadPage } from '../components/thread/ThreadPage';
import { LEGAL_PAGES, legalPath, type LegalPage as Kind } from '../content/legalPages';

type LegalState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; document: LegalDocument | null };

const SOURCES: Record<Kind, '/api/keres-tos' | '/api/keres-privacy'> = {
  terms: '/api/keres-tos',
  privacy: '/api/keres-privacy',
};

/**
 * One of the legal documents of the server serving the landing - its terms or its privacy policy - on a page of its
 * own, straight from `keres-tos`/`keres-privacy`. It is the address the Play Console listing and the registration
 * screen point at. Every section of the document is a knot of the thread, so the rail is its table of contents.
 * Questions - including reports about content - go through the landing's contact section.
 */
export function LegalPage({ kind }: { kind: Kind }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const [state, setState] = useState<LegalState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  // Asked again for each language and each document: the payload carries both languages, but the client picks one at
  // fetch time, and a slower answer for the previous one must not overwrite the current.
  useEffect(() => {
    let current = true;
    setState({ status: 'loading' });
    fetchLegalDocument(SOURCES[kind], language)
      .then((document) => {
        if (current) setState({ status: 'ready', document });
      })
      .catch(() => {
        if (current) setState({ status: 'error' });
      });
    return () => {
      current = false;
    };
  }, [kind, language, attempt]);

  const other = LEGAL_PAGES.find((page) => page !== kind) ?? kind;
  const document = state.status === 'ready' ? state.document : null;

  return (
    <ThreadPage>
      <div className="thread-origin" data-thread-origin data-ox="0.569" data-oy="0.98">
        <img src={keresLogoUrl} alt="" aria-hidden="true" />
      </div>

      <section className="hero thread-col" id="legal">
        <div className="hero-inner">
          <p className="hero-eyebrow">{t('legal.title')}</p>
          <h1 className="hero-title" data-thread-knot>
            {t(`legal.tabs.${kind}`)}
          </h1>
          <p className="hero-text">{t('legal.lead')}</p>
          {document && (
            <p className="muted legal-version">
              {t('legal.version', { version: document.version, date: document.updatedAt })}
            </p>
          )}
          <div className="hero-actions">
            <a className="button button-ghost" href="/">
              {t('legal.home')}
            </a>
            <a className="button button-ghost" href={legalPath(other)}>
              {t(`legal.tabs.${other}`)}
            </a>
          </div>
        </div>
      </section>

      <div className="legal-body thread-col">
        {state.status === 'loading' && <p className="muted">{t('legal.loading')}</p>}
        {state.status === 'error' && (
          <p>
            {t('legal.loadFailed')}{' '}
            <button
              type="button"
              className="button button-ghost"
              onClick={() => setAttempt((count) => count + 1)}
            >
              {t('legal.retry')}
            </button>
          </p>
        )}
        {state.status === 'ready' && document === null && (
          <p className="muted">{t('legal.unavailable')}</p>
        )}
        {document?.sections.map((section) => (
          <section key={section.heading} className="legal-section">
            <h2 data-thread-knot>{section.heading}</h2>
            {section.paragraphs.map((paragraph, index) => (
              <p key={`${section.heading}-${index}`}>{paragraph}</p>
            ))}
          </section>
        ))}
      </div>

      <section className="band end" id="end">
        <div className="section-inner">
          <h2 data-thread-end>{t('legal.contactTitle')}</h2>
          <div className="hero-actions">
            <a className="button button-primary" href="/#contact">
              {t('legal.contactCta')}
            </a>
          </div>
        </div>
      </section>
    </ThreadPage>
  );
}
