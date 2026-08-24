import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'deus-ex-machina',
  title: 'Deus ex machina',
  summary: 'Um resgate externo sem preparo. Quase sempre um defeito, às vezes uma declaração.',
  keywords: ['deus ex machina', 'conveniencia', 'resgate', 'final', 'coincidencia', 'sem merito'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Um problema declarado insolúvel é resolvido por uma força que a obra nunca estabeleceu: um aliado desconhecido, uma regra não mencionada, um golpe de sorte. Está listado aqui sobretudo para você reconhecê-lo nos próprios rascunhos, onde costuma aparecer disfarçado de alívio.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'De propósito, quando o tema é que o mundo é indiferente ou absurdo.',
        'Como diagnóstico: se seu final precisa de um, falta um plantio no meio.',
        'Na comédia, em que o resgate mecânico pode ser a piada e é assumido como tal.',
        'Como abertura, e não final: a sorte imerecida cria um problema em vez de encerrá-lo.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'O cerco se rompe porque chega uma tempestade. Isso é um resgate. Vira outra coisa se, quarenta páginas antes, alguém tiver descartado as tempestades sazonais como superstição.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Confundir preparo com previsibilidade; um plantio pode ser discreto e ainda ser justo.',
        'Resolver com um personagem que não tem nada em jogo no desfecho.',
        'Usar e depois fazer os personagens comentarem a coincidência, o que nomeia o defeito sem corrigi-lo.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['chekhovs-gun', 'setup-and-payoff', 'lampshading', 'impossible-choice'],
    },
  ],
};
export default page;
