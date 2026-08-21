import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'show-dont-tell',
  title: 'Mostre, não conte',
  summary: 'Deixe o comportamento e o detalhe carregarem o que um resumo achataria.',
  keywords: [
    'mostre nao conte',
    'show dont tell',
    'detalhe concreto',
    'comportamento',
    'resumo',
    'evidencia',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Em vez de nomear um estado — ela estava nervosa, a cidade era pobre — entregue a evidência ao público e deixe que ele nomeie. A conclusão a que o público chega sozinho fica mais firme do que a que recebe pronta.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'Um momento é importante e o público precisa senti-lo, não arquivá-lo.',
        'A emoção é complicada o bastante para que qualquer palavra única a reduza.',
        'Você está escrevendo a primeira impressão de uma pessoa ou de um lugar.',
        'Um rascunho está cheio de adjetivos e escasso de coisas concretas.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Não "ela estava nervosa", e sim: leu a mesma linha do cardápio quatro vezes e pediu algo que não estava nele.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Aplicar em tudo, o que incha transições rotineiras até virarem números.',
        'Mostrar e contar assim mesmo, por via das dúvidas.',
        'Esquecer que o resumo é ferramenta legítima para tudo que deve passar rápido.',
      ],
    },
    { type: 'seeAlso', pages: ['sensory-grounding', 'subtext', 'iceberg-theory', 'pacing'] },
  ],
};
export default page;
