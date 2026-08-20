import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { fetchConfig } from '../api/showcaseApi';

export function AboutPage() {
  const { t } = useTranslation('showcase');
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig()
      .then((config) => setVersion(config.serverVersion))
      .catch(() => setVersion(null));
  }, []);

  return (
    <section className="prose">
      <h1>{t('about.title')}</h1>
      <p>{t('about.intro')}</p>

      <h2>{t('about.downloadTitle')}</h2>
      <p>{t('about.downloadBody')}</p>
      {/*
        `Trans` porque a frase tem um trecho em negrito no meio: o nome da tela do app. Partir a
        string em três pedaços deixaria a ordem das palavras presa ao inglês.
      */}
      <p>
        <Trans ns="showcase" i18nKey="about.importBody" components={{ strong: <strong /> }} />
      </p>

      <h2>{t('about.responsibilityTitle')}</h2>
      <p>{t('about.responsibilityBody')}</p>

      {version && <p className="muted">{t('about.serverVersion', { version })}</p>}
    </section>
  );
}
