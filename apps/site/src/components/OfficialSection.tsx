import { useTranslation } from 'react-i18next';
import { KERES_OFFICIAL_CLIENT_URL, KERES_OFFICIAL_URL } from '../content/links';

export function OfficialSection() {
  const { t } = useTranslation();

  return (
    <section className="band" id="official">
      <div className="section-inner">
        <header className="section-head">
          <h2>{t('official.title')}</h2>
          <p>{t('official.lead')}</p>
        </header>
        <div className="hero-actions">
          <a
            className="button button-primary"
            href={KERES_OFFICIAL_URL}
            rel="noreferrer"
            target="_blank"
          >
            {t('official.visit')}
          </a>
          <a
            className="button button-ghost"
            href={KERES_OFFICIAL_CLIENT_URL}
            rel="noreferrer"
            target="_blank"
          >
            {t('official.openClient')}
          </a>
        </div>
      </div>
    </section>
  );
}
