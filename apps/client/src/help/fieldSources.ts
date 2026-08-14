/** Campos visíveis que a ajuda deve explicar. Mantido separado do modelo para não expor dados internos. */
export const fieldSources: Record<string, string[]> = {
  'create-story': ['title', 'type', 'description', 'genre', 'author', 'language', 'isFavorite', 'extraNotes', 'theme'],
  characters: ['name', 'title', 'description', 'gender', 'race', 'subrace', 'personality', 'motivation', 'qualities', 'weaknesses', 'biography', 'plannedTimeline', 'isFavorite', 'extraNotes'],
  chapters: ['name', 'summary', 'order', 'isFavorite', 'extraNotes'],
  scenes: ['name', 'summary', 'chapter', 'location', 'isStart', 'isEnd', 'interval', 'duration', 'isFavorite', 'extraNotes'],
  locations: ['name', 'description', 'climate', 'culture', 'politics', 'isFavorite', 'extraNotes'],
  items: ['name', 'category', 'description', 'initialState', 'isFavorite', 'extraNotes'],
  'item-journeys': ['item', 'scene', 'newCharacterOwner', 'newState', 'extraNotes'],
  'world-rules': ['title', 'description', 'isFavorite', 'extraNotes'],
  notes: ['title', 'body', 'isFavorite', 'extraNotes'],
  tags: ['name', 'color', 'extraNotes', 'isFavorite'],
  choices: ['text', 'sourceScene', 'destinationScene', 'extraNotes'],
  'custom-attributes': ['displayName', 'type', 'required', 'defaultValue', 'order'],
};

export const visibleEntityProperties = fieldSources;
