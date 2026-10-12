import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchLegalDocument, type LegalDocument } from '../api/landing';

type LegalState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; terms: LegalDocument | null; privacy: LegalDocument | null };

type LegalTab = 'terms' | 'privacy';

/**
 * The hashes this section answers to. `#privacy` is the address the Play Console listing
 * points at, so it must keep opening the privacy policy; `#legal` is the navigation entry and
 * opens the terms, the first tab.
 */
function tabForHash(hash: string): LegalTab | null {
  switch (hash) {
    case '#privacy':
      return 'privacy';
    case '#terms':
    case '#legal':
      return 'terms';
    default:
      return null;
  }
}

function LegalText({ document }: { document: LegalDocument }) {
  return (
    <div className="legal-text">
      {document.sections.map((section) => (
        <section key={section.heading} className="legal-section">
          <h3>{section.heading}</h3>
          {section.paragraphs.map((paragraph, index) => (
            <p key={`${section.heading}-${index}`}>{paragraph}</p>
          ))}
        </section>
      ))}
    </div>
  );
}

/**
 * The public legal page of the server serving the landing: its terms and its
 * privacy policy side by side in tabs, straight from `keres-tos`/`keres-privacy`.
 * This is the link the Play Console listing and the registration screen point at.
 * Questions - including reports about content - go through the contact section.
 */
export function LegalSection() {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const sectionRef = useRef<HTMLElement>(null);
  const [state, setState] = useState<LegalState>({ status: 'loading' });
  const [tab, setTab] = useState<LegalTab>(() => tabForHash(window.location.hash) ?? 'terms');
  const [attempt, setAttempt] = useState(0);

  // Refetched for each language: the server's payload carries both languages, but the client
  // picks one at fetch time, so a language switch needs the page to ask again.
  useEffect(() => {
    let current = true;
    setState({ status: 'loading' });
    Promise.all([
      fetchLegalDocument('/api/keres-tos', language),
      fetchLegalDocument('/api/keres-privacy', language),
    ])
      .then(([terms, privacy]) => {
        if (current) setState({ status: 'ready', terms, privacy });
      })
      .catch(() => {
        if (current) setState({ status: 'error' });
      });
    return () => {
      // A slower response for the previous language must not overwrite the current one.
      current = false;
    };
  }, [language, attempt]);

  // The hash picks the tab, so the footer links and shared URLs land on the right document.
  // A hash this section does not own (for example `#contact`) leaves the tab alone.
  useEffect(() => {
    const openFromHash = () => {
      const target = tabForHash(window.location.hash);
      if (target === null) return;
      setTab(target);
      sectionRef.current?.scrollIntoView({ block: 'start' });
    };
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    return () => window.removeEventListener('hashchange', openFromHash);
  }, []);

  const selectTab = (next: LegalTab) => {
    setTab(next);
    // replaceState does not fire `hashchange` and does not scroll, so the tab click keeps the
    // reader where they are while the address still names the document on screen.
    window.history.replaceState(
      window.history.state,
      '',
      next === 'privacy' ? '#privacy' : '#terms',
    );
  };

  const active: LegalDocument | null =
    state.status === 'ready' ? (tab === 'terms' ? state.terms : state.privacy) : null;

  return (
    <section ref={sectionRef} className="band" id="legal">
      <div className="section-inner">
        <header className="section-head">
          <h2>{t('legal.title')}</h2>
          <p>{t('legal.lead')}</p>
        </header>
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
        {state.status === 'ready' && (
          <>
            <div className="legal-tabs" role="tablist" aria-label={t('legal.title')}>
              {(['terms', 'privacy'] as const).map((candidate) => (
                <button
                  key={candidate}
                  type="button"
                  role="tab"
                  aria-selected={tab === candidate}
                  className={tab === candidate ? 'button button-primary' : 'button button-ghost'}
                  onClick={() => selectTab(candidate)}
                >
                  {t(`legal.tabs.${candidate}`)}
                </button>
              ))}
            </div>
            {active === null ? (
              <p className="muted">{t('legal.unavailable')}</p>
            ) : (
              <>
                <p className="muted">
                  {t('legal.version', { version: active.version, date: active.updatedAt })}
                </p>
                <LegalText document={active} />
              </>
            )}
            <p className="tiers-contact">
              <a className="button button-primary" href="#contact">
                {t('legal.contactCta')}
              </a>
            </p>
          </>
        )}
      </div>
    </section>
  );
}
