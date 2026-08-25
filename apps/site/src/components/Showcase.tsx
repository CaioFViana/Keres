import { useTranslation } from 'react-i18next';
import { SHOWCASE_SCREENS } from '../content/catalog';
import { useSiteTheme } from '../theme/SiteThemeProvider';

/**
 * O app, fotografado.
 *
 * As imagens vêm de `apps/desktop/scripts/capture-screens.cjs`: o app de verdade aberto dentro
 * do Electron, com uma história de exemplo instalada, no idioma e no tema pedidos. Não há
 * réplica em HTML nenhuma aqui - a tentativa anterior reconstruía as telas com
 * `react-native-web` e nunca ficava igual ao que o usuário vê.
 *
 * Idioma e tema da página escolhem o arquivo, então a seção acompanha quem está lendo.
 */
export function Showcase() {
  const { t, i18n } = useTranslation();
  const { resolved } = useSiteTheme();
  const language = i18n.language.startsWith('pt') ? 'pt' : 'en';

  return (
    <section className="band" id="showcase">
      <div className="section-inner">
        <header className="section-head">
          <h2>{t('showcase.title')}</h2>
          <p>{t('showcase.lead')}</p>
        </header>

        <div className="showcase-shots">
          {SHOWCASE_SCREENS.map((screen) => {
            const source = `${import.meta.env.BASE_URL}showcase/screens/${screen.id}.${language}.${resolved}.png`;
            return (
              <figure key={screen.id} className="showcase-shot">
                <figcaption>
                  <h3>{t(`showcase.items.${screen.id}.title`)}</h3>
                  <p>{t(`showcase.items.${screen.id}.body`)}</p>
                </figcaption>
                {/* A foto tem 1440px e a página a encolhe para caber; o link abre o arquivo no
                  tamanho real, que é onde o texto das cenas volta a ser legível. */}
                <a
                  className="showcase-window"
                  href={source}
                  target="_blank"
                  rel="noreferrer"
                >
                  <img
                    src={source}
                    alt={t(`showcase.items.${screen.id}.title`)}
                    width={screen.width}
                    height={screen.height}
                    loading="lazy"
                  />
                </a>
              </figure>
            );
          })}
        </div>
        <p className="showcase-note">{t('showcase.note')}</p>
      </div>
    </section>
  );
}
