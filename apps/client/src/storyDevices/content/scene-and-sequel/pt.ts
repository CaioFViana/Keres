import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'scene-and-sequel',
  title: 'Cena e sequência',
  summary:
    'Unidades de ação alternam com unidades de reação: objetivo, conflito, desastre; depois emoção, dilema, decisão.',
  keywords: [
    'cena e sequencia',
    'scene and sequel',
    'reacao',
    'objetivo conflito desastre',
    'ritmo',
    'estrutura',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Um ritmo para a prosa: a cena é um personagem perseguindo um objetivo, encontrando conflito e terminando pior; a sequência é a unidade mais curta em que ele sente aquilo, pesa opções ruins e escolhe o próximo objetivo. É a sequência que converte acontecimentos num personagem que decide em vez de ser empurrado.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'A obra tem muitos acontecimentos e o protagonista parece passivo.',
        'Leitores dizem que é empolgante, mas que não se importam.',
        'Você precisa de interioridade sem parar a história.',
        'Uma sequência de ação longa precisa de um lugar onde a consequência caia.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Cena: ela tenta pegar os registros e é expulsa. Sequência: meia página de fúria, duas opções ruins, e a decisão de ligar para quem jurou nunca mais ligar.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Pular todas as sequências, o que gera uma perseguição sem ninguém dentro.',
        'Escrever sequências do tamanho das cenas, o que trava a obra.',
        'Terminar uma sequência sem decisão, e a cena seguinte fica sem objetivo.',
      ],
    },
    { type: 'seeAlso', pages: ['in-late-out-early', 'story-circle', 'pacing', 'want-vs-need'] },
  ],
};
export default page;
