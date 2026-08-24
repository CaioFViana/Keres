import type { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'lists-and-search',
  title: 'Listas, busca e filtros',
  summary: 'Encontre elementos da história sem percorrer cada tela manualmente.',
  keywords: ['buscar', 'filtro', 'etiqueta', 'favoritos', 'busca avançada'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'As listas mostram elementos de um mesmo tipo, como Personagens ou Cenas. Elas oferecem busca, ordenação, filtros por Etiquetas e a opção de ver favoritos; a Busca Avançada combina campos e a Busca Global pesquisa a história aberta.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Antes de revisar o segundo ato, pesquise “Lia”, filtre a etiqueta “revisar” e mostre favoritos para chegar rapidamente às cenas e personagens prioritários.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Abra no menu a lista do elemento que procura.',
        'Digite uma palavra no campo de busca para reduzir a lista.',
        'Use os controles de filtro e ordenação quando precisar limitar ou reorganizar os resultados.',
        'Marque itens como favoritos para encontrá-los novamente pelo filtro de favoritos.',
        'Na Busca Avançada, escolha os campos e valores que devem ser combinados.',
        'Na Busca Global, aberta dentro de uma história, pesquise em vários tipos de elemento ao mesmo tempo.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'Buscar, filtrar e ordenar não altera a história. Favoritar altera apenas a marca do item; o modo como essa marca é compartilhada depende das configurações de favoritos da história.',
    },
    { type: 'seeAlso', pages: ['tags', 'favorites', 'custom-attributes'] },
  ],
};
export default page;
