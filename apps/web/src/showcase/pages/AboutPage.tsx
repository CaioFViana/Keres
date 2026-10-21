import { Trans, useTranslation } from 'react-i18next';
import { ThreadMark } from '@/showcase/components/ThreadMark';
import { ThreadPage } from '@/showcase/components/thread/ThreadPage';
import { useShowcaseConfig } from '@/showcase/config/ShowcaseConfigProvider';

/** What this site is and how to use what it offers: two parts on the thread, the second where it is cut. */
export function AboutPage() {
  const { t } = useTranslation('showcase');
  const config = useShowcaseConfig();
  const version = config?.serverVersion ?? null;

  return (
    <ThreadPage className="about-page">
      <ThreadMark />

      <section className="hero thread-col">
        <div className="hero-inner">
          <h1 className="hero-title" data-thread-knot>
            {t('about.title')}
          </h1>
          <p className="hero-text">{t('about.intro')}</p>
        </div>
      </section>

      <section className="prose thread-col">
        <h2 data-thread-knot>{t('about.downloadTitle')}</h2>
        <p>{t('about.downloadBody')}</p>
        {/*
          `Trans` because the sentence has a bold span in the middle: the app screen's name. Splitting
          the string into three pieces would pin the word order to English.
        */}
        <p>
          <Trans ns="showcase" i18nKey="about.importBody" components={{ strong: <strong /> }} />
        </p>
        <p>{t('about.manuscriptBody')}</p>
      </section>

      <section className="prose thread-col">
        <h2 data-thread-end>{t('about.responsibilityTitle')}</h2>
        <p>{t('about.responsibilityBody')}</p>
        {version && <p className="muted">{t('about.serverVersion', { version })}</p>}
      </section>
    </ThreadPage>
  );
}
