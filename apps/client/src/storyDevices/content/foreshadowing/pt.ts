import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'foreshadowing',
  title: 'Presságio',
  summary: 'Sinais discretos no início que tornam uma virada inevitável em retrospecto.',
  keywords: [
    'pressagio',
    'presságio',
    'foreshadowing',
    'pista',
    'indicio',
    'agouro',
    'inevitabilidade',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Pistas, imagens ou falas colocadas de modo que o público as registre sem decidir que importam. O objetivo não é que adivinhem, e sim que, depois da virada, consigam refazer o caminho e ver que sempre esteve lá.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'Uma reviravolta soaria arbitrária sem preparo.',
        'Você quer pavor em vez de surpresa, e o público precisa sentir a coisa vindo.',
        'Uma decisão tardia do personagem precisa parecer coerente.',
        'Você está revisando e quer semear uma revelação que inventou depois.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Três capítulos antes da enchente, um personagem secundário reclama que as bombas não passam por manutenção desde a fusão. Ninguém dá sequência.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Pressagiar tão alto que vira aviso prévio.',
        'Confundir com pista falsa: esta aqui precisa ser verdadeira.',
        'Usar o presságio para desculpar uma virada que contraria o que a história estabeleceu.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['chekhovs-gun', 'dramatic-irony', 'red-herring', 'setup-and-payoff'],
    },
  ],
};
export default page;
