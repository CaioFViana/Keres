import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'dialogue-beats',
  title: 'Beats de diálogo',
  summary: 'Ação e silêncio entre as falas, fazendo o que as falas não conseguem.',
  keywords: [
    'beats de dialogo',
    'dialogue beats',
    'acao entre falas',
    'pausa',
    'marcacao',
    'atribuicao',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'As pequenas ações físicas, pausas e interrupções colocadas entre as falas: alguém se levanta, enche o copo, não responde. Os beats controlam o ritmo da conversa, substituem advérbios nas atribuições, e deixam o público ler intenção a partir do comportamento.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'Uma conversa soa como vozes soltas no vazio.',
        'Você precisa que uma pausa carregue um peso que nenhuma fala carregaria.',
        'A atribuição virou lista de advérbios: disse ele com raiva, disse ela suavemente.',
        'A cena precisa lembrar o público de onde aquilo acontece.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Em vez de "Eu te perdoo", disse ela friamente, tente: ela fechou o notebook. "Eu te perdoo." Não levantou os olhos.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Beats de enchimento — acenar, sorrir, tomar um gole — que somam palavras e nenhum sentido.',
        'Um beat depois de cada fala, o que transforma o diálogo em rubrica.',
        'Beats que contradizem a fala por acidente, e não de propósito.',
      ],
    },
    { type: 'seeAlso', pages: ['subtext', 'show-dont-tell', 'pacing', 'sensory-grounding'] },
  ],
};
export default page;
