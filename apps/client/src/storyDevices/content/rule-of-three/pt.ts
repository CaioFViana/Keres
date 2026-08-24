import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'rule-of-three',
  title: 'Regra dos três',
  summary: 'Três é o menor número que estabelece um padrão e permite quebrá-lo.',
  keywords: ['regra dos tres', 'rule of three', 'padrao', 'comedia', 'triade', 'ritmo'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Agrupar em trios: duas ocorrências criam expectativa, a terceira confirma ou subverte. Está por trás do tempo cômico, das provações que escalam e do formato de muitas listas e discursos, por ser a sequência mais curta que parece completa.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'Uma piada precisa de estrutura: preparo, reforço, quebra.',
        'Uma provação ou tentativa deve escalar e terminar sem soar arbitrária.',
        'Uma frase ou lista precisa de um ritmo que o público termina junto.',
        'Você quer que um motivo seja reconhecido sem ser explicado.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Ela se desculpa com a editora. Se desculpa com o estagiário. Começa a se desculpar com o motorista que a fechou no trânsito, e para no meio da frase.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Usar trios em tudo até o ritmo virar metrônomo.',
        'Fazer as três batidas iguais, e a terceira não ter o que acrescentar.',
        'Aplicar a um material cuja contagem honesta é dois ou cinco.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['pacing', 'setup-and-payoff', 'motif-and-leitmotif', 'subversion-of-tropes'],
    },
  ],
};
export default page;
