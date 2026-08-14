import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'chapters',
  title: 'Capítulos',
  summary: 'Agrupe cenas pela ordem em que o leitor as encontra.',
  keywords: ['capítulo', 'ordem', 'resumo', 'cenas'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    { type: 'paragraph', text: 'Capítulos organizam cenas na ordem de leitura da história.' },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'O prólogo pode ser o primeiro capítulo lido, mesmo que mostre um acontecimento de vinte anos antes. A Ordem registra leitura, não a cronologia do mundo.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    { type: 'path', segments: ['Menu da história', 'Capítulos', '+'] },
    {
      type: 'steps',
      items: [
        'Crie um capítulo e informe Nome.',
        'Use Resumo para registrar seu papel na narrativa.',
        'Salve e crie ou associe cenas a ele.',
        'Use a reorganização de capítulos quando quiser mudar a ordem de leitura.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'name',
          label: 'Nome',
          whatToWrite: 'Um título pelo qual você reconhece o capítulo. Preencha para salvar.',
          note: 'Aparece nas listas e na escolha do capítulo das cenas.',
        },
        {
          key: 'summary',
          label: 'Resumo',
          whatToWrite: 'O que acontece ou qual é a função deste capítulo.',
          note: 'Ajuda a revisar o ritmo geral.',
        },
        {
          key: 'order',
          label: 'Ordem',
          whatToWrite: 'A posição de leitura desejada.',
          note: 'Não precisa representar a cronologia do mundo.',
        },
        {
          key: 'isFavorite',
          label: 'Favorita',
          whatToWrite: 'Ative para destacar o capítulo.',
          note: 'Entra no filtro de favoritos.',
        },
        {
          key: 'extraNotes',
          label: 'Anotações extras',
          whatToWrite: 'Lembretes que não cabem no resumo.',
          note: 'Ficam nos detalhes do capítulo.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'Cenas usam o capítulo para aparecer agrupadas e ordenadas. Excluir um capítulo exige revisar as cenas que dependem dele.',
    },
    { type: 'seeAlso', pages: ['scenes', 'story-dashboard', 'lists-and-search'] },
  ],
};
export default page;
