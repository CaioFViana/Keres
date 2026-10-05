import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'sketch',
  title: 'Esboços',
  summary:
    'Desenhos rápidos sobre uma página: traços, formas, carimbos, balões de fala e textos curtos. Uma base para continuar em outro lugar, não um programa de pintura.',
  keywords: [
    'esboço',
    'esboco',
    'desenho',
    'desenhar',
    'caneta',
    'traço',
    'traco',
    'forma',
    'carimbo',
    'balão',
    'balao',
    'fala',
    'texto',
    'camada',
    'página',
    'pagina',
    'papel',
    'desfazer',
    'exportar',
    'svg',
    'png',
    'galeria',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Um esboço é um desenho nomeado sobre uma página de papel. Escolha caneta, linha, polígono, retângulo, texto ou carimbo, desenhe, e a ferramenta se guarda sozinha. Os balões de fala ficam atrás do botão de formas: arraste a área e puxe a ponta da cauda até o personagem. Traços novos caem na camada ativa.',
    },
    { type: 'heading', level: 2, text: 'Página e visão' },
    {
      type: 'paragraph',
      text: 'O botão de página define o tamanho do papel (A4, A5, quadrado, largo, webtoon ou personalizado) e a orientação. A página limita a exportação; desenhar fora dela continua permitido. Girar com dois dedos gira a visão em torno do centro da tela - o desenho nunca gira, e o botão de endireitar volta a visão ao normal.',
    },
    { type: 'heading', level: 2, text: 'Camadas' },
    {
      type: 'paragraph',
      text: 'Camadas empilham grupos nomeados de traços com visibilidade e opacidade próprias. Camadas ocultas saem da tela, da seleção e da exportação. Apagar uma camada apaga os traços dela.',
    },
    { type: 'heading', level: 2, text: 'Salvar e exportar' },
    {
      type: 'paragraph',
      text: 'O visto salva todas as mudanças; a seta reverte até o último save. Desfazer e refazer percorrem o histórico da sessão, e Ctrl+Z / Ctrl+Shift+Z (ou Ctrl+Y) funcionam no computador. A exportação grava um .svg (o desenho vetorial) ou um .png (a página em imagem). Salvar na galeria guarda um .png como imagem da galeria e o vincula como capa do esboço - fora do canvas, o esboço aparece como essa imagem.',
    },
  ],
};
export default page;
