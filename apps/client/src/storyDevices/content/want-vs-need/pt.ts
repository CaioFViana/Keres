import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'want-vs-need',
  title: 'Desejo e necessidade',
  summary: 'O objetivo consciente contra a lição inconsciente. O motor do conflito interno.',
  keywords: [
    'desejo e necessidade',
    'want vs need',
    'conflito interno',
    'objetivo',
    'mentira',
    'arco',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'O desejo é o que o personagem persegue e consegue dizer em voz alta. A necessidade é o que de fato o tornaria inteiro, e em geral ele não enxerga. A trama é construída a partir do desejo; o sentido nasce da colisão entre os dois.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'O protagonista é ativo mas a história parece sem peso.',
        'Você está desenhando o final e não decide se ele deve vencer.',
        'Um personagem insiste em decisões que o público acha inexplicáveis.',
        'Cada subtrama precisa de um motivo para existir além de ocupar tempo.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Ele quer a promoção que prova que o pai estava errado. Ele precisa parar de discutir com um homem morto há nove anos. A história pode lhe dar uma, as duas ou nenhuma, e cada combinação significa algo diferente.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Declarar a necessidade em voz alta logo cedo, o que a converte em outro desejo.',
        'Fazer desejo e necessidade coincidirem, o que elimina o conflito interno.',
        'Conceder a necessidade sem que o personagem a escolha.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['character-arc', 'the-wound', 'theme-statement', 'impossible-choice'],
    },
  ],
};
export default page;
