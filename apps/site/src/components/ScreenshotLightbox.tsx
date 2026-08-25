import { type MouseEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ScreenshotLightboxProps {
  source: string;
  title: string;
  width: number;
  height: number;
  onClose: () => void;
}

/**
 * A foto ampliada, sobre a página.
 *
 * `<dialog>` nativo, e não um `div` com `position: fixed`: Esc fecha, o resto da página fica
 * inerte e o foco não escapa para trás do fundo - tudo isso de graça e sem biblioteca.
 *
 * O zoom é um alternador, não um controle contínuo: as fotos têm 1440px e a página as encolhe
 * para caber, então os dois estados que interessam são "a tela inteira" e "tamanho real, onde
 * o texto das cenas volta a ser legível". Ampliada, a imagem rola dentro da moldura, e o ponto
 * clicado é o que fica no meio.
 */
export function ScreenshotLightbox({
  source,
  title,
  width,
  height,
  onClose,
}: ScreenshotLightboxProps) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    // Sem limpeza que feche o diálogo: `close()` dispara o evento `close` nativo, que é o mesmo
    // caminho do Esc e chamaria `onClose`. Em `StrictMode` o efeito monta, limpa e monta de
    // novo - e a foto se fechava sozinha no primeiro clique. Desmontar já tira o elemento do
    // DOM, que é o que fecha a camada de topo. A guarda cobre a segunda montagem: `showModal`
    // num diálogo já aberto lança.
    if (element && !element.open) element.showModal?.();
  }, []);

  /** Onde o leitor clicou, em fração da imagem: é o ponto que fica no meio depois de ampliar. */
  const focus = useRef({ horizontal: 0.5, vertical: 0.5 });

  const toggleZoom = (event: MouseEvent<HTMLImageElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    focus.current = {
      horizontal: (event.clientX - rect.left) / rect.width,
      vertical: (event.clientY - rect.top) / rect.height,
    };
    setZoomed((previous) => !previous);
  };

  // `useLayoutEffect`, e não `requestAnimationFrame`: o efeito de layout roda depois do DOM já
  // ter a imagem em tamanho real, e roda mesmo com a aba escondida - onde o rAF não dispara e
  // a rolagem ficaria no canto.
  useLayoutEffect(() => {
    const area = viewport.current;
    if (!zoomed || !area) return;
    area.scrollLeft = focus.current.horizontal * area.scrollWidth - area.clientWidth / 2;
    area.scrollTop = focus.current.vertical * area.scrollHeight - area.clientHeight / 2;
  }, [zoomed]);

  return (
    <dialog
      ref={dialog}
      className="lightbox"
      aria-label={title}
      onClose={onClose}
      // Clique no fundo fecha: com o `<dialog>` esticado, o alvo só é o próprio elemento
      // quando o clique cai fora do conteúdo.
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
    >
      <div className="lightbox-bar">
        <h3>{title}</h3>
        <button type="button" onClick={onClose} aria-label={t('showcase.lightbox.close')}>
          ✕
        </button>
      </div>
      <div className={`lightbox-viewport${zoomed ? ' is-zoomed' : ''}`} ref={viewport}>
        <img src={source} alt={title} width={width} height={height} onClick={toggleZoom} />
      </div>
      <p className="lightbox-hint">
        {t(zoomed ? 'showcase.lightbox.shrink' : 'showcase.lightbox.zoom')}
      </p>
    </dialog>
  );
}
