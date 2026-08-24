import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'refusal-of-the-call',
  title: 'Recusa do chamado',
  summary: 'O protagonista diz não primeiro, e o motivo revela quem ele é.',
  keywords: ['recusa do chamado', 'heroi relutante', 'refusal of the call', 'debate', 'hesitacao'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Antes de aceitar a história, o personagem a recusa. A recusa não é atraso: ela nomeia o medo, o dever ou a crença que a obra inteira terá de desmontar, e faz o sim futuro custar alguma coisa.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'A premissa é tão atraente que aceitar na hora soaria irreal.',
        'Você precisa estabelecer o medo que o final vai resolver.',
        'O personagem tem obrigações reais que a aventura trairia.',
        'Você quer que o público discuta com o personagem e se envolva.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Uma tradutora se recusa a depor porque a mãe é indocumentada. A recusa declara o preço do sim muito antes de ela dizê-lo.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Recusar sem um motivo que se possa articular, o que soa como enrolação.',
        'Anular a recusa por força externa, de modo que o personagem nunca escolhe.',
        'Alongar tanto que o público aceita o chamado antes do protagonista.',
      ],
    },
    { type: 'seeAlso', pages: ['heros-journey', 'want-vs-need', 'impossible-choice', 'the-wound'] },
  ],
};
export default page;
