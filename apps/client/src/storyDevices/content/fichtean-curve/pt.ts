import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'fichtean-curve',
  title: 'Curva fichteana',
  summary: 'Quase nenhuma apresentação: uma escada de crises subindo direto ao clímax.',
  keywords: [
    'curva fichteana',
    'crise',
    'acao crescente',
    'fichtean curve',
    'thriller',
    'escalada',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Uma forma feita quase só de ação crescente. A obra abre perto do problema e empilha uma série de crises, cada uma aumentando o risco e revelando passado de passagem, até a crise final virar o clímax. A exposição é entregue dentro do conflito, não antes dele.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'Thrillers, terror, e qualquer obra em que uma abertura lenta perde o público.',
        'Publicação seriada, em que toda parte precisa terminar sob pressão.',
        'O passado é rico mas mata a história quando contado logo de cara.',
        'Você quer que a tensão seja o estado padrão, não uma visita.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Uma farmacêutica de plantão é assaltada na primeira página. Quem ela foi, e por que não chama a polícia, chega em fragmentos ao longo das cinco crises seguintes.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Escalar volume em vez de risco, e a quinta crise parecer a primeira, mais alta.',
        'Nunca deixar o público respirar, o que achata o clímax.',
        'Sonegar tanto contexto que as crises deixam de significar alguma coisa.',
      ],
    },
    { type: 'seeAlso', pages: ['in-media-res', 'pacing', 'ticking-clock', 'cliffhanger'] },
  ],
};
export default page;
