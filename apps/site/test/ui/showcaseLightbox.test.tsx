import { StrictMode } from 'react';
import { describe, expect, it } from 'vitest';
import { Showcase } from '../../src/components/Showcase';
import { SiteThemeProvider } from '../../src/theme/SiteThemeProvider';
import siteEn from '../../src/i18n/locales/site.en.json';
import { click, render } from '../helpers/react';

/**
 * A foto ampliada abre sobre a página. Antes ela era um link comum, e clicar levava o leitor
 * para uma aba com o PNG cru - saindo da landing para ver uma imagem dela.
 */
describe('foto ampliada da vitrine', () => {
  /**
   * Dentro de `StrictMode`, como a página de verdade (ver `main.tsx`): é o que faz o efeito
   * montar, limpar e montar de novo - o ciclo em que a foto chegou a se fechar sozinha no
   * primeiro clique.
   */
  const renderShowcase = () =>
    render(
      <StrictMode>
        <SiteThemeProvider>
          <Showcase />
        </SiteThemeProvider>
      </StrictMode>,
    );

  it('abre a foto no lugar de navegar para o arquivo', async () => {
    const { container, unmount } = await renderShowcase();
    expect(container.querySelector('dialog')).toBeNull();

    await click(container.querySelector('.showcase-window')!);

    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    expect(dialog).not.toBeNull();
    expect(dialog.open).toBe(true);
    expect(dialog.querySelector('img')?.getAttribute('src')).toContain(
      'showcase/screens/narrative-elements',
    );
    expect(dialog.textContent).toContain(siteEn.showcase.items['narrative-elements'].title);

    await unmount();
  });

  it('amplia a imagem ao clicar nela, e volta ao clicar de novo', async () => {
    const { container, unmount } = await renderShowcase();
    await click(container.querySelector('.showcase-window')!);
    const viewport = container.querySelector('.lightbox-viewport') as HTMLElement;
    expect(viewport.className).not.toContain('is-zoomed');

    await click(viewport.querySelector('img')!);
    expect(viewport.className).toContain('is-zoomed');

    await click(viewport.querySelector('img')!);
    expect(viewport.className).not.toContain('is-zoomed');

    await unmount();
  });

  it('fecha pelo botão', async () => {
    const { container, unmount } = await renderShowcase();
    await click(container.querySelector('.showcase-window')!);

    await click(container.querySelector('.lightbox-bar button')!);

    expect(container.querySelector('dialog')).toBeNull();

    await unmount();
  });

  /** Ctrl+clique continua sendo "abrir em outra aba": o link de verdade segue lá. */
  it('mantém o endereço do arquivo no link', async () => {
    const { container, unmount } = await renderShowcase();

    const link = container.querySelector('.showcase-window') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toContain('showcase/screens/narrative-elements');
    expect(link.getAttribute('target')).toBe('_blank');

    await unmount();
  });
});
