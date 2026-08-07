import { AttributeType, decodeAttributeValue } from '@keres/shared';
import { NavigableEntityType } from './entityNavigation';

/**
 * Checagens estruturais de uma Story: não é busca, é achar o que um escritor dificilmente
 * notaria sozinho (um Character que nunca aparece em nenhuma Scene, uma Choice apontando pra
 * uma Scene que não existe mais, uma Scene sem caminho a partir do início). Puro de propósito,
 * como `storyGraphLayout.ts`/`locationGraphLayout.ts`: recebe listas já carregadas do banco e
 * devolve achados prontos, sem tocar em DB/React - permite testar cada checagem isolada e
 * reaproveitar o mesmo resultado tanto no resumo do dashboard quanto na tela de relatório.
 */

export type StoryAnalysisCategory = 'characters' | 'locations' | 'items' | 'tags' | 'scenes' | 'choices' | 'storySchema';
export type StoryAnalysisSeverity = 'warning' | 'error';

export interface StoryAnalysisFinding {
  /** Estável entre execuções - usado como key de lista, nunca exibido. */
  id: string;
  category: StoryAnalysisCategory;
  severity: StoryAnalysisSeverity;
  entityType: NavigableEntityType;
  /** Vazio para o achado raro de história sem nenhuma Scene inicial - ver `checkSceneReachability`. */
  entityId: string;
  entityName: string;
  messageKey: string;
  messageParams?: Record<string, string | number>;
}

export interface AnalysisEntityRef {
  id: string;
  name: string;
}

export interface AnalysisScene {
  id: string;
  name: string;
  locationId: string;
  isStart: boolean;
  isFinish: boolean;
}

export interface AnalysisChoice {
  id: string;
  sceneId: string;
  nextSceneId: string;
  text: string;
}

export interface AnalysisStorySchemaField {
  id: string;
  entityType: string;
  name: string;
  type: string;
  isRequired: boolean;
}

export interface AnalysisAttributeValue {
  fieldId: string;
  entityId: string;
  value: string | null;
}

export interface StoryAnalysisInput {
  storyType: 'linear' | 'branching';
  characters: AnalysisEntityRef[];
  characterScenes: { characterId: string }[];
  characterRelations: { charId1: string; charId2: string }[];
  locations: AnalysisEntityRef[];
  locationRelations: { locationAId: string; locationBId: string }[];
  scenes: AnalysisScene[];
  choices: AnalysisChoice[];
  items: AnalysisEntityRef[];
  itemJourneys: { itemId: string }[];
  tags: AnalysisEntityRef[];
  tagRelations: { tagId: string }[];
  chapters: AnalysisEntityRef[];
  notes: AnalysisEntityRef[];
  worldRules: AnalysisEntityRef[];
  storySchemaFields: AnalysisStorySchemaField[];
  attributeValues: AnalysisAttributeValue[];
}

export function buildStoryAnalysisReport(input: StoryAnalysisInput): StoryAnalysisFinding[] {
  return [
    ...checkCharacters(input),
    ...checkLocations(input),
    ...checkItems(input),
    ...checkTags(input),
    // Alcançabilidade e integridade de Choice só fazem sentido pra histórias ramificadas -
    // uma história linear não usa Choice, as Scenes são encadeadas por índice/capítulo.
    ...(input.storyType === 'branching' ? checkSceneReachability(input) : []),
    ...checkSceneFinishWithChoices(input),
    ...(input.storyType === 'branching' ? checkChoices(input) : []),
    ...checkStorySchema(input),
  ];
}

function checkCharacters(input: StoryAnalysisInput): StoryAnalysisFinding[] {
  const findings: StoryAnalysisFinding[] = [];
  const charactersWithScenes = new Set(input.characterScenes.map(cs => cs.characterId));
  const charactersWithRelations = new Set<string>();
  for (const relation of input.characterRelations) {
    charactersWithRelations.add(relation.charId1);
    charactersWithRelations.add(relation.charId2);
  }

  for (const character of input.characters) {
    if (!charactersWithScenes.has(character.id)) {
      findings.push(buildFinding('characters', 'warning', 'Character', character, 'analysis_character_no_scenes'));
    }
    if (!charactersWithRelations.has(character.id)) {
      findings.push(buildFinding('characters', 'warning', 'Character', character, 'analysis_character_no_relationships'));
    }
  }

  return findings;
}

function checkLocations(input: StoryAnalysisInput): StoryAnalysisFinding[] {
  const findings: StoryAnalysisFinding[] = [];
  const usedLocationIds = new Set(input.scenes.map(s => s.locationId));
  const connectedLocationIds = new Set<string>();
  for (const relation of input.locationRelations) {
    connectedLocationIds.add(relation.locationAId);
    connectedLocationIds.add(relation.locationBId);
  }

  for (const location of input.locations) {
    if (!usedLocationIds.has(location.id)) {
      findings.push(buildFinding('locations', 'warning', 'Location', location, 'analysis_location_unused'));
    }
    if (!connectedLocationIds.has(location.id)) {
      findings.push(buildFinding('locations', 'warning', 'Location', location, 'analysis_location_no_connections'));
    }
  }

  return findings;
}

function checkItems(input: StoryAnalysisInput): StoryAnalysisFinding[] {
  const usedItemIds = new Set(input.itemJourneys.map(j => j.itemId));
  return input.items
    .filter(item => !usedItemIds.has(item.id))
    .map(item => buildFinding('items', 'warning', 'Item', item, 'analysis_item_unused'));
}

function checkTags(input: StoryAnalysisInput): StoryAnalysisFinding[] {
  const usedTagIds = new Set(input.tagRelations.map(r => r.tagId));
  return input.tags
    .filter(tag => !usedTagIds.has(tag.id))
    .map(tag => buildFinding('tags', 'warning', 'Tag', tag, 'analysis_tag_unused'));
}

/**
 * Alcança a partir da(s) Scene inicial(is) seguindo as Choices, e marca quem não foi
 * alcançado. Cobre os três jeitos que o pedido descreveu a mesma coisa ("inacessível",
 * "isolada", "sem caminho a partir da inicial") com uma única passada: a mensagem muda
 * conforme a Scene tenha ou não alguma Choice tocando nela (isolada de verdade vs. só fora do
 * alcance do início).
 */
function checkSceneReachability(input: StoryAnalysisInput): StoryAnalysisFinding[] {
  const sceneIds = new Set(input.scenes.map(s => s.id));
  const outgoing = new Map<string, string[]>();
  const touchedByChoice = new Set<string>();

  for (const choice of input.choices) {
    if (!sceneIds.has(choice.sceneId) || !sceneIds.has(choice.nextSceneId)) continue;
    if (!outgoing.has(choice.sceneId)) outgoing.set(choice.sceneId, []);
    outgoing.get(choice.sceneId)!.push(choice.nextSceneId);
    touchedByChoice.add(choice.sceneId);
    touchedByChoice.add(choice.nextSceneId);
  }

  const startIds = input.scenes.filter(s => s.isStart).map(s => s.id);

  if (startIds.length === 0) {
    if (input.scenes.length === 0) return [];
    // Sem Scene inicial não dá pra dizer o que é alcançável - reportar cada Scene como
    // "inacessível" só inundaria o relatório escondendo o problema de verdade.
    return [{
      id: 'scenes:no_start_scene',
      category: 'scenes',
      severity: 'error',
      entityType: 'Scene',
      entityId: '',
      entityName: '',
      messageKey: 'analysis_no_start_scene',
    }];
  }

  const visited = new Set<string>(startIds);
  const queue = [...startIds];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of outgoing.get(current) ?? []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }

  return input.scenes
    .filter(scene => !visited.has(scene.id))
    .map(scene => buildFinding(
      'scenes',
      'error',
      'Scene',
      scene,
      touchedByChoice.has(scene.id) ? 'analysis_scene_unreachable' : 'analysis_scene_isolated'
    ));
}

/** Scene marcada como final mas que ainda tem Choice saindo dela - contradição estrutural. */
function checkSceneFinishWithChoices(input: StoryAnalysisInput): StoryAnalysisFinding[] {
  const scenesWithOutgoingChoice = new Set(input.choices.map(c => c.sceneId));
  return input.scenes
    .filter(scene => scene.isFinish && scenesWithOutgoingChoice.has(scene.id))
    .map(scene => buildFinding('scenes', 'warning', 'Scene', scene, 'analysis_scene_finish_with_choices'));
}

function checkChoices(input: StoryAnalysisInput): StoryAnalysisFinding[] {
  const sceneIds = new Set(input.scenes.map(s => s.id));
  const findings: StoryAnalysisFinding[] = [];

  for (const choice of input.choices) {
    const ref = { id: choice.id, name: choice.text || choice.id };
    if (!sceneIds.has(choice.sceneId)) {
      findings.push(buildFinding('choices', 'error', 'Choice', ref, 'analysis_choice_dangling_scene'));
    }
    if (!sceneIds.has(choice.nextSceneId)) {
      findings.push(buildFinding('choices', 'error', 'Choice', ref, 'analysis_choice_dangling_next_scene'));
    }
  }

  return findings;
}

const STORY_SCHEMA_ENTITY_TYPE_TO_NAVIGABLE: Record<string, NavigableEntityType> = {
  Character: 'Character',
  Location: 'Location',
  Item: 'Item',
  Scene: 'Scene',
  Chapter: 'Chapter',
  Note: 'Note',
  WorldRule: 'WorldRule',
};

/**
 * Atributos obrigatórios não preenchidos, e valores que não fazem sentido pro tipo declarado.
 * "Inválido" só é checado pra number/date - `decodeAttributeValue` faz boolean sempre virar um
 * valor válido (nunca detectável como inválido por design, ver `attributeValueCodec.ts`), e
 * texto livre não tem forma errada.
 */
function checkStorySchema(input: StoryAnalysisInput): StoryAnalysisFinding[] {
  const findings: StoryAnalysisFinding[] = [];

  const entitiesByType: Record<string, AnalysisEntityRef[]> = {
    Character: input.characters,
    Location: input.locations,
    Item: input.items,
    Scene: input.scenes.map(s => ({ id: s.id, name: s.name })),
    Chapter: input.chapters,
    Note: input.notes,
    WorldRule: input.worldRules,
  };

  const rawValueByFieldAndEntity = new Map<string, string | null>();
  for (const value of input.attributeValues) {
    rawValueByFieldAndEntity.set(`${value.fieldId}:${value.entityId}`, value.value);
  }

  for (const field of input.storySchemaFields) {
    const navigableType = STORY_SCHEMA_ENTITY_TYPE_TO_NAVIGABLE[field.entityType];
    const entities = entitiesByType[field.entityType];
    if (!navigableType || !entities) continue;

    for (const entity of entities) {
      const raw = rawValueByFieldAndEntity.get(`${field.id}:${entity.id}`) ?? null;
      const decoded = decodeAttributeValue(field.type as AttributeType, raw);

      if (field.isRequired && decoded === null) {
        findings.push(buildFinding(
          'storySchema', 'warning', navigableType, entity,
          'analysis_attribute_required_missing', { fieldName: field.name }
        ));
        continue;
      }

      if (!raw) continue;

      const isInvalid = field.type === AttributeType.NUMBER
        ? decoded === null
        : field.type === AttributeType.DATE
          ? Number.isNaN(Date.parse(raw))
          : false;

      if (isInvalid) {
        findings.push(buildFinding(
          'storySchema', 'warning', navigableType, entity,
          'analysis_attribute_invalid', { fieldName: field.name }
        ));
      }
    }
  }

  return findings;
}

function buildFinding(
  category: StoryAnalysisCategory,
  severity: StoryAnalysisSeverity,
  entityType: NavigableEntityType,
  entity: { id: string; name: string },
  messageKey: string,
  messageParams?: Record<string, string | number>
): StoryAnalysisFinding {
  return {
    id: `${category}:${messageKey}:${entity.id}`,
    category,
    severity,
    entityType,
    entityId: entity.id,
    entityName: entity.name,
    messageKey,
    messageParams,
  };
}
