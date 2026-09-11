type BuilderContext = {
  slug: string;
  language: 'en' | 'pt';
  source: Record<string, any>;
  text: any;
  showcase: any;
  storyId: string;
  id: (key: string) => string;
  base: (id: string, storyId: string) => Record<string, any>;
  characters: any[];
  locations: any[];
};

export function buildExampleStoryMetadata(context: BuilderContext) {
  const { slug, language, source, text, showcase, storyId, id, base, characters, locations } =
    context;
  const schemaTypes = [
    'text',
    'long_text',
    'number',
    'boolean',
    'date',
    ...(slug === 'cinderella' ? ['story_date'] : []),
    'suggestion',
    'suggestion_list',
    'entity',
  ];
  const definitions: Record<string, { name: string; key: string; description: string }> = {
    text: {
      name: text.schema.names[0],
      key: 'theme_note',
      description: text.schema.descriptions[0],
    },
    long_text: {
      name: text.schema.names[1],
      key: 'editorial_analysis',
      description: text.schema.descriptions[1],
    },
    number: {
      name: text.schema.names[2],
      key: 'narrative_weight',
      description: text.schema.descriptions[2],
    },
    boolean: {
      name: text.schema.names[3],
      key: 'resolved',
      description: text.schema.descriptions[3],
    },
    date: {
      name: text.schema.names[4],
      key: 'review_date',
      description: text.schema.descriptions[4],
    },
    story_date: {
      name: showcase.storyDateName,
      key: 'date_of_destiny',
      description: showcase.storyDateDescription,
    },
    suggestion: {
      name: text.schema.names[5],
      key: 'arc',
      description: text.schema.descriptions[5],
    },
    suggestion_list: {
      name: text.schema.names[6],
      key: 'motifs',
      description: text.schema.descriptions[6],
    },
    entity: {
      name: text.schema.names[7],
      key: 'reference_place',
      description: text.schema.descriptions[7],
    },
  };
  const storySchemaFields: any[] = schemaTypes.map((type, index) => ({
    ...base(id(`schema-field-${index}`), storyId),
    entityType: 'Character',
    ...definitions[type],
    type,
    targetEntityType: type === 'entity' ? 'Location' : null,
    isRequired: false,
    defaultValue: null,
    order: index,
  }));
  const attributeValues = storySchemaFields.flatMap((field, fieldIndex) =>
    [0, 1].map((characterIndex) => {
      const values: Record<string, string> = {
        text: source.tags?.[(fieldIndex + characterIndex) % 4]?.name ?? '',
        long_text: text.comments[(fieldIndex + characterIndex) % text.comments.length],
        number: String(3 + characterIndex * 4),
        boolean: characterIndex === 0 ? 'true' : 'false',
        date: characterIndex === 0 ? '2025-03-15' : '2025-09-30',
        story_date: characterIndex === 0 ? '18' : '79',
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
  const fieldFor = (type: string) => {
    const field = storySchemaFields.find((candidate) => candidate.type === type);
    if (!field) throw new Error(`${slug}: missing ${type} example field.`);
    return field;
  };
  const suggestionCatalogs = [
    ...text.schema.suggestionValues.map((value: string) => [
      `custom:${fieldFor('suggestion').id}`,
      value,
    ]),
    ...text.schema.listValues.map((value: string) => [
      `custom:${fieldFor('suggestion_list').id}`,
      value,
    ]),
    ['character_gender', language === 'pt' ? 'Não informado' : 'Unspecified'],
    ['character_race', language === 'pt' ? 'Humano' : 'Human'],
    ['item_category', ''],
    ['item_state', ''],
  ];
  const suggestions = suggestionCatalogs.map(([type, value], index) => ({
    ...base(id(`suggestion-${index}`), storyId),
    type,
    value,
  }));
  const stats = text.statNames.map((name: string, index: number) => ({
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
  const modes: any[] = [0, 1].map((characterIndex) => ({
    ...base(id(`mode-${characterIndex}`), storyId),
    characterId: characters[characterIndex].id,
    name: text.modeNames[characterIndex],
    modeChanges: text.modeChanges[characterIndex],
    order: 1,
  }));
  const statRelations: any[] = characters.slice(0, 4).flatMap((character, characterIndex) =>
    stats.map((stat: any, statIndex: number) => ({
      ...base(id(`stat-relation-${characterIndex}-${statIndex}`), storyId),
      characterId: character.id,
      modeId: null,
      statId: stat.id,
      value: 12 + characterIndex * 11 + statIndex * 6,
    })),
  );
  modes.forEach((mode, modeIndex) => {
    stats.forEach((stat: any, statIndex: number) =>
      statRelations.push({
        ...base(id(`stat-relation-mode-${modeIndex}-${statIndex}`), storyId),
        characterId: characters[modeIndex].id,
        modeId: mode.id,
        statId: stat.id,
        value: 35 + modeIndex * 9 + statIndex * 7,
      }),
    );
  });
  return {
    storySchemaFields,
    attributeValues,
    suggestions,
    stats,
    defaultLadder,
    customLadder,
    modes,
    statRelations,
  };
}
