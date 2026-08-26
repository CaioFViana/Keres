import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'three-act-structure',
  title: 'Estrutura de três atos',
  summary: 'Apresentação, confronto, resolução — o formato padrão que o público já espera.',
  keywords: [
    'tres atos',
    'estrutura',
    'apresentacao',
    'confronto',
    'resolucao',
    'three act structure',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'A obra se divide em três movimentos: o Ato 1 estabelece quem quer o quê e por que é difícil, o Ato 2 escala os obstáculos até a situação ficar pior do que no começo, e o Ato 3 força uma decisão e convive com as consequências dela. As duas viradas de ato são os momentos em que o protagonista não pode mais voltar atrás.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'Você tem cenas e não tem espinha dorsal, e precisa de onde pendurá-las.',
        'O meio do rascunho afrouxa e você não consegue apontar onde começou a afrouxar.',
        'Você trabalha numa mídia de duração fixa e precisa de proporções.',
        'Você quer uma estrutura que o público leia sem perceber.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Uma cozinheira descobre que o restaurante lava dinheiro (fim do Ato 1: ela não pode mais desconhecer). Tenta expor aquilo discretamente e cada tentativa lhe custa mais caro (Ato 2). Escolhe entre o emprego e o depoimento (Ato 3).',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Tratar as viradas de ato como contagem de páginas em vez de pontos sem retorno.',
        'Deixar o Ato 2 virar um corredor de acontecimentos que poderiam ser reordenados sem perda.',
        'Resolver o Ato 3 com uma informação que o público nunca teve.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['freytags-pyramid', 'seven-point-structure', 'save-the-cat-beat-sheet', 'pacing'],
    },
  ],
};
export default page;
