import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'thematic-mirror',
  title: 'Espelho temático',
  summary: 'Uma subtrama diante do mesmo dilema, respondendo de outro jeito.',
  keywords: [
    'espelho tematico',
    'thematic mirror',
    'subtrama',
    'paralelo',
    'trama b',
    'contraponto',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Um personagem ou linha secundária posta numa situação estruturalmente idêntica à do protagonista e autorizada a escolher diferente. Permite que a obra discuta consigo mesma: o público vê um caminho não tomado e suas consequências, sem que ninguém explique a comparação.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'Uma subtrama existe e você não consegue justificar a presença dela.',
        'A escolha do protagonista precisa de um custo que a trama principal não mostra.',
        'O tema corre o risco de virar sermão com uma voz só.',
        'Um elenco coral precisa de coerência entre linhas separadas.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'A protagonista se recusa a depor. O antigo colega depõe, é protegido, e perde todo mundo que conhecia. Nenhum dos dois desfechos é apresentado como a resposta.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Fazer o espelho tão paralelo que ele soa como diagrama.',
        'Deixar o personagem espelhado obviamente errado, o que elimina a discussão.',
        'Introduzir tarde, quando não há espaço para consequências.',
      ],
    },
    { type: 'seeAlso', pages: ['theme-statement', 'the-foil', 'motif-and-leitmotif', 'flat-arc'] },
  ],
};
export default page;
