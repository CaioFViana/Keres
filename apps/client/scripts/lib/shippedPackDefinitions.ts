/**
 * The packs Keres ships with, as definitions rather than as JSON.
 *
 * The `.json` files under `src/shippedPacks/content/` are generated from this by
 * `scripts/build-shipped-packs.ts`. Writing them by hand would mean keeping fifteen fields, four
 * suggestion catalogues and two languages in agreement across six files - the first careless edit
 * would give the Portuguese pack a field the English one lacks, and nothing would catch it.
 *
 * Every id is derived, not random, so regenerating produces byte-identical files and installing a
 * shipped pack twice updates the same row instead of piling up copies. See `packId`.
 */

export type PackLanguage = 'en' | 'pt';

/** A string that exists in both languages. Every visible word in a shipped pack is one of these. */
export type Bilingual = Record<PackLanguage, string>;

export interface FieldDefinition {
  /** Stable across languages: it is the column key, not a label. */
  key: string;
  entityType: 'Character' | 'Location' | 'Item' | 'Scene' | 'Chapter' | 'Note' | 'WorldRule';
  name: Bilingual;
  description?: Bilingual;
  type:
    | 'text'
    | 'long_text'
    | 'number'
    | 'boolean'
    | 'date'
    | 'suggestion'
    | 'suggestion_list'
    | 'entity';
  targetEntityType?: 'Character' | 'Location' | 'Item' | 'Scene' | 'Chapter' | 'Note' | 'WorldRule';
  /**
   * The catalogue offered for a suggestion field.
   *
   * Curated, never harvested: these are closed vocabularies of a craft - the nine shot types have
   * been the nine shot types for a century - and a pack that shipped with an open list would be
   * offering an opinion about what belongs in it.
   */
  options?: Bilingual[];
}

export interface StatDefinition {
  name: Bilingual;
}

export interface LadderRung {
  label: Bilingual;
  minValue: number;
}

export interface ShippedPackDefinition {
  slug: string;
  /** Three uppercase letters, part of every id this pack produces. Must be unique. */
  code: string;
  name: Bilingual;
  description: Bilingual;
  fields: FieldDefinition[];
  stats: StatDefinition[];
  /** The default ladder, shared by every axis that does not define one of its own. */
  ladder: LadderRung[];
  statSystem: boolean;
  statNotation: 'letter' | 'number';
}

export const SHIPPED_PACKS: ShippedPackDefinition[] = [
  {
    slug: 'tabletop-stats',
    code: 'TBL',
    name: { en: 'Tabletop stats', pt: 'Status de mesa' },
    description: {
      en: 'Six ability scores and a ladder to read them by. The only shipped pack that turns the stat system on.',
      pt: 'Seis atributos e uma escala para lê-los. O único pacote de fábrica que liga o sistema de status.',
    },
    fields: [],
    stats: [
      { name: { en: 'Strength', pt: 'Força' } },
      { name: { en: 'Dexterity', pt: 'Destreza' } },
      { name: { en: 'Constitution', pt: 'Constituição' } },
      { name: { en: 'Intelligence', pt: 'Inteligência' } },
      { name: { en: 'Wisdom', pt: 'Sabedoria' } },
      { name: { en: 'Charisma', pt: 'Carisma' } },
    ],
    ladder: [
      { label: { en: 'Feeble', pt: 'Frágil' }, minValue: 0 },
      { label: { en: 'Poor', pt: 'Fraco' }, minValue: 20 },
      { label: { en: 'Average', pt: 'Médio' }, minValue: 40 },
      { label: { en: 'Good', pt: 'Bom' }, minValue: 60 },
      { label: { en: 'Great', pt: 'Ótimo' }, minValue: 80 },
      { label: { en: 'Legendary', pt: 'Lendário' }, minValue: 95 },
    ],
    statSystem: true,
    statNotation: 'number',
  },
  {
    slug: 'novel-craft',
    code: 'NVL',
    name: { en: 'Novel craft', pt: 'Ofício do romance' },
    description: {
      en: 'Scene and character fields from one school of novel craft, as an opt-in rather than as part of every story.',
      pt: 'Campos de cena e de personagem de uma escola do ofício do romance, como opção e não como parte de toda história.',
    },
    fields: [
      {
        key: 'pov_character',
        entityType: 'Scene',
        name: { en: 'Point of view', pt: 'Ponto de vista' },
        description: {
          en: 'Whose head the reader is inside for this scene.',
          pt: 'Em que cabeça o leitor está durante esta cena.',
        },
        type: 'entity',
        targetEntityType: 'Character',
      },
      {
        key: 'narrative_person',
        entityType: 'Scene',
        name: { en: 'Narrative person', pt: 'Pessoa narrativa' },
        type: 'suggestion',
        options: [
          { en: 'First person', pt: 'Primeira pessoa' },
          { en: 'Third limited', pt: 'Terceira limitada' },
          { en: 'Third omniscient', pt: 'Terceira onisciente' },
          { en: 'Second person', pt: 'Segunda pessoa' },
        ],
      },
      {
        key: 'goal',
        entityType: 'Scene',
        name: { en: 'Goal', pt: 'Objetivo' },
        description: {
          en: 'What the point-of-view character is trying to get here.',
          pt: 'O que o personagem do ponto de vista tenta conseguir aqui.',
        },
        type: 'text',
      },
      {
        key: 'conflict',
        entityType: 'Scene',
        name: { en: 'Conflict', pt: 'Conflito' },
        description: {
          en: 'What stands between them and it.',
          pt: 'O que está entre ele e isso.',
        },
        type: 'text',
      },
      {
        key: 'outcome',
        entityType: 'Scene',
        name: { en: 'Outcome', pt: 'Desfecho' },
        type: 'suggestion',
        options: [
          { en: 'Yes', pt: 'Sim' },
          { en: 'Yes, but', pt: 'Sim, mas' },
          { en: 'No', pt: 'Não' },
          { en: 'No, and', pt: 'Não, e' },
        ],
      },
      {
        key: 'value_shift',
        entityType: 'Scene',
        name: { en: 'Value shift', pt: 'Virada de valor' },
        description: {
          en: 'What changed by the end - safety to danger, trust to doubt.',
          pt: 'O que mudou até o fim - segurança para perigo, confiança para dúvida.',
        },
        type: 'text',
      },
      {
        key: 'want',
        entityType: 'Character',
        name: { en: 'Want', pt: 'Quer' },
        description: {
          en: 'What they say they are after.',
          pt: 'O que ele diz que busca.',
        },
        type: 'text',
      },
      {
        key: 'need',
        entityType: 'Character',
        name: { en: 'Need', pt: 'Precisa' },
        description: {
          en: 'What would actually help them. The distance from Want is the arc.',
          pt: 'O que de fato o ajudaria. A distância para o Quer é o arco.',
        },
        type: 'text',
      },
      {
        key: 'wound',
        entityType: 'Character',
        name: { en: 'Wound', pt: 'Ferida' },
        description: {
          en: 'What happened before the story that made them this way.',
          pt: 'O que aconteceu antes da história e o deixou assim.',
        },
        type: 'long_text',
      },
      {
        key: 'arc',
        entityType: 'Character',
        name: { en: 'Arc', pt: 'Arco' },
        type: 'suggestion',
        options: [
          { en: 'Positive', pt: 'Positivo' },
          { en: 'Flat', pt: 'Plano' },
          { en: 'Negative', pt: 'Negativo' },
          { en: 'Corruption', pt: 'Corrupção' },
          { en: 'Disillusionment', pt: 'Desilusão' },
        ],
      },
    ],
    stats: [],
    ladder: [],
    statSystem: false,
    statNotation: 'letter',
  },
  {
    slug: 'comic',
    code: 'CMC',
    name: { en: 'Comic and graphic novel', pt: 'Quadrinhos e graphic novel' },
    description: {
      en: 'Pages, panels and the language of shots - a story planned for artwork rather than for prose.',
      pt: 'Páginas, quadros e a linguagem dos enquadramentos - uma história planejada para arte, não para prosa.',
    },
    fields: [
      {
        key: 'page_count',
        entityType: 'Chapter',
        name: { en: 'Page count', pt: 'Número de páginas' },
        type: 'number',
      },
      {
        key: 'panel_count',
        entityType: 'Scene',
        name: { en: 'Panel count', pt: 'Número de quadros' },
        type: 'number',
      },
      {
        key: 'shot_type',
        entityType: 'Scene',
        name: { en: 'Shot type', pt: 'Enquadramento' },
        type: 'suggestion',
        options: [
          { en: 'Establishing', pt: 'Estabelecimento' },
          { en: 'Wide', pt: 'Aberto' },
          { en: 'Medium', pt: 'Médio' },
          { en: 'Close-up', pt: 'Close' },
          { en: 'Extreme close-up', pt: 'Close extremo' },
          { en: 'Over the shoulder', pt: 'Sobre o ombro' },
          { en: 'Point of view', pt: 'Ponto de vista' },
          { en: "Bird's eye", pt: 'Plongée' },
          { en: "Worm's eye", pt: 'Contra-plongée' },
        ],
      },
      {
        key: 'art_notes',
        entityType: 'Scene',
        name: { en: 'Art notes', pt: 'Notas de arte' },
        description: {
          en: 'For whoever draws it: staging, mood, what must be visible.',
          pt: 'Para quem desenha: encenação, clima, o que precisa estar visível.',
        },
        type: 'long_text',
      },
      {
        key: 'letterer_notes',
        entityType: 'Scene',
        name: { en: 'Letterer notes', pt: 'Notas de letreiramento' },
        description: {
          en: 'Balloon order, sound effects, anything the words have to do on the page.',
          pt: 'Ordem dos balões, onomatopeias, o que as palavras precisam fazer na página.',
        },
        type: 'long_text',
      },
    ],
    stats: [],
    ladder: [],
    statSystem: false,
    statNotation: 'letter',
  },
];

/**
 * Ids derived from what they identify, never random.
 *
 * A shipped pack is installed by the same path a downloaded one takes (`importRemotePack`), which
 * keys on the id: a stable id makes installing twice an update in place, and makes regenerating the
 * content files produce no diff. The shape satisfies `UlidSchema` - 26 characters of `[0-9A-Z]` -
 * without being a real ULID, because there is no instant here worth encoding.
 */
export function derivedId(
  code: string,
  language: PackLanguage,
  kind: 'P' | 'F' | 'S' | 'T' | 'L',
  index = 0,
): string {
  const suffix = String(index).padStart(3, '0');
  return `KRSPK${code}${language.toUpperCase()}${kind}${suffix}`.padEnd(26, '0');
}

/** The pack's own id, the one the packs table is keyed by. */
export function packId(code: string, language: PackLanguage): string {
  return derivedId(code, language, 'P');
}
