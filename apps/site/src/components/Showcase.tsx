import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SHOWCASE_SCREENS, type ShowcaseScreenId } from '../content/catalog';
import { useSiteTheme } from '../theme/SiteThemeProvider';
import { ScreenshotLightbox } from './ScreenshotLightbox';

/**
 * The app, photographed.
 *
 * The images come from `apps/desktop/scripts/capture-screens.ts`: the real app opened inside
 * Electron, with an example story installed, in the requested language and theme. There is no
 * HTML replica here - the earlier attempt rebuilt the screens with `react-native-web` and never
 * looked like what the user sees.
 *
 * The page's language and theme pick the file, so the section follows whoever is reading.
 */
export function Showcase() {
  const { t, i18n } = useTranslation();
  const { resolved } = useSiteTheme();
  const language = i18n.language.startsWith('pt') ? 'pt' : 'en';
  const [opened, setOpened] = useState<ShowcaseScreenId | null>(null);
  const openedScreen = SHOWCASE_SCREENS.find((screen) => screen.id === opened);

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
                {/* Continua sendo um link para o arquivo: quem abre em nova aba, copia o
                  endereço ou navega pelo teclado espera isso. O clique comum, esse, abre a
                  foto ampliada sem tirar ninguém da página. */}
                <a
                  className="showcase-window"
                  href={source}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) {
                      return;
                    }
                    event.preventDefault();
                    setOpened(screen.id);
                  }}
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

        {openedScreen && (
          <ScreenshotLightbox
            source={`${import.meta.env.BASE_URL}showcase/screens/${openedScreen.id}.${language}.${resolved}.png`}
            title={t(`showcase.items.${openedScreen.id}.title`)}
            width={openedScreen.width}
            height={openedScreen.height}
            onClose={() => setOpened(null)}
          />
        )}
      </div>
    </section>
  );
}
