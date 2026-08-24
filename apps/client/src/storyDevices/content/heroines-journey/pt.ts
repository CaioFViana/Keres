import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'heroines-journey',
  title: 'Jornada da heroína',
  summary: 'Um ciclo de separação, sucesso falso, descida e reintegração do eu.',
  keywords: [
    'jornada da heroina',
    'murdock',
    'reintegracao',
    'heroines journey',
    'descida',
    'inteireza',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Um contramodelo à jornada em formato de conquista. A protagonista rejeita parte de si para vencer pelas regras externas, alcança essa vitória, descobre que ela é oca, desce até aquilo que abandonou, e retorna integrando as duas metades em vez de derrotar um inimigo.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'O antagonista real é uma expectativa internalizada, não uma pessoa.',
        'A protagonista vence cedo e a história trata do preço da vitória.',
        'Você quer uma resolução que cure uma cisão em vez de destruir um oponente.',
        'O arco de conquista insiste em fazer sua protagonista parecer uma estranha.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Uma arquiteta constrói a reputação nunca mencionando a cidade de onde veio, ganha a obra que queria, não consegue projetar nada depois disso, volta para casa, e reencontra o vocabulário que tinha enterrado.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Transformar a descida em montagem; ela é a substância, não a transição.',
        'Enquadrar a reintegração como abrir mão da ambição em vez de alargá-la.',
        'Tratar o modelo como marcado por gênero em vez de uma forma disponível a qualquer personagem.',
      ],
    },
    { type: 'seeAlso', pages: ['heros-journey', 'want-vs-need', 'character-arc', 'the-wound'] },
  ],
};
export default page;
