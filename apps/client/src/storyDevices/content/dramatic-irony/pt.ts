import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'dramatic-irony',
  title: 'Ironia dramática',
  summary: 'O público sabe algo que um personagem não sabe, e fica esperando.',
  keywords: [
    'ironia dramatica',
    'dramatic irony',
    'suspense',
    'hitchcock',
    'assimetria de informacao',
    'tensao',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Um vão deliberado entre o que o público sabe e o que o personagem sabe. A tensão vem da antecipação, não da surpresa: cada fala banal do personagem ganha um segundo sentido, e é o público que carrega o peso da informação.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'Você quer pavor sustentado ao longo de uma cena longa, em vez de um susto.',
        'Uma conversa tranquila precisa parecer perigosa.',
        'Tragédia, em que o público deve ver o erro antes do personagem.',
        'Comédia construída sobre suposições equivocadas.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Vimos ele esconder a carta. Agora a irmã pergunta, casualmente, se chegou alguma coisa pelo correio, e cada palavra da resposta é uma pequena avalanche.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Revelar ao público cedo demais, e a espera durar mais que o interesse.',
        'Fazer o personagem desinformado agir de modo idiota só para manter o vão aberto.',
        'Nunca fechar o vão; a colheita é o momento em que o personagem descobre.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['foreshadowing', 'subtext', 'ticking-clock', 'unreliable-narrator'],
    },
  ],
};
export default page;
