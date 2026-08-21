import { useTranslation } from 'react-i18next';
import { DOWNLOADS, FAQ_ITEMS, FEATURE_GROUPS, PILLARS, PLATFORMS } from '../content/catalog';
import { DOCKER_IMAGE, GITHUB_RELEASES_URL, GITHUB_REPO_URL } from '../content/links';
import keresLogoUrl from 'virtual:keres-logo';

const DOWNLOAD_HREFS: Record<(typeof DOWNLOADS)[number], string> = {
  releases: GITHUB_RELEASES_URL,
  server: GITHUB_RELEASES_URL,
  docker: GITHUB_REPO_URL,
  source: GITHUB_REPO_URL,
};

export function HomePage() {
  const { t } = useTranslation();

  return (
    <>
      <section className="hero" id="top">
        <div className="hero-inner">
          <img
            src={keresLogoUrl}
            width={88}
            height={88}
            alt=""
            className="hero-mark"
            aria-hidden="true"
          />
          <p className="hero-eyebrow">{t('hero.eyebrow')}</p>
          <h1 className="hero-title">{t('hero.title')}</h1>
          <p className="hero-text">{t('hero.lead')}</p>
          <div className="hero-actions">
            <a className="button button-primary" href="#download">
              {t('hero.ctaDownload')}
            </a>
            <a
              className="button button-ghost"
              href={GITHUB_REPO_URL}
              rel="noreferrer"
              target="_blank"
            >
              {t('hero.ctaGithub')}
            </a>
            <a className="button button-ghost" href="#universe">
              {t('hero.ctaFeatures')}
            </a>
          </div>
        </div>
      </section>

      <section className="band" id="product">
        <div className="section-inner">
          <header className="section-head">
            <h2>{t('product.title')}</h2>
            <p>{t('product.lead')}</p>
          </header>
          <div className="pillar-grid">
            {PILLARS.map((pillar) => (
              <article key={pillar} className="card">
                <h3>{t(`pillars.${pillar}.title`)}</h3>
                <p>{t(`pillars.${pillar}.body`)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {FEATURE_GROUPS.map((group) => (
        <section
          key={group.id}
          className="band"
          id={group.id === 'universe' ? 'universe' : group.id}
        >
          <div className="section-inner">
            <header className="section-head">
              <h2>{t(`features.${group.id}.title`)}</h2>
              <p>{t(`features.${group.id}.lead`)}</p>
            </header>
            <div className="feature-grid">
              {group.items.map((item) => (
                <article key={item} className="feature-card">
                  <h3>{t(`features.${group.id}.items.${item}.title`)}</h3>
                  <p>{t(`features.${group.id}.items.${item}.body`)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      ))}

      <section className="band" id="platforms">
        <div className="section-inner">
          <header className="section-head">
            <h2>{t('platforms.title')}</h2>
            <p>{t('platforms.lead')}</p>
          </header>
          <div className="feature-grid">
            {PLATFORMS.map((platform) => (
              <article key={platform} className="feature-card">
                <h3>{t(`platforms.items.${platform}.title`)}</h3>
                <p>{t(`platforms.items.${platform}.body`)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="band" id="download">
        <div className="section-inner">
          <header className="section-head">
            <h2>{t('download.title')}</h2>
            <p>{t('download.lead')}</p>
          </header>
          <div className="download-grid">
            {DOWNLOADS.map((item) => (
              <article key={item} className="card download-card">
                <h3>{t(`download.items.${item}.title`)}</h3>
                <p>{t(`download.items.${item}.body`)}</p>
                <a
                  className="button button-primary"
                  href={DOWNLOAD_HREFS[item]}
                  rel="noreferrer"
                  target="_blank"
                >
                  {t(`download.items.${item}.cta`)}
                </a>
              </article>
            ))}
          </div>
          <p className="muted docker-hint">
            <code>{`docker pull ${DOCKER_IMAGE}:latest`}</code>
          </p>
        </div>
      </section>

      <section className="band" id="stack">
        <div className="section-inner">
          <header className="section-head">
            <h2>{t('stack.title')}</h2>
            <p>{t('stack.lead')}</p>
          </header>
          <ul className="stack-list">
            <li>
              <strong>apps/client.</strong> {t('stack.client')}
            </li>
            <li>
              <strong>apps/desktop.</strong> {t('stack.desktop')}
            </li>
            <li>
              <strong>apps/api.</strong> {t('stack.api')}
            </li>
            <li>
              <strong>apps/admin.</strong> {t('stack.admin')}
            </li>
            <li>
              <strong>packages/shared.</strong> {t('stack.shared')}
            </li>
          </ul>
        </div>
      </section>

      <section className="band" id="faq">
        <div className="section-inner">
          <header className="section-head">
            <h2>{t('faq.title')}</h2>
          </header>
          <div className="faq-list">
            {FAQ_ITEMS.map((item) => (
              <details key={item} className="faq-item">
                <summary>{t(`faq.items.${item}.q`)}</summary>
                <p>{t(`faq.items.${item}.a`)}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
