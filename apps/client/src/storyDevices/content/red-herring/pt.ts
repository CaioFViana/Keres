import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'red-herring',
  title: 'Pista falsa',
  summary: 'Um desvio deliberado que mantém a resposta real escondida à vista de todos.',
  keywords: ['pista falsa', 'red herring', 'desvio', 'misterio', 'suspeito', 'engodo'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Informação, comportamento ou personagem posicionado para que o público construa uma teoria errada, porém razoável. Uma pista falsa honesta tem explicação própria: quando a verdade chega, o desvio ainda deve fazer sentido, e não evaporar.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'Mistério, thriller, ou qualquer obra em que adivinhar faz parte do prazer.',
        'A resposta real está visível cedo demais e precisa de companhia.',
        'Você quer que um personagem secundário carregue peso real antes de ser inocentado.',
        'O público precisa errar de um jeito que lhe ensine alguma coisa.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'O vizinho mente sobre onde estava naquela noite. Ele estava numa clínica da qual tem vergonha. A mentira é real, a conclusão não é.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Uma pista que só existe para enganar, e que soa como trapaça depois de explicada.',
        'Tantos desvios que a verdade chega sem peso acumulado.',
        'Sonegar por completo a pista verdadeira, o que não é desvio, é omissão.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['foreshadowing', 'macguffin', 'dramatic-irony', 'subversion-of-tropes'],
    },
  ],
};
export default page;
