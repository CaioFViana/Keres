import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'narrative-voice',
  title: 'Voz narrativa e distância psíquica',
  summary: 'Quão perto a narração fica da mente do personagem, e como essa distância se move.',
  keywords: [
    'voz narrativa',
    'distancia psiquica',
    'discurso indireto livre',
    'narrative voice',
    'diccao',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Mesmo dentro de um único ponto de vista, a narração pode ficar longe — nomeando uma cidade e um ano — ou se aproximar tanto que o vocabulário dela vira o vocabulário do personagem. O discurso indireto livre mora na ponta próxima, onde pensamento e narração se fundem sem aspas.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'Uma cena precisa abrir em plano geral e depois fechar sobre uma pessoa.',
        'Você quer interioridade sem pensamentos em itálico nem primeira pessoa.',
        'A dicção do personagem é mais interessante que uma prosa neutra.',
        'Um momento traumático ou avassalador exige distância súbita, ou proximidade súbita.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Era março numa cidade de quatro mil habitantes. A clínica abria às oito. Ela odiava a clínica. Meu Deus, aquele cheiro, as cadeiras rosa, oito da manhã e já tinha gente chorando.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Mudar de distância ao acaso, o que soa como mão trêmula.',
        'Ficar tanto tempo na proximidade máxima que nenhuma cena consegue ser enquadrada.',
        'Deixar a narração usar palavras que o personagem jamais teria.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['point-of-view', 'unreliable-narrator', 'show-dont-tell', 'pacing'],
    },
  ],
};
export default page;
