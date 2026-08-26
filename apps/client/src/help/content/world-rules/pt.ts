import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'world-rules',
  title: 'Regras do mundo',
  summary: 'Guarde limites e fatos que mantêm o universo coerente.',
  keywords: ['regra', 'mundo', 'continuidade'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Uma regra do mundo registra um limite ou fato que sua narrativa deve respeitar.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: '“Teleporte só funciona entre espelhos marcados” evita soluções contraditórias em cenas futuras.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Abra Menu da história › Regras do mundo.',
        'Crie uma regra e informe Título.',
        'Explique a regra em Descrição e salve.',
        'Use Etiquetas, Notas e Veja também para conectá-la a cenas ou personagens.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'title',
          label: 'Título',
          whatToWrite: 'O nome curto da regra. Preencha para salvar.',
          note: 'Aparece nas listas e buscas.',
        },
        {
          key: 'description',
          label: 'Descrição',
          whatToWrite: 'O limite, fato ou consequência que deve ser respeitado.',
          note: 'É o texto principal para consulta e comentários.',
        },
        {
          key: 'isFavorite',
          label: 'Favorita',
          whatToWrite: 'Ative para destacar uma regra importante.',
          note: 'Entra no filtro de favoritos.',
        },
        {
          key: 'extraNotes',
          label: 'Anotações extras',
          whatToWrite: 'Exceções, ideias ou lembretes.',
          note: 'Ficam nos detalhes da regra.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'A regra não bloqueia automaticamente ações no aplicativo; ela é uma referência para suas cenas, notas, buscas e revisões.',
    },
    { type: 'seeAlso', pages: ['scenes', 'notes', 'see-also'] },
  ],
};
export default page;
