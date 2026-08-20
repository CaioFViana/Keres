import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'heros-journey',
  title: 'Jornada do herói',
  summary: 'O protagonista deixa o mundo comum, é provado, e volta transformado.',
  keywords: [
    'jornada do heroi',
    'monomito',
    'campbell',
    'vogler',
    'mentor',
    'limiar',
    'heros journey',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Um ciclo descrito a partir da mitologia comparada e depois transformado em modelo de roteiro: chamado à aventura, recusa, mentor, travessia do limiar, provações e aliados, provação central, recompensa, caminho de volta, e retorno carregando algo de que o mundo antigo precisava.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'A história trata, no fundo, de transformação por deslocamento.',
        'Você quer um registro mítico reconhecível: fantasia, aventura, amadurecimento.',
        'Você precisa de uma lista para descobrir qual etapa falta no seu rascunho.',
        'Você vai subvertê-la de propósito e precisa saber o que está subvertendo.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Uma entregadora recusa uma encomenda que a levaria além da fronteira, perde o sustento mesmo assim, aceita a viagem, e volta para casa com um mapa que torna o antigo patrão obsoleto.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Preencher todas as etapas porque o modelo lista, gerando cenas sem pressão por trás.',
        'Supor que é universal; muitas tradições estruturam histórias sem partida e retorno.',
        'Fazer do mentor um mecanismo de exposição em vez de um personagem com algo em jogo.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['story-circle', 'refusal-of-the-call', 'heroines-journey', 'kill-the-mentor'],
    },
  ],
};
export default page;
