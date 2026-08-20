import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'motif-and-leitmotif',
  title: 'Motivo e leitmotiv',
  summary: 'Uma imagem, frase ou som repetido que acumula sentido.',
  keywords: ['motivo', 'leitmotiv', 'motif', 'repeticao', 'simbolo', 'recorrencia'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Um elemento que retorna ao longo da obra e ganha peso a cada vez. O motivo é uma imagem ou ideia repetida; o leitmotiv está amarrado a um personagem, lugar ou ideia específica e o anuncia. O sentido vem de o contexto mudar enquanto o elemento permanece igual.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'Um tema precisa de uma forma física que o público reconheça.',
        'Você quer que o final ressoe sem reafirmar nada.',
        'Obras longas ou fragmentadas que precisam de tecido conjuntivo.',
        'Mídias multissensoriais, em que um som ou uma cor faz o trabalho em silêncio.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Mãos aparecem sempre que há confiança em jogo: um aperto recusado, uma farpa arrancada, e no fim uma mão estendida e não aceita.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Repetição sem variação, que é notada como cacoete em vez de sentida.',
        'Explicar o motivo uma vez, o que o converte em etiqueta.',
        'Escolher algo tão genérico — chuva, espelhos — que não carrega nada específico.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['thematic-mirror', 'bookending', 'theme-statement', 'rule-of-three'],
    },
  ],
};
export default page;
