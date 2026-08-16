import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'notes',
  title: 'Notas',
  summary: 'Organize notas da sua história.',
  keywords: ['notas'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Notas é um recurso para registrar e conectar informações da história.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Use notas para tornar uma decisão de narrativa fácil de consultar durante a revisão.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Abra Notas no Menu da história.',
        'Toque em + ou abra um registro existente.',
        'Preencha os campos e salve.',
        'Revise os vínculos nos detalhes.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'title',
          label: 'Título',
          whatToWrite: 'Um título curto para descrever a nota.',
          note: 'Aparece em detalhes e entidades relacionadas.',
        },
        {
          key: 'body',
          label: 'Corpo',
          whatToWrite: 'A informação em si da nota.',
          note: 'Aparece quando clicada. Perfeita para escrever mais detalhes.',
        },
        {
          key: 'isFavorite',
          label: 'Favorita',
          whatToWrite: 'Ative para destacar uma nota importante.',
          note: 'Entra no filtro de favoritos.',
        },
        {
          key: 'extraNotes',
          label: 'Anotações extras',
          whatToWrite:
            'Mais detalhes que não são relevantes o suficiente para adicionar no corpo da nota principal.',
          note: 'Ficam nos detalhes da nota.',
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
