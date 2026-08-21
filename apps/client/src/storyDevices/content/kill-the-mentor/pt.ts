import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'kill-the-mentor',
  title: 'Matar o mentor',
  summary: 'Retirar o apoio para que o protagonista tenha de andar sozinho.',
  keywords: [
    'matar o mentor',
    'kill the mentor',
    'morte do mentor',
    'perda',
    'independencia',
    'crise',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Tirar a figura que vinha respondendo às perguntas do protagonista — por morte, traição, ausência ou simples fracasso — no momento em que a orientação dela é mais necessária. A remoção converte competência herdada numa decisão que o protagonista precisa assumir.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'O protagonista virou passageiro da própria história.',
        'O público precisa sentir que ninguém vem salvar.',
        'Uma lição precisa ser testada em vez de repetida.',
        'Você precisa de um luto que também mude a estrutura, não só o clima.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'A enfermeira-chefe se aposenta no meio da crise, sem drama: simplesmente não está mais na escala, e a decisão agora é de quem nunca tomou nenhuma.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Matar um mentor que o público não teve tempo de valorizar.',
        'Usar a morte como atalho para um desenvolvimento que nunca foi escrito.',
        'Remover o mentor e em seguida fornecer um substituto idêntico.',
      ],
    },
    { type: 'seeAlso', pages: ['heros-journey', 'role-reversal', 'character-arc', 'the-wound'] },
  ],
};
export default page;
