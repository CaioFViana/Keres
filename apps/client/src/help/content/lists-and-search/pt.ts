import type { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'lists-and-search',
  title: 'Listas, busca e filtros',
  summary: 'Encontre elementos da história sem percorrer cada tela manualmente.',
  keywords: ['buscar', 'filtro', 'filtros', 'etiqueta', 'favoritos', 'ordenar', 'busca avançada'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'As listas mostram elementos de um mesmo tipo, como Personagens ou Cenas. Elas oferecem busca, ordenação, filtro por Etiquetas, a opção de ver favoritos e Filtros, que restringem a lista por qualquer campo; a Busca Global pesquisa a história aberta.',
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
        'Digite uma palavra no campo de busca para reduzir a lista; o trecho encontrado aparece destacado, e o x esvazia o campo.',
        'Use o filtro de etiquetas e os controles de ordenação quando precisar limitar ou reorganizar os resultados.',
        'Marque itens como favoritos para encontrá-los novamente pela estrela, que alterna entre todos, favoritos e não favoritos.',
        'Toque em Filtros e depois em Adicionar filtro para escolher os campos e valores que devem ser combinados. O nome já vem aberto; aperte Enter ou Ver resultados para aplicar.',
        'O que restringe a lista - favoritos e cada filtro por campo - aparece como uma etiqueta sob a busca, com um x para remover e Limpar filtros para remover todos. O número em Filtros conta os filtros por campo.',
        'Quando nada corresponde, a lista avisa e oferece Limpar filtros.',
        'Na Busca Global, aberta dentro de uma história, pesquise em vários tipos de elemento ao mesmo tempo.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'Buscar, filtrar e ordenar não altera a história. Algumas listas lembram os filtros para a próxima visita; as etiquetas os mostram. Favoritar altera apenas a marca do item; o modo como essa marca é compartilhada depende das configurações de favoritos da história.',
    },
    { type: 'seeAlso', pages: ['tags', 'favorites', 'custom-attributes'] },
  ],
};
export default page;
