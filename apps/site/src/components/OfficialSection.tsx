import { useTranslation } from 'react-i18next';
import { HOSTED_CLIENT_URL, KERES_OFFICIAL_CLIENT_URL, KERES_OFFICIAL_URL } from '../content/links';
import { isOfficialSite, SITE_TEXT_CONTEXT } from '../variant';

/**
 * Elsewhere this presents keres.me as the official server. On keres.me itself it presents the page's own
 * host as the official service: nothing to "visit" (the link would point back here), and the web client
 * is this origin's, not a copy of it.
 */
export function OfficialSection() {
  const { t } = useTranslation();

  return (
    <section className="band" id="official">
      <div className="section-inner">
        <header className="section-head">
          <h2>{t('official.title', { context: SITE_TEXT_CONTEXT })}</h2>
          <p>{t('official.lead', { context: SITE_TEXT_CONTEXT })}</p>
        </header>
        <div className="hero-actions">
          {!isOfficialSite && (
            <a
              className="button button-primary"
              href={KERES_OFFICIAL_URL}
              rel="noreferrer"
              target="_blank"
            >
              {t('official.visit')}
            </a>
          )}
          <a
            className={isOfficialSite ? 'button button-primary' : 'button button-ghost'}
            href={isOfficialSite ? HOSTED_CLIENT_URL : KERES_OFFICIAL_CLIENT_URL}
            {...(isOfficialSite ? {} : { rel: 'noreferrer', target: '_blank' })}
          >
            {t('official.openClient', { context: SITE_TEXT_CONTEXT })}
          </a>
        </div>
      </div>
    </section>
  );
}
