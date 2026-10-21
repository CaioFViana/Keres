import { useTranslation } from 'react-i18next';
import { ContactSection } from '../components/ContactSection';
import { LegalSection } from '../components/LegalSection';
import { OfficialSection } from '../components/OfficialSection';
import { Showcase } from '../components/Showcase';
import { useShowcaseAvailable } from '../components/ShowcaseAvailability';
import { ThreadFork, ThreadPage } from '../components/thread/ThreadPage';
import { TiersSection } from '../components/TiersSection';
import { DOWNLOADS, FAQ_ITEMS, FEATURE_GROUPS, PILLARS, PLATFORMS } from '../content/catalog';
import {
  DOCKER_IMAGE,
  GITHUB_RELEASES_URL,
  GITHUB_REPO_URL,
  HOSTED_CLIENT_URL,
  HOSTED_SHOWCASE_URL,
  WEB_CLIENT_URL,
} from '../content/links';
import { isLandingBuild, siteText } from '../variant';
import keresLogoUrl from 'virtual:keres-logo';

const DOWNLOAD_HREFS: Record<(typeof DOWNLOADS)[number], string> = {
  releases: GITHUB_RELEASES_URL,
  server: GITHUB_RELEASES_URL,
  docker: GITHUB_REPO_URL,
  source: GITHUB_REPO_URL,
};

/**
 * The landing page, as one thread: it leaves the hair of the Keres mark, passes through every heading and splits
 * wherever the page offers choices - how to start, the three pillars, the four fronts of the product, the platforms
 * and the ways to download - and it is cut at the end. See `components/thread`.
 */
export function HomePage() {
  const { t } = useTranslation();
  const showcaseAvailable = useShowcaseAvailable();
  const clientUrl = isLandingBuild ? HOSTED_CLIENT_URL : WEB_CLIENT_URL;
  const choices = showcaseAvailable ? 3 : 2;

  return (
    <ThreadPage>
      {/* Plain links, not the router: the client and the showcase are their own apps, served from sibling folders. */}
      <div className="thread-origin" data-thread-origin data-ox="0.569" data-oy="0.98">
        <img src={keresLogoUrl} alt="" aria-hidden="true" />
      </div>

      <section className="hero thread-col" id="top">
        <div className="hero-inner">
          <p className="hero-eyebrow">{t('hero.eyebrow')}</p>
          <h1 className="hero-title">{t('hero.title')}</h1>
          <p className="hero-text">{t('hero.lead')}</p>
          <div className="hero-actions">
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
          <p className="hero-choice">{t('hero.choice')}</p>
        </div>
      </section>

      <ThreadFork count={choices}>
        <a className="card choice" href={clientUrl} data-testid="try-web-client" data-thread-branch>
          <span className="card-number" aria-hidden="true">
            01
          </span>
          <h3 data-thread-title>{isLandingBuild ? t('hero.landingCtaTry') : t('hero.ctaTry')}</h3>
          <p>{isLandingBuild ? siteText(t, 'hero.landingTryNote') : t('hero.tryNote')}</p>
        </a>
        {showcaseAvailable && (
          <a
            className="card choice"
            href={HOSTED_SHOWCASE_URL}
            data-testid="browse-showcase"
            data-thread-branch
          >
            <span className="card-number" aria-hidden="true">
              02
            </span>
            <h3 data-thread-title>{t('hero.ctaShowcase')}</h3>
            <p>{t('hero.showcaseNote')}</p>
          </a>
        )}
        <a className="card choice" href="#download" data-thread-branch>
          <span className="card-number" aria-hidden="true">
            {showcaseAvailable ? '03' : '02'}
          </span>
          <h3 data-thread-title>{t('hero.ctaDownload')}</h3>
          <p>{t('hero.downloadNote')}</p>
        </a>
      </ThreadFork>

      {isLandingBuild && <OfficialSection />}

      <section className="band" id="product">
        <div className="section-inner">
          <header className="section-head">
            <h2 data-thread-knot>{t('product.title')}</h2>
            <p>{t('product.lead')}</p>
          </header>
        </div>
      </section>

      <ThreadFork count={PILLARS.length} className="pillar-grid">
        {PILLARS.map((pillar) => (
          <article key={pillar} className="card" data-thread-branch>
            <h3 data-thread-title>{t(`pillars.${pillar}.title`)}</h3>
            <p>{t(`pillars.${pillar}.body`)}</p>
          </article>
        ))}
      </ThreadFork>

      <Showcase />

      <section className="band" id="universe">
        <div className="section-inner">
          <header className="section-head">
            <h2 data-thread-knot>{t('features.title')}</h2>
            <p>{t('features.lead')}</p>
          </header>
        </div>
      </section>

      <ThreadFork count={FEATURE_GROUPS.length} wide className="group-grid">
        {FEATURE_GROUPS.map((group, index) => (
          <article
            key={group.id}
            className="card group-card"
            id={group.id === 'universe' ? undefined : group.id}
            data-thread-branch
          >
            <span className="card-number" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <h3 data-thread-title>{t(`features.${group.id}.title`)}</h3>
            <p>{t(`features.${group.id}.lead`)}</p>
            {/* Each item is a bead on a short thread of its own; its text opens under it. */}
            <ul className="beads">
              {group.items.map((item) => (
                <li key={item}>
                  <details>
                    <summary>{t(`features.${group.id}.items.${item}.title`)}</summary>
                    <p>{t(`features.${group.id}.items.${item}.body`)}</p>
                  </details>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </ThreadFork>

      <section className="band" id="platforms">
        <div className="section-inner">
          <header className="section-head">
            <h2 data-thread-knot>{t('platforms.title')}</h2>
            <p>{t('platforms.lead')}</p>
          </header>
        </div>
      </section>

      <ThreadFork count={PLATFORMS.length} wide>
        {PLATFORMS.map((platform) => (
          <article key={platform} className="card" data-thread-branch>
            <h3 data-thread-title>{t(`platforms.items.${platform}.title`)}</h3>
            <p>{t(`platforms.items.${platform}.body`)}</p>
          </article>
        ))}
      </ThreadFork>

      {isLandingBuild && <TiersSection />}

      <section className="band" id="download">
        <div className="section-inner">
          <header className="section-head">
            <h2 data-thread-knot>{t('download.title')}</h2>
            <p>{t('download.lead')}</p>
          </header>
        </div>
      </section>

      <ThreadFork count={DOWNLOADS.length} wide className="download-grid">
        {DOWNLOADS.map((item) => (
          <article key={item} className="card download-card" data-thread-branch>
            <h3 data-thread-title>{t(`download.items.${item}.title`)}</h3>
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
      </ThreadFork>
      <div className="section-inner">
        <p className="muted docker-hint">
          <code>{`docker pull ${DOCKER_IMAGE}:latest`}</code>
        </p>
      </div>

      {/* Developer internals: only the GitHub Pages project site names the monorepo pieces. */}
      {!isLandingBuild && (
        <section className="band" id="stack">
          <div className="section-inner">
            <header className="section-head">
              <h2 data-thread-knot>{t('stack.title')}</h2>
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
                <strong>apps/web.</strong> {t('stack.admin')}
              </li>
              <li>
                <strong>packages/shared.</strong> {t('stack.shared')}
              </li>
            </ul>
          </div>
        </section>
      )}

      <section className="band" id="faq">
        <div className="section-inner">
          <header className="section-head">
            <h2 data-thread-knot>{t('faq.title')}</h2>
          </header>
          <div className="faq-list">
            {FAQ_ITEMS.map((item) => (
              <details key={item} className="faq-item">
                <summary>{t(`faq.items.${item}.q`)}</summary>
                {/* The landing page is served by a Keres Server, so its showcase answer
                    points at this server's own /showcase instead of someone else's. */}
                <p>
                  {item === 'showcase' && isLandingBuild
                    ? siteText(t, 'faq.items.showcase.aLanding')
                    : t(`faq.items.${item}.a`)}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {isLandingBuild && <ContactSection />}
      {isLandingBuild && <LegalSection />}

      <section className="band end" id="end">
        <div className="section-inner">
          <h2 data-thread-end>{t('end.title')}</h2>
          <p className="end-lead">{t('end.lead')}</p>
          <div className="hero-actions">
            <a className="button button-primary" href={clientUrl}>
              {isLandingBuild ? t('hero.landingCtaTry') : t('hero.ctaTry')}
            </a>
            {showcaseAvailable && (
              <a className="button button-ghost" href={HOSTED_SHOWCASE_URL}>
                {t('hero.ctaShowcase')}
              </a>
            )}
            <a className="button button-ghost" href="#download">
              {t('hero.ctaDownload')}
            </a>
          </div>
        </div>
      </section>
    </ThreadPage>
  );
}
