import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type Language = 'en' | 'pt';
type StoryDocument = Record<string, any>;

const CONTENT_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../src/exampleStories/content',
);
const FIXED_DATE = '2025-01-01T00:00:00.000Z';
const EXAMPLE_USER_ID = 'EXAMPLEUSERPLACEHOLDER0000';
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const localized = {
  en: {
    chapters: ['Opening', 'Confrontation', 'Resolution'],
    chapterSummaries: [
      'The central conflict and its participants are introduced.',
      'The consequences grow and the characters must choose how to respond.',
      'The main threads converge and reveal their consequences.',
    ],
    extraScenes: [
      'A new consequence',
      'An unexpected encounter',
      'The difficult decision',
      'Paths converge',
      'The price of change',
      'A final revelation',
      'After the turning point',
    ],
    sceneSummary: (title: string) =>
      `A concise account of this stage of ${title}, its conflict, and its effect on what follows.`,
    extraCharacters: ['The Witness', 'The Messenger', 'The Chronicler'],
    extraLocations: ['The Outer Road', 'The Crossroads', 'The Quiet Refuge'],
    extraItems: ['A Sealed Letter', 'A Guiding Token', 'A Keepsake'],
    worldRules: [
      ['Consequences endure', 'Actions leave traces that later scenes must acknowledge.'],
      ['Promises have weight', 'A freely given promise changes what its speaker may safely do.'],
      ['Places remember', 'Important locations retain signs of the events that happened there.'],
    ],
    notes: [
      ['Continuity', 'Track what each participant knows before every turning point.'],
      ['Visual motif', 'Repeat a recognizable image when the central conflict changes direction.'],
      ['Revision goal', 'Keep cause and consequence explicit between neighboring scenes.'],
    ],
    tags: ['Turning point', 'Foreshadowing', 'Conflict', 'Resolution'],
    itemStates: ['Introduced', 'Changed hands', 'Transformed'],
    relations: ['Trust', 'Shared purpose', 'Rivalry', 'Family', 'Debt', 'Protection'],
    plotNames: ['Main conflict', 'Inner change', 'Hidden consequence', 'Unused possibility'],
    plotDetails: [
      'The broad causal thread that carries the story from opening to resolution.',
      'The emotional change that appears at selected turning points.',
      'A late thread concentrated near the resolution.',
      'An intentionally empty plot used to demonstrate planning before scenes are assigned.',
    ],
    plotNotes: [
      'Introduces the thread',
      'Develops the thread',
      'Changes its direction',
      'Resolves it',
    ],
    choice: 'Continue toward',
    comments: [
      'Useful foundation; preserve this fact during revision.',
      'Check whether the transition is sufficiently clear.',
      'Resolve this continuity risk before publication.',
      'This detail should echo in a later scene.',
    ],
    schema: {
      names: [
        'Theme note',
        'Editorial analysis',
        'Narrative weight',
        'Resolved',
        'Review date',
        'Arc',
        'Motifs',
        'Reference place',
      ],
      descriptions: [
        'Short thematic label',
        'Long-form editorial observation',
        'Relative narrative importance',
        'Whether the point is resolved',
        'Planned review date',
        'Controlled arc value',
        'Several controlled motifs',
        'Related location',
      ],
      suggestionValues: ['Growth', 'Duty', 'Discovery', 'Reconciliation'],
      listValues: ['Promise', 'Threshold', 'Transformation', 'Return'],
    },
    statNames: ['Resolve', 'Insight', 'Influence', 'Agility', 'Fortune'],
    modeNames: ['Under pressure', 'Transformed'],
    modeChanges: [
      'Acts with urgency and accepts greater risks.',
      'A decisive experience changes priorities and abilities.',
    ],
  },
  pt: {
    chapters: ['Abertura', 'Confronto', 'Resolução'],
    chapterSummaries: [
      'O conflito central e seus participantes são apresentados.',
      'As consequências crescem e os personagens precisam decidir como reagir.',
      'Os fios principais convergem e revelam suas consequências.',
    ],
    extraScenes: [
      'Uma nova consequência',
      'Um encontro inesperado',
      'A decisão difícil',
      'Caminhos convergem',
      'O preço da mudança',
      'Uma revelação final',
      'Depois da virada',
    ],
    sceneSummary: (title: string) =>
      `Um relato conciso desta etapa de ${title}, seu conflito e seu efeito sobre o que acontece depois.`,
    extraCharacters: ['A Testemunha', 'O Mensageiro', 'O Cronista'],
    extraLocations: ['A Estrada Exterior', 'A Encruzilhada', 'O Refúgio Silencioso'],
    extraItems: ['Uma Carta Selada', 'Um Símbolo Guia', 'Uma Lembrança'],
    worldRules: [
      [
        'Consequências permanecem',
        'Ações deixam marcas que cenas posteriores precisam reconhecer.',
      ],
      [
        'Promessas têm peso',
        'Uma promessa feita livremente muda o que seu autor pode fazer em segurança.',
      ],
      ['Lugares recordam', 'Locais importantes preservam sinais dos acontecimentos vividos neles.'],
    ],
    notes: [
      ['Continuidade', 'Acompanhar o que cada participante sabe antes de cada ponto de virada.'],
      [
        'Motivo visual',
        'Repetir uma imagem reconhecível quando o conflito central mudar de direção.',
      ],
      [
        'Meta de revisão',
        'Manter explícita a relação de causa e consequência entre cenas vizinhas.',
      ],
    ],
    tags: ['Ponto de virada', 'Prenúncio', 'Conflito', 'Resolução'],
    itemStates: ['Apresentado', 'Mudou de mãos', 'Transformado'],
    relations: ['Confiança', 'Propósito comum', 'Rivalidade', 'Família', 'Dívida', 'Proteção'],
    plotNames: [
      'Conflito principal',
      'Mudança interior',
      'Consequência oculta',
      'Possibilidade não usada',
    ],
    plotDetails: [
      'O amplo fio causal que conduz a história da abertura à resolução.',
      'A mudança emocional que aparece em pontos de virada selecionados.',
      'Um fio tardio concentrado próximo à resolução.',
      'Uma trama intencionalmente vazia para demonstrar o planejamento antes de atribuir cenas.',
    ],
    plotNotes: ['Introduz o fio', 'Desenvolve o fio', 'Muda sua direção', 'Resolve o fio'],
    choice: 'Continuar em direção a',
    comments: [
      'Base útil; preserve este fato durante a revisão.',
      'Verifique se a transição está suficientemente clara.',
      'Resolva este risco de continuidade antes da publicação.',
      'Este detalhe deveria repercutir em uma cena posterior.',
    ],
    schema: {
      names: [
        'Nota temática',
        'Análise editorial',
        'Peso narrativo',
        'Resolvido',
        'Data de revisão',
        'Arco',
        'Motivos',
        'Local de referência',
      ],
      descriptions: [
        'Rótulo temático curto',
        'Observação editorial extensa',
        'Importância narrativa relativa',
        'Se o ponto está resolvido',
        'Data planejada para revisão',
        'Valor controlado de arco',
        'Vários motivos controlados',
        'Local relacionado',
      ],
      suggestionValues: ['Crescimento', 'Dever', 'Descoberta', 'Reconciliação'],
      listValues: ['Promessa', 'Limiar', 'Transformação', 'Retorno'],
    },
    statNames: ['Determinação', 'Percepção', 'Influência', 'Agilidade', 'Fortuna'],
    modeNames: ['Sob pressão', 'Transformado'],
    modeChanges: [
      'Age com urgência e aceita riscos maiores.',
      'Uma experiência decisiva muda prioridades e habilidades.',
    ],
  },
} as const;

function deterministicUlid(slug: string, key: string): string {
  const bytes = createHash('sha256').update(`${slug}:${key}`).digest().subarray(0, 16);
  let value = BigInt(`0x${bytes.toString('hex')}`);
  let encoded = '';
  for (let index = 0; index < 26; index += 1) {
    encoded = CROCKFORD[Number(value & 31n)] + encoded;
    value >>= 5n;
  }
  return encoded;
}

function base(id: string, storyId: string) {
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

function ensureCount<T>(source: T[], count: number, create: (index: number) => T): T[] {
  const result = source.slice(0, Math.max(source.length, count));
  while (result.length < count) result.push(create(result.length));
  return result;
}

function buildStory(slug: string, language: Language, source: StoryDocument): StoryDocument {
  const text = localized[language];
  const storyId = source.story.id as string;
  const id = (key: string) => deterministicUlid(slug, key);

  const characters = ensureCount(source.characters ?? [], 6, (index) => ({
    ...base(id(`character-${index}`), storyId),
    name: text.extraCharacters[index % text.extraCharacters.length],
    title: null,
    gender: null,
    race: null,
    subrace: null,
    description: text.sceneSummary(source.story.title),
    personality: null,
    motivation: null,
    qualities: null,
    weaknesses: null,
    biography: null,
    plannedTimeline: null,
    isFavorite: false,
    extraNotes: null,
  })).map((character, index) => ({
    ...character,
    storyId,
    description: character.description || text.sceneSummary(source.story.title),
    isFavorite: index === 0,
  }));

  const locations = ensureCount(source.locations ?? [], 5, (index) => ({
    ...base(id(`location-${index}`), storyId),
    name: text.extraLocations[index % text.extraLocations.length],
    description: text.sceneSummary(source.story.title),
    climate: null,
    culture: null,
    politics: null,
    isFavorite: false,
    extraNotes: null,
  })).map((location) => ({
    ...location,
    storyId,
    description: location.description || text.sceneSummary(source.story.title),
  }));

  const chapters = Array.from({ length: 3 }, (_, index) => {
    const old = source.chapters?.[index];
    return {
      ...base(old?.id ?? id(`chapter-${index}`), storyId),
      ...old,
      storyId,
      name: index === 0 && old?.name ? old.name : text.chapters[index],
      index: index + 1,
      summary: text.chapterSummaries[index],
      isFavorite: false,
      extraNotes: old?.extraNotes ?? null,
    };
  });

  const scenes = ensureCount(source.scenes ?? [], 12, (index) => ({
    ...base(id(`scene-${index}`), storyId),
    name: text.extraScenes[(index - (source.scenes?.length ?? 0)) % text.extraScenes.length],
    summary: null,
    extraNotes: null,
  })).map((scene, index) => {
    const chapterIndex = Math.floor(index / 4);
    const durationUnits = ['minutes', 'hours', 'days', 'minutes', 'years'] as const;
    const gapUnits = ['minutes', 'hours', 'days', 'minutes'] as const;
    return {
      ...base(scene.id, storyId),
      ...scene,
      storyId,
      chapterId: chapters[chapterIndex].id,
      locationId: locations[index % locations.length].id,
      name: scene.name || text.extraScenes[index % text.extraScenes.length],
      index: (index % 4) + 1,
      summary: scene.summary || text.sceneSummary(source.story.title),
      gap: index === 0 ? 0 : index % 7 === 0 ? -2 : [15, 2, 1, 30][index % 4],
      gapType: gapUnits[index % gapUnits.length],
      duration: [10, 2, 1, 45, 1][index % 5],
      durationType: durationUnits[index % durationUnits.length],
      isStart: index === 0,
      isFinish: source.story.type === 'branching' ? index >= 10 : index === 11,
      isFavorite: index === 0,
      extraNotes: scene.extraNotes ?? null,
    };
  });

  const items = ensureCount(source.items ?? [], 3, (index) => ({
    ...base(id(`item-${index}`), storyId),
    characterOwnerId: characters[index % characters.length].id,
    name: text.extraItems[index % text.extraItems.length],
    category: language === 'pt' ? 'Objeto narrativo' : 'Narrative object',
    description: text.sceneSummary(source.story.title),
    initialState: text.itemStates[0],
    isFavorite: false,
    extraNotes: null,
  })).map((item, index) => ({
    ...item,
    storyId,
    characterOwnerId: characters[index % characters.length].id,
    description: item.description || text.sceneSummary(source.story.title),
    initialState: item.initialState || text.itemStates[0],
  }));

  const worldRules = ensureCount(source.worldRules ?? [], 3, (index) => ({
    ...base(id(`world-rule-${index}`), storyId),
    title: text.worldRules[index][0],
    description: text.worldRules[index][1],
    isFavorite: false,
    extraNotes: null,
  })).map((rule, index) => ({
    ...rule,
    storyId,
    description: rule.description || text.worldRules[index % text.worldRules.length][1],
  }));

  const notes = Array.from({ length: 3 }, (_, index) => ({
    ...base(id(`note-${index}`), storyId),
    title: text.notes[index][0],
    body: text.notes[index][1],
    isFavorite: false,
    extraNotes: null,
  }));
  const tags = Array.from({ length: 4 }, (_, index) => ({
    ...base(id(`tag-${index}`), storyId),
    name: text.tags[index],
    color: ['#7C3AED', '#0EA5E9', '#F59E0B', '#10B981'][index],
    isFavorite: false,
    extraNotes: null,
  }));

  const characterScenes: any[] = [];
  const presencePatterns = [
    [0, 1, 2, 3, 4, 5, 6, 7],
    [0, 2, 4, 6, 8, 10],
    [1, 2, 5, 8, 9],
    [3, 6, 9, 11],
    [7],
    [10, 11],
  ];
  characters.forEach((character, characterIndex) => {
    const pattern = presencePatterns[characterIndex] ?? [characterIndex % scenes.length];
    pattern.forEach((sceneIndex) =>
      characterScenes.push({
        ...base(id(`character-scene-${characterIndex}-${sceneIndex}`), storyId),
        characterId: character.id,
        sceneId: scenes[sceneIndex].id,
      }),
    );
  });

  const characterRelations = Array.from(
    { length: Math.max(6, characters.length + 2) },
    (_, index) => ({
      ...base(id(`character-relation-${index}`), storyId),
      character1Id: characters[index % characters.length].id,
      character2Id: characters[(index + (index % 2 === 0 ? 1 : 2)) % characters.length].id,
      relationType: text.relations[index % text.relations.length],
    }),
  );

  const locationRelations = [
    [0, 1, 'contains'],
    [1, 2, 'contains'],
    [2, 3, 'connected_to'],
    [3, 4, 'connected_to'],
  ].map(([a, b, relationType], index) => ({
    ...base(id(`location-relation-${index}`), storyId),
    locationAId: locations[Number(a)].id,
    locationBId: locations[Number(b)].id,
    relationType,
  }));

  const itemJourneys = items.slice(0, 3).flatMap((item, itemIndex) =>
    [itemIndex, itemIndex + 4, itemIndex + 8].map((sceneIndex, journeyIndex) => ({
      ...base(id(`item-journey-${itemIndex}-${journeyIndex}`), storyId),
      itemId: item.id,
      sceneId: scenes[sceneIndex].id,
      newCharacterOwnerId:
        journeyIndex === 2
          ? null
          : characters[(itemIndex + journeyIndex + 1) % characters.length].id,
      newState: text.itemStates[journeyIndex],
      extraNotes: null,
    })),
  );

  const noteTargets = [
    ['Character', characters[0].id],
    ['Scene', scenes[3].id],
    ['WorldRule', worldRules[0].id],
    ['Location', locations[2].id],
  ];
  const noteRelations = noteTargets.map(([relationType, relationId], index) => ({
    ...base(id(`note-relation-${index}`), storyId),
    noteId: notes[index % notes.length].id,
    relationId,
    relationType,
  }));

  const tagTargets = [
    ['Character', characters[0].id],
    ['Scene', scenes[0].id],
    ['Location', locations[0].id],
    ['Item', items[0].id],
    ['Scene', scenes[3].id],
    ['Character', characters[2].id],
    ['Location', locations[3].id],
    ['Item', items[2].id],
    ['Scene', scenes[8].id],
    ['Chapter', chapters[2].id],
  ];
  const tagRelations = tagTargets.map(([relationType, relationId], index) => ({
    ...base(id(`tag-relation-${index}`), storyId),
    tagId: tags[index % tags.length].id,
    relationId,
    relationType,
  }));

  const schemaTypes = [
    'text',
    'long_text',
    'number',
    'boolean',
    'date',
    'suggestion',
    'suggestion_list',
    'entity',
  ];
  const storySchemaFields = schemaTypes.map((type, index) => ({
    ...base(id(`schema-field-${index}`), storyId),
    entityType: 'Character',
    name: text.schema.names[index],
    key: [
      'theme_note',
      'editorial_analysis',
      'narrative_weight',
      'resolved',
      'review_date',
      'arc',
      'motifs',
      'reference_place',
    ][index],
    description: text.schema.descriptions[index],
    type,
    targetEntityType: type === 'entity' ? 'Location' : null,
    isRequired: false,
    defaultValue: null,
    order: index,
  }));
  const attributeValues = storySchemaFields.flatMap((field, fieldIndex) =>
    [0, 1].map((characterIndex) => {
      const values: Record<string, string> = {
        text: text.tags[(fieldIndex + characterIndex) % text.tags.length],
        long_text: text.comments[(fieldIndex + characterIndex) % text.comments.length],
        number: String(3 + characterIndex * 4),
        boolean: characterIndex === 0 ? 'true' : 'false',
        date: characterIndex === 0 ? '2025-03-15' : '2025-09-30',
        suggestion: text.schema.suggestionValues[characterIndex],
        suggestion_list: JSON.stringify([
          text.schema.listValues[characterIndex],
          text.schema.listValues[characterIndex + 2],
        ]),
        entity: locations[characterIndex].id,
      };
      return {
        ...base(id(`attribute-${fieldIndex}-${characterIndex}`), storyId),
        entityType: 'Character',
        entityId: characters[characterIndex].id,
        fieldId: field.id,
        value: values[field.type],
      };
    }),
  );

  const suggestionCatalogs = [
    ...text.schema.suggestionValues.map((value) => [`custom:${storySchemaFields[5].id}`, value]),
    ...text.schema.listValues.map((value) => [`custom:${storySchemaFields[6].id}`, value]),
    ['character_gender', language === 'pt' ? 'Não informado' : 'Unspecified'],
    ['character_race', language === 'pt' ? 'Humano' : 'Human'],
    ['item_category', language === 'pt' ? 'Objeto narrativo' : 'Narrative object'],
    ['item_state', text.itemStates[0]],
  ];
  const suggestions = suggestionCatalogs.map(([type, value], index) => ({
    ...base(id(`suggestion-${index}`), storyId),
    type,
    value,
  }));

  const statNames = text.statNames;
  const stats = statNames.map((name, index) => ({
    ...base(id(`stat-${index}`), storyId),
    name,
    isPrimary: true,
    order: index,
  }));
  const defaultLadder = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS'].map((label, index) => ({
    ...base(id(`stat-strength-default-${index}`), storyId),
    statId: null,
    label,
    minValue: index * 10,
  }));
  const customLadder = ['Low', 'Ready', 'Strong', 'Exceptional'].map((label, index) => ({
    ...base(id(`stat-strength-custom-${index}`), storyId),
    statId: stats[0].id,
    label: language === 'pt' ? ['Baixa', 'Pronta', 'Forte', 'Excepcional'][index] : label,
    minValue: index * 20,
  }));
  const modes = [0, 1].map((characterIndex) => ({
    ...base(id(`mode-${characterIndex}`), storyId),
    characterId: characters[characterIndex].id,
    name: text.modeNames[characterIndex],
    modeChanges: text.modeChanges[characterIndex],
    order: 1,
  }));
  const statRelations: any[] = characters.slice(0, 4).flatMap((character, characterIndex) =>
    stats.map((stat, statIndex) => ({
      ...base(id(`stat-relation-${characterIndex}-${statIndex}`), storyId),
      characterId: character.id,
      modeId: null,
      statId: stat.id,
      value: 12 + characterIndex * 11 + statIndex * 6,
    })),
  );
  modes.forEach((mode, modeIndex) => {
    stats.forEach((stat, statIndex) =>
      statRelations.push({
        ...base(id(`stat-relation-mode-${modeIndex}-${statIndex}`), storyId),
        characterId: characters[modeIndex].id,
        modeId: mode.id,
        statId: stat.id,
        value: 35 + modeIndex * 9 + statIndex * 7,
      }),
    );
  });

  let choices: any[] = [];
  let choiceCheckGroups: any[] = [];
  let choiceChecks: any[] = [];
  let plots: any[] = [];
  let plotScenes: any[] = [];
  if (source.story.type === 'branching') {
    const edges = [
      ...Array.from({ length: 10 }, (_, index) => [index, index + 1]),
      [9, 11],
      [0, 3],
      [3, 6],
      [6, 3],
      [8, 11],
      [7, 10],
    ];
    choices = edges.map(([from, to], index) => ({
      ...base(id(`choice-${index}`), storyId),
      sceneId: scenes[from].id,
      nextSceneId: scenes[to].id,
      text: `${text.choice} ${scenes[to].name}`,
    }));
    choiceCheckGroups = [0, 1, 2, 3].map((index) => ({
      ...base(id(`choice-check-group-${index}`), storyId),
      choiceId: choices[12 + index].id,
      combinator: index % 2 === 0 ? 'AND' : 'OR',
      order: index,
    }));
    const checkData = [
      { group: 0, mode: 'enable', type: 'sceneCount', sceneId: scenes[0].id, minVisits: 1 },
      { group: 0, mode: 'enable', type: 'inventory', itemId: items[0].id, itemPresence: 'has' },
      {
        group: 1,
        mode: 'block',
        type: 'trigger',
        triggerName: 'secret_closed',
        triggerState: 'set',
      },
      { group: 1, mode: 'enable', type: 'sceneCount', sceneId: scenes[3].id, minVisits: 1 },
      { group: 2, mode: 'block', type: 'inventory', itemId: items[1].id, itemPresence: 'has' },
      {
        group: 3,
        mode: 'enable',
        type: 'trigger',
        triggerName: 'path_revealed',
        triggerState: 'set',
      },
    ];
    choiceChecks = checkData.map((check, index) => ({
      ...base(id(`choice-check-${index}`), storyId),
      groupId: choiceCheckGroups[check.group].id,
      mode: check.mode,
      type: check.type,
      order: index,
      sceneId: check.sceneId ?? null,
      minVisits: check.minVisits ?? null,
      itemId: check.itemId ?? null,
      itemPresence: check.itemPresence ?? null,
      triggerName: check.triggerName ?? null,
      triggerState: check.triggerState ?? null,
    }));
  } else {
    plots = text.plotNames.map((name, index) => ({
      ...base(id(`plot-${index}`), storyId),
      name,
      details: text.plotDetails[index],
    }));
    const coverage = [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 3, 5], [8, 9, 10, 11], []];
    plotScenes = coverage.flatMap((sceneIndexes, plotIndex) =>
      sceneIndexes.map((sceneIndex, relationIndex) => ({
        ...base(id(`plot-scene-${plotIndex}-${sceneIndex}`), storyId),
        plotId: plots[plotIndex].id,
        sceneId: scenes[sceneIndex].id,
        note: text.plotNotes[Math.min(relationIndex, text.plotNotes.length - 1)],
      })),
    );
  }

  const effects = [
    ['itemGrant', items[0].id, null],
    ['itemTake', items[1].id, null],
    ['triggerSet', null, 'path_revealed'],
    ['triggerUnset', null, 'secret_closed'],
  ].map(([effectType, itemId, triggerName], index) => ({
    ...base(id(`effect-${index}`), storyId),
    entityType: 'Scene',
    entityId: scenes[index * 2].id,
    effectType,
    itemId,
    triggerName,
  }));

  const comments = [
    ['Character', characters[0].id, 'description', characters[0].description],
    ['Scene', scenes[4].id, 'summary', scenes[4].summary],
    ['Item', items[1].id, 'description', items[1].description],
    ['Location', locations[2].id, 'description', locations[2].description],
  ].map(([entityType, entityId, fieldKey, contentSnapshot], index) => ({
    ...base(id(`comment-${index}`), storyId),
    entityType,
    entityId,
    fieldId: null,
    fieldKey,
    contentSnapshot,
    excerptText: null,
    authorUserId: EXAMPLE_USER_ID,
    commentText: text.comments[index],
    criticality: [1, 3, 5, 3][index],
  }));
  const seeAlsoRelations = [
    ['Character', characters[0].id, 'Location', locations[0].id],
    ['Scene', scenes[2].id, 'Item', items[0].id],
    ['Chapter', chapters[1].id, 'WorldRule', worldRules[0].id],
    ['ItemJourney', itemJourneys[0].id, 'Character', characters[1].id],
  ].map(([entityAType, entityAId, entityBType, entityBId], index) => ({
    ...base(id(`see-also-${index}`), storyId),
    entityAType,
    entityAId,
    entityBType,
    entityBId,
  }));
  const favorites = [
    ['Story', storyId],
    ['Character', characters[0].id],
    ['Scene', scenes[0].id],
  ].map(([entityType, entityId], index) => ({
    ...base(id(`favorite-${index}`), storyId),
    entityId,
    entityType,
    userId: EXAMPLE_USER_ID,
  }));

  return {
    ...source,
    formatVersion: 6,
    serverLastOperationVersion: 0,
    story: {
      ...source.story,
      userId: EXAMPLE_USER_ID,
      statSystem: true,
      statNotation: 'letter',
      updatedAt: FIXED_DATE,
    },
    chapters,
    scenes,
    choices,
    choiceCheckGroups,
    choiceChecks,
    effects,
    characters,
    characterRelations,
    characterScenes,
    locations,
    locationRelations,
    worldRules,
    notes,
    noteRelations,
    tags,
    tagRelations,
    suggestions,
    items,
    itemJourneys,
    plots,
    plotScenes,
    storySchemaFields,
    attributeValues,
    comments,
    seeAlsoRelations,
    favorites,
    stats,
    statStrengths: [...defaultLadder, ...customLadder],
    statRelations,
    modes,
    galleryItems: [],
    galleryRelations: [],
  };
}

for (const slug of readdirSync(CONTENT_ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()) {
  for (const language of ['en', 'pt'] as const) {
    const file = join(CONTENT_ROOT, slug, `${language}.json`);
    const source = JSON.parse(readFileSync(file, 'utf8')) as StoryDocument;
    const built = buildStory(slug, language, source);
    writeFileSync(file, `${JSON.stringify(built, null, 2)}\n`, 'utf8');
  }
}

console.log('Built complete bilingual example stories.');
