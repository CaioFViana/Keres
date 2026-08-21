import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'point-of-view',
  title: 'Ponto de vista',
  summary: 'Quem percebe a cena, e o que essa escolha torna impossível.',
  keywords: [
    'ponto de vista',
    'point of view',
    'primeira pessoa',
    'terceira limitada',
    'onisciente',
    'focalizacao',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'A posição de onde a obra percebe: primeira pessoa, terceira limitada, terceira onisciente, segunda pessoa, ou um elenco rotativo. Cada escolha dá acesso a um interior e nega os demais, e essa negação costuma ser a parte mais útil.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'Ao decidir cedo, já que mudar depois reescreve tudo.',
        'Um mistério depende de alguém não saber algo.',
        'Você precisa de intimidade com um personagem ou distância irônica de todos.',
        'Um elenco coral precisa distribuir os pontos de vista pelo que só aquele personagem testemunha.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'O mesmo enterro narrado pela viúva, pelo contador e por um narrador onisciente são três obras diferentes com os mesmos acontecimentos.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Escorregar para outra cabeça no meio da cena sem querer.',
        'Escolher onisciência para não escolher, e nunca usar as vantagens dela.',
        'Girar os pontos de vista com tanta frequência que nenhum interior se estabelece.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['narrative-voice', 'unreliable-narrator', 'dramatic-irony', 'frame-story'],
    },
  ],
};
export default page;
