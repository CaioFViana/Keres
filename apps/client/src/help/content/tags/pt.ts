import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'tags',
  title: 'Etiquetas',
  summary: 'Organize etiquetas da sua história.',
  keywords: ['etiquetas'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Etiquetas é um recurso para registrar e conectar informações da história.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Use etiquetas para tornar uma decisão de narrativa fácil de consultar durante a revisão.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Abra Etiquetas no Menu da história.',
        'Toque em + ou abra um registro existente.',
        'Preencha os campos e salve.',
        'Revise os vínculos nos detalhes.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'name',
          label: 'Nome',
          whatToWrite: 'O nome em si que aparece da Etiqueta.',
          note: 'Mantenha curto se possível para evitar falhas visuais.',
        },
        {
          key: 'color',
          label: 'Cor',
          whatToWrite: 'A cor que esta Etiqueta mostra em suas Entidades.',
          note: 'Use o selecionador de cores para ter da maneira que quiser.',
        },
        {
          key: 'isFavorite',
          label: 'Favorita',
          whatToWrite: 'Ative para destacar uma Etiqueta importante.',
          note: 'Entra no filtro de favoritos.',
        },
        {
          key: 'extraNotes',
          label: 'Anotações extras',
          whatToWrite: 'O que esta Etiqueta deveria ser?',
          note: 'Use para organizar cada Etiqueta.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'As informações ficam disponíveis em listas, detalhes, buscas e vínculos relacionados.',
    },
    { type: 'seeAlso', pages: ['lists-and-search', 'see-also', 'comments'] },
  ],
};
export default page;
