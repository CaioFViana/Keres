import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'macguffin',
  title: 'MacGuffin',
  summary: 'A coisa que todos perseguem e cuja natureza pouco importa.',
  keywords: [
    'macguffin',
    'objetivo',
    'objeto de desejo',
    'perseguicao',
    'maleta',
    'motor de trama',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Um objeto, pessoa ou meta que move a trama por ser desejado. A função dele é pôr personagens em movimento e em conflito; o que ele é de fato pode continuar vago, porque o sentido da obra mora no que a perseguição revela sobre quem persegue.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'Você precisa de um motivo para partes opostas ocuparem o mesmo espaço.',
        'O tema mora na caçada, não no prêmio.',
        'Estruturas de assalto, perseguição, busca ou elenco coral.',
        'Explicar o objeto em detalhe só abriria perguntas que não ajudam.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Ninguém na história concorda sobre o que há dentro da maleta. Cada personagem explica por que precisa dela, e cada explicação é uma confissão.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Explicar demais até o público esperar que aquilo pague algo tematicamente.',
        'Deixá-lo tão arbitrário que o risco fica sem peso.',
        'Esquecer que os personagens precisam acreditar nele por inteiro, mesmo que a obra não acredite.',
      ],
    },
    { type: 'seeAlso', pages: ['red-herring', 'want-vs-need', 'ticking-clock', 'theme-statement'] },
  ],
};
export default page;
