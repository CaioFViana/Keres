import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'favorites',
  title: 'Favoritos',
  summary:
    'Destaque histórias e elementos importantes e escolha como isso funciona em colaboração.',
  keywords: ['estrela', 'favorita', 'favoritos', 'filtro', 'compartilhar'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Favoritos são estrelas para reencontrar histórias, personagens, cenas e outros elementos rapidamente. Em uma história compartilhada, o comportamento escolhido nas Configurações da história define se a estrela é a mesma para todos ou pessoal.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Durante a revisão, você marca três cenas que precisam de atenção. Com o filtro de favoritos, elas aparecem sem misturar o restante das cenas. Se cada colaborador tiver prioridades diferentes, use favoritos individuais para que uma pessoa não altere a lista da outra.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Na lista de um elemento, toque na estrela do cartão, ou abra o detalhe e toque na estrela no cabeçalho.',
        'Use o filtro de favoritos da lista para mostrar somente o que foi marcado.',
        'Para decidir como favoritos funcionam na história, abra Menu da história › Configurações da história e escolha Comportamento dos favoritos.',
        'Escolha Global para uma única lista compartilhada; Individual para cada pessoa ter sua lista privada; ou Individual público para cada pessoa ter a própria lista, mas permitir ver quem marcou um elemento.',
        'Salve as Configurações da história. Só quem pode editar a história pode mudar esse comportamento.',
      ],
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'Em uma história local, favoritos servem apenas para sua organização. A diferença entre os três comportamentos importa quando a história está ligada a um servidor e tem colaboradores.',
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'A estrela muda o filtro e a marca mostrada nas listas, nos cartões e nos detalhes. No modo Global, uma alteração aparece para todos os colaboradores. No modo Individual público, o detalhe pode mostrar quem favoritou; no modo Individual, essa informação não é compartilhada.',
    },
    {
      type: 'seeAlso',
      pages: ['lists-and-search', 'story-settings', 'collaborators', 'sync-basics'],
    },
  ],
};
export default page;
