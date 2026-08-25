import { StrictMode } from 'react';
import { describe, expect, it } from 'vitest';
import { Showcase } from '../../src/components/Showcase';
import { SiteThemeProvider } from '../../src/theme/SiteThemeProvider';
import siteEn from '../../src/i18n/locales/site.en.json';
import { click, render } from '../helpers/react';

/**
 * The enlarged screenshot opens on top of the page. It used to be a plain link, and clicking it
 * took the reader to a tab with the raw PNG - leaving the landing page to look at an image of it.
 */
describe('foto ampliada da vitrine', () => {
  /**
   * Inside `StrictMode`, like the real page (see `main.tsx`): that is what makes the effect mount,
   * clean up and mount again - the cycle in which the screenshot once closed itself on the first click.
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

  /** Ctrl+click still means "open in another tab": the real link is still there. */
  it('mantém o endereço do arquivo no link', async () => {
    const { container, unmount } = await renderShowcase();

    const link = container.querySelector('.showcase-window') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toContain('showcase/screens/narrative-elements');
    expect(link.getAttribute('target')).toBe('_blank');

    await unmount();
  });
});
