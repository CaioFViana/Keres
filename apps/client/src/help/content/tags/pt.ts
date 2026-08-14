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
          whatToWrite: 'Preencha a informação que descreve esta etiquetas.',
          note: 'Aparece nos detalhes e nas ferramentas relacionadas.',
        },
        {
          key: 'color',
          label: 'Cor',
          whatToWrite: 'Preencha a informação que descreve esta etiquetas.',
          note: 'Aparece nos detalhes e nas ferramentas relacionadas.',
        },
        {
          key: 'extraNotes',
          label: 'Anotações extras',
          whatToWrite: 'Preencha a informação que descreve esta etiquetas.',
          note: 'Aparece nos detalhes e nas ferramentas relacionadas.',
        },
        {
          key: 'isFavorite',
          label: 'Favorita',
          whatToWrite: 'Preencha a informação que descreve esta etiquetas.',
          note: 'Aparece nos detalhes e nas ferramentas relacionadas.',
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
