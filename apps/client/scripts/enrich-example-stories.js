/*
 * Enriches only the bundled example-story catalog. Run after changing the base examples.
 * It deliberately does not touch user imports, exports, or any database content.
 */
const fs = require('fs');
const path = require('path');
const { ulid } = require('ulid');

const contentRoot = path.join(__dirname, '..', 'src', 'exampleStories', 'content');
const timestamp = '2025-01-01T00:00:00.000Z';
const entity = (data) => ({ id: ulid(), createdAt: timestamp, updatedAt: timestamp, version: 1, isDeleted: false, deletedAt: null, ...data });

const wording = {
  en: {
    tags: [['Protagonist', '#7C4DFF'], ['Magic', '#F9A825'], ['Turning point', '#00897B']],
    role: 'Narrative role', roleDescription: 'The character’s role in this retelling.',
    tone: 'Emotional tone', toneDescription: 'The prevailing mood of this scene.',
    roles: ['Protagonist', 'Supporting character', 'Antagonist'],
    tones: ['Wonder', 'Tension', 'Hope'],
    states: { new: 'New', broken: 'Broken', consumed: 'Consumed', written: 'Written', transferred: 'Transferred', resolved: 'Resolved' },
  },
  pt: {
    tags: [['Protagonista', '#7C4DFF'], ['Magia', '#F9A825'], ['Ponto de virada', '#00897B']],
    role: 'Papel narrativo', roleDescription: 'O papel do personagem nesta releitura.',
    tone: 'Tom emocional', toneDescription: 'O clima predominante desta cena.',
    roles: ['Protagonista', 'Personagem de apoio', 'Antagonista'],
    tones: ['Encantamento', 'Tensão', 'Esperança'],
    states: { new: 'Novo', broken: 'Quebrado', consumed: 'Consumido', written: 'Escrito', transferred: 'Transferido', resolved: 'Resolvido' },
  },
};

function stateFor(description, labels) {
  const normalized = description.toLocaleLowerCase();
  if (/(broken|breaks|quebrad|partiu|seat gives way)/.test(normalized)) return labels.broken;
  if (/(eaten|drunk|burned|consum|comido|bebid|queimad)/.test(normalized)) return labels.consumed;
  if (/(written|escrit)/.test(normalized)) return labels.written;
  if (/(given|left behind|carried|transfer|dado|deixad|levado)/.test(normalized)) return labels.transferred;
  if (/(fits|proved|proving|reveal|resolve|comprov|revel)/.test(normalized)) return labels.resolved;
  return labels.new;
}

for (const slug of fs.readdirSync(contentRoot)) {
  for (const language of ['en', 'pt']) {
    const file = path.join(contentRoot, slug, `${language}.json`);
    const story = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (story.exampleCatalogEnriched) continue;

    const text = wording[language];
    const storyId = story.story.id;
    const firstCharacter = story.characters[0];
    const secondCharacter = story.characters[1] ?? firstCharacter;
    const firstScene = story.scenes[0];
    const secondScene = story.scenes[1] ?? firstScene;
    const firstLocation = story.locations[0];
    const secondLocation = story.locations[1] ?? firstLocation;

    const roleField = entity({ storyId, entityType: 'Character', name: text.role, key: 'narrative_role', description: text.roleDescription, type: 'suggestion', isRequired: false, defaultValue: null, order: 0 });
    const toneField = entity({ storyId, entityType: 'Scene', name: text.tone, key: 'emotional_tone', description: text.toneDescription, type: 'suggestion', isRequired: false, defaultValue: null, order: 0 });
    const tags = text.tags.map(([name, color]) => entity({ storyId, name, color, isFavorite: false, extraNotes: null }));

    story.tags = tags;
    story.tagRelations = [
      entity({ storyId, tagId: tags[0].id, relationId: firstCharacter.id, relationType: 'Character' }),
      entity({ storyId, tagId: tags[1].id, relationId: firstScene.id, relationType: 'Scene' }),
      entity({ storyId, tagId: tags[2].id, relationId: secondScene.id, relationType: 'Scene' }),
    ];
    story.characterScenes = [
      entity({ storyId, characterId: firstCharacter.id, sceneId: firstScene.id }),
      entity({ storyId, characterId: secondCharacter.id, sceneId: secondScene.id }),
    ];
    story.storySchemaFields = [roleField, toneField];
    story.attributeValues = [
      entity({ storyId, entityType: 'Character', entityId: firstCharacter.id, fieldId: roleField.id, value: text.roles[0] }),
      entity({ storyId, entityType: 'Character', entityId: secondCharacter.id, fieldId: roleField.id, value: text.roles[1] }),
      entity({ storyId, entityType: 'Scene', entityId: firstScene.id, fieldId: toneField.id, value: text.tones[0] }),
      entity({ storyId, entityType: 'Scene', entityId: secondScene.id, fieldId: toneField.id, value: text.tones[1] }),
    ];
    story.suggestions = [
      ...text.roles.map(value => entity({ storyId, type: `custom:${roleField.id}`, value })),
      ...text.tones.map(value => entity({ storyId, type: `custom:${toneField.id}`, value })),
      ...Object.values(text.states).map(value => entity({ storyId, type: 'item_state', value })),
    ];
    story.locationRelations = firstLocation.id === secondLocation.id ? [] : [
      entity({ storyId, locationAId: firstLocation.id, locationBId: secondLocation.id, relationType: 'connected_to' }),
    ];

    story.items = (story.items ?? []).map(item => ({ ...item, initialState: text.states.new }));
    story.itemJourneys = story.itemJourneys.map(journey => ({
      ...journey,
      newState: stateFor(journey.newState, text.states),
      extraNotes: journey.extraNotes ?? journey.newState,
    }));
    story.exampleCatalogEnriched = true;
    fs.writeFileSync(file, `${JSON.stringify(story, null, 2)}\n`);
  }
}
