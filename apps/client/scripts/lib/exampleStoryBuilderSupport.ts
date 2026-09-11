import { createHash } from 'node:crypto';

export type ExampleStoryLanguage = 'en' | 'pt';

export const FIXED_DATE = '2025-01-01T00:00:00.000Z';
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function deterministicUlid(slug: string, key: string): string {
  const bytes = createHash('sha256').update(`${slug}:${key}`).digest().subarray(0, 16);
  let value = BigInt(`0x${bytes.toString('hex')}`);
  let encoded = '';
  for (let index = 0; index < 26; index += 1) {
    encoded = CROCKFORD[Number(value & 31n)] + encoded;
    value >>= 5n;
  }
  return encoded;
}

export function base(id: string, storyId: string) {
  return {
    id,
    storyId,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    version: 1,
    isDeleted: false,
    deletedAt: null,
  };
}

export function showcaseText(language: ExampleStoryLanguage) {
  return language === 'pt'
    ? {
        galleryTitle: 'Fonte pública da história',
        galleryNotes: 'Link para a fonte pública usada como referência editorial do exemplo.',
        boardName: 'Fios de decisão',
        boardDescription: 'Uma visão de personagens, pistas e escolhas que alteram o caminho.',
        boardNoteTitle: 'Pergunta de revisão',
        boardNoteBody: 'A decisão precisa deixar claro o que Alice sabe antes de escolher.',
        castleMapName: 'Mapa do castelo',
        castleMapDescription: 'Locais do castelo e seus caminhos narrativos.',
        seaMapName: 'Mapa do mar e da costa',
        seaMapDescription: 'Pontos da superfície e do fundo do mar usados pela narrativa.',
        calendarName: 'Calendário do Baile',
        calendarDescription: 'O calendário que mede a aproximação da meia-noite.',
        parallelCalendarName: 'Calendário Lunar',
        parallelCalendarDescription: 'Uma contagem paralela para as eras lunares da história.',
        storyDateName: 'Data do destino',
        storyDateDescription: 'Uma data registrada no calendário próprio da história.',
      }
    : {
        galleryTitle: 'Public story source',
        galleryNotes: 'A link to the public source used as editorial reference for this example.',
        boardName: 'Decision threads',
        boardDescription: 'A view of characters, clues, and choices that change the path.',
        boardNoteTitle: 'Revision question',
        boardNoteBody: 'The choice should make clear what Alice knows before she decides.',
        castleMapName: 'Castle map',
        castleMapDescription: 'Castle places and the narrative paths between them.',
        seaMapName: 'Sea and shore map',
        seaMapDescription: 'Surface and underwater places used by the narrative.',
        calendarName: 'Ball Calendar',
        calendarDescription: 'The calendar that measures the approach of midnight.',
        parallelCalendarName: 'Lunar Calendar',
        parallelCalendarDescription: 'A parallel count for the story’s lunar eras.',
        storyDateName: 'Date of destiny',
        storyDateDescription: 'A date recorded in the story’s own calendar.',
      };
}

export function publicSourceUrl(slug: string): string {
  const slugs: Record<string, string> = {
    'alice-in-wonderland': 'Alice%27s_Adventures_in_Wonderland',
    'beauty-and-the-beast': 'Beauty_and_the_Beast',
    cinderella: 'Cinderella',
    goldilocks: 'The_Story_of_the_Three_Bears',
    'little-mermaid': 'The_Little_Mermaid',
    'princess-kaguya': 'The_Tale_of_the_Bamboo_Cutter',
  };
  return `https://en.wikisource.org/wiki/${slugs[slug] ?? slug}`;
}
