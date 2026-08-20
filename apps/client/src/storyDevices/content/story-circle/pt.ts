import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'story-circle',
  title: 'Roda da história',
  summary: 'Oito passos: você, necessidade, ir, buscar, encontrar, pagar, retornar, mudar.',
  keywords: ['roda da historia', 'harmon', 'oito passos', 'ciclo', 'story circle'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Uma versão comprimida e repetível do ciclo de partida e retorno, popularizada na televisão episódica. Um personagem em conforto sente uma necessidade, entra numa situação estranha, se adapta, consegue o que queria, paga por isso, retorna, e está mensuravelmente diferente.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'Você precisa de forma para um episódio, capítulo ou missão secundária, não para a obra toda.',
        'A trama principal já tem estrutura e uma subtrama não tem.',
        'Você quer que a mudança seja visível numa sentada só.',
        'Você está rascunhando rápido e quer oito perguntas em vez de uma teoria.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Uma enfermeira que nunca pede ajuda (você) precisa de uma noite livre (necessidade), troca de turno (ir), cobre uma ala que não conhece (buscar), dá conta (encontrar), perde a ligação da irmã (pagar), volta para a ala dela (retornar), e passa a pedir ajuda (mudar).',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Chegar em mudar sem nunca mostrar o preço pago em pagar.',
        'Fechar tanto a roda que nada fora do protagonista importa.',
        'Repetir a mesma roda todo episódio até o público prever a batida em vez do desfecho.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['heros-journey', 'character-arc', 'want-vs-need', 'scene-and-sequel'],
    },
  ],
};
export default page;
