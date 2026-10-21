import { useTranslation } from 'react-i18next';
import { HOSTED_CLIENT_URL, KERES_OFFICIAL_CLIENT_URL, KERES_OFFICIAL_URL } from '../content/links';
import { isOfficialSite, siteText } from '../variant';

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
          <h2 data-thread-knot>{siteText(t, 'official.title')}</h2>
          <p>{siteText(t, 'official.lead')}</p>
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
            {siteText(t, 'official.openClient')}
          </a>
        </div>
      </div>
    </section>
  );
}
