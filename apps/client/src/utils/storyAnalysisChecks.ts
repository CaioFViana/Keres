import { AttributeType, decodeAttributeValue, isValidAttributeDate } from '@keres/shared';
import { NavigableEntityType } from './entityNavigation';

/**
 * Checagens estruturais de uma Story: não é busca, é achar o que um escritor dificilmente
 * notaria sozinho (um Character que nunca aparece em nenhuma Scene, uma Choice apontando pra
 * uma Scene que não existe mais, uma Scene sem caminho a partir do início). Puro de propósito,
 * como `storyGraphLayout.ts`/`locationGraphLayout.ts`: recebe listas já carregadas do banco e
 * devolve achados prontos, sem tocar em DB/React - permite testar cada checagem isolada e
 * reaproveitar o mesmo resultado tanto no resumo do dashboard quanto na tela de relatório.
 */

export type StoryAnalysisCategory =
  | 'characters'
  | 'locations'
  | 'items'
  | 'tags'
  | 'scenes'
  | 'choices'
  | 'storySchema';
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

export type ChoiceCheckCombinator = 'AND' | 'OR';
export type ChoiceCheckMode = 'block' | 'enable';
export type ChoiceCheckType = 'sceneCount' | 'inventory' | 'trigger';
export type ChoiceCheckItemPresence = 'has' | 'lacks';
export type ChoiceCheckTriggerState = 'set' | 'unset';

export interface AnalysisChoiceCheckGroup {
  id: string;
  choiceId: string;
  combinator: ChoiceCheckCombinator;
}

export interface AnalysisChoiceCheck {
  id: string;
  groupId: string;
  mode: ChoiceCheckMode;
  type: ChoiceCheckType;
  sceneId: string | null;
  minVisits: number | null;
  itemId: string | null;
  itemPresence: ChoiceCheckItemPresence | null;
  triggerName: string | null;
  triggerState: ChoiceCheckTriggerState | null;
}

export type EffectEntityType = 'Scene' | 'Choice';
export type EffectType = 'itemGrant' | 'itemTake' | 'triggerSet' | 'triggerUnset';

export interface AnalysisEffect {
  entityType: EffectEntityType;
  entityId: string;
  effectType: EffectType;
  itemId: string | null;
  triggerName: string | null;
}

export interface AnalysisStorySchemaField {
  id: string;
  entityType: string;
  name: string;
  type: string;
  targetEntityType?: string | null;
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
  choiceCheckGroups: AnalysisChoiceCheckGroup[];
  choiceChecks: AnalysisChoiceCheck[];
  effects: AnalysisEffect[];
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

export interface StoryAnalysisProgress {
  /** 0 a 1. */
  fraction: number;
}

export interface RunStoryAnalysisOptions {
  onProgress?: (progress: StoryAnalysisProgress) => void;
  signal?: AbortSignal;
}

export class StoryAnalysisCancelledError extends Error {
  constructor() {
    super('Story analysis was cancelled.');
    this.name = 'StoryAnalysisCancelledError';
  }
}

/** Devolve o controle pro event loop entre pedaços de trabalho pesado, sem depender de Worker
 *  (não dá pra ter um de verdade em RN mobile sem módulo nativo) nem de outra conexão de DB
 *  (o driver do drizzle é preso à thread principal) - ver plano da feature. */
const yieldToEventLoop = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new StoryAnalysisCancelledError();
}

/**
 * Checagens rápidas, O(entidades) - seguras de rodar toda vez que a story muda (ex.: badge do
 * dashboard). Não inclui alcançabilidade nem satisfazibilidade de Choice: essas duas percorrem o
 * grafo de Scenes/Choices em rodadas de ponto fixo e ficam caras em histórias ramificadas
 * grandes, então só rodam sob demanda via `buildStoryAnalysisReport`.
 */
export function buildCheapStoryAnalysisFindings(input: StoryAnalysisInput): StoryAnalysisFinding[] {
  return [
    ...checkCharacters(input),
    ...checkLocations(input),
    ...checkItems(input),
    ...checkTags(input),
    ...checkSceneFinishWithChoices(input),
    // Integridade de Choice é O(choices), cabe aqui mesmo sendo "só ramificada" - dangling
    // references são baratas de achar, diferente de alcançabilidade/satisfazibilidade.
    ...(input.storyType === 'branching' ? checkChoices(input) : []),
    ...checkStorySchema(input),
  ];
}

/**
 * Relatório completo: checagens rápidas + alcançabilidade/satisfazibilidade (que fazem sentido
 * só pra histórias ramificadas). A parte pesada (`checkChoiceSatisfiability`) cede o controle ao
 * event loop entre rodadas do ponto fixo e reporta progresso, então não trava a UI mesmo em
 * histórias grandes - ver plano da feature em `StoryAnalysisScreen.tsx`.
 */
export async function buildStoryAnalysisReport(
  input: StoryAnalysisInput,
  options: RunStoryAnalysisOptions = {},
): Promise<StoryAnalysisFinding[]> {
  const cheapFindings = buildCheapStoryAnalysisFindings(input);

  if (input.storyType !== 'branching') {
    options.onProgress?.({ fraction: 1 });
    return cheapFindings;
  }

  const { findings: satisfiabilityFindings, unsatisfiableChoiceIds } =
    await checkChoiceSatisfiability(input, options);
  throwIfAborted(options.signal);
  const reachabilityFindings = checkSceneReachability(input, unsatisfiableChoiceIds);
  options.onProgress?.({ fraction: 1 });

  return [...cheapFindings, ...reachabilityFindings, ...satisfiabilityFindings];
}

function checkCharacters(input: StoryAnalysisInput): StoryAnalysisFinding[] {
  const findings: StoryAnalysisFinding[] = [];
  const charactersWithScenes = new Set(input.characterScenes.map((cs) => cs.characterId));
  const charactersWithRelations = new Set<string>();
  for (const relation of input.characterRelations) {
    charactersWithRelations.add(relation.charId1);
    charactersWithRelations.add(relation.charId2);
  }

  for (const character of input.characters) {
    if (!charactersWithScenes.has(character.id)) {
      findings.push(
        buildFinding(
          'characters',
          'warning',
          'Character',
          character,
          'analysis_character_no_scenes',
        ),
      );
    }
    if (!charactersWithRelations.has(character.id)) {
      findings.push(
        buildFinding(
          'characters',
          'warning',
          'Character',
          character,
          'analysis_character_no_relationships',
        ),
      );
    }
  }

  return findings;
}

function checkLocations(input: StoryAnalysisInput): StoryAnalysisFinding[] {
  const findings: StoryAnalysisFinding[] = [];
  const usedLocationIds = new Set(input.scenes.map((s) => s.locationId));
  const connectedLocationIds = new Set<string>();
  for (const relation of input.locationRelations) {
    connectedLocationIds.add(relation.locationAId);
    connectedLocationIds.add(relation.locationBId);
  }

  for (const location of input.locations) {
    if (!usedLocationIds.has(location.id)) {
      findings.push(
        buildFinding('locations', 'warning', 'Location', location, 'analysis_location_unused'),
      );
    }
    if (!connectedLocationIds.has(location.id)) {
      findings.push(
        buildFinding(
          'locations',
          'warning',
          'Location',
          location,
          'analysis_location_no_connections',
        ),
      );
    }
  }

  return findings;
}

function checkItems(input: StoryAnalysisInput): StoryAnalysisFinding[] {
  const usedItemIds = new Set(input.itemJourneys.map((j) => j.itemId));
  return input.items
    .filter((item) => !usedItemIds.has(item.id))
    .map((item) => buildFinding('items', 'warning', 'Item', item, 'analysis_item_unused'));
}

function checkTags(input: StoryAnalysisInput): StoryAnalysisFinding[] {
  const usedTagIds = new Set(input.tagRelations.map((r) => r.tagId));
  return input.tags
    .filter((tag) => !usedTagIds.has(tag.id))
    .map((tag) => buildFinding('tags', 'warning', 'Tag', tag, 'analysis_tag_unused'));
}

/**
 * Alcança a partir da(s) Scene inicial(is) seguindo as Choices, e marca quem não foi
 * alcançado. Cobre os três jeitos que o pedido descreveu a mesma coisa ("inacessível",
 * "isolada", "sem caminho a partir da inicial") com uma única passada: a mensagem muda
 * conforme a Scene tenha ou não alguma Choice tocando nela (isolada de verdade vs. só fora do
 * alcance do início).
 */
function checkSceneReachability(
  input: StoryAnalysisInput,
  unsatisfiableChoiceIds: Set<string>,
): StoryAnalysisFinding[] {
  const sceneIds = new Set(input.scenes.map((s) => s.id));
  const outgoing = new Map<string, string[]>();
  const touchedByChoice = new Set<string>();

  for (const choice of input.choices) {
    if (!sceneIds.has(choice.sceneId) || !sceneIds.has(choice.nextSceneId)) continue;
    touchedByChoice.add(choice.sceneId);
    touchedByChoice.add(choice.nextSceneId);
    // Choice cujos checks provavelmente nunca serão satisfeitos não conta como aresta viva -
    // uma Scene só alcançável por ela deve ser reportada como inacessível também.
    if (unsatisfiableChoiceIds.has(choice.id)) continue;
    if (!outgoing.has(choice.sceneId)) outgoing.set(choice.sceneId, []);
    outgoing.get(choice.sceneId)!.push(choice.nextSceneId);
  }

  const startIds = input.scenes.filter((s) => s.isStart).map((s) => s.id);

  if (startIds.length === 0) {
    if (input.scenes.length === 0) return [];
    // Sem Scene inicial não dá pra dizer o que é alcançável - reportar cada Scene como
    // "inacessível" só inundaria o relatório escondendo o problema de verdade.
    return [
      {
        id: 'scenes:no_start_scene',
        category: 'scenes',
        severity: 'error',
        entityType: 'Scene',
        entityId: '',
        entityName: '',
        messageKey: 'analysis_no_start_scene',
      },
    ];
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
    .filter((scene) => !visited.has(scene.id))
    .map((scene) =>
      buildFinding(
        'scenes',
        'error',
        'Scene',
        scene,
        touchedByChoice.has(scene.id) ? 'analysis_scene_unreachable' : 'analysis_scene_isolated',
      ),
    );
}

/** Scene marcada como final mas que ainda tem Choice saindo dela - contradição estrutural. */
function checkSceneFinishWithChoices(input: StoryAnalysisInput): StoryAnalysisFinding[] {
  const scenesWithOutgoingChoice = new Set(input.choices.map((c) => c.sceneId));
  return input.scenes
    .filter((scene) => scene.isFinish && scenesWithOutgoingChoice.has(scene.id))
    .map((scene) =>
      buildFinding('scenes', 'warning', 'Scene', scene, 'analysis_scene_finish_with_choices'),
    );
}

/**
 * Heurística estrutural (não simula estado exaustivamente - ver plano da feature) que decide
 * se uma Choice com Checks tem alguma chance de ficar disponível algum dia. Usa o nível do BFS
 * de alcançabilidade (a partir das Scenes iniciais) como aproximação de "antes/depois" pra
 * checks de inventory/trigger, e detecção de ciclo pra sceneCount > 1 (revisitável indefinidamente,
 * então N não importa uma vez que exista o ciclo). "lacks"/"unset" são sempre satisfazíveis por
 * padrão - não rastreamos "garantido e nunca desfeito" no v1, limitação documentada no plano.
 *
 * Roda em ponto fixo: uma Choice inacessível pode tornar uma Scene inacessível, o que por sua
 * vez torna inacessível uma OUTRA Choice que exige aquela Scene (ex.: "Scene X visitada pelo
 * menos 1 vez"). Uma única passada não pega essa cascata - repete reconstruindo o grafo sem as
 * Choices já reprovadas até nenhuma rodada encontrar novidade. `unsatisfiableChoiceIds` só
 * cresce (nunca remove uma Choice já reprovada), o que garante parada em no máximo
 * `choices.length` rodadas mesmo se um check em modo `block` "melhorasse" com menos alcance.
 */
async function checkChoiceSatisfiability(
  input: StoryAnalysisInput,
  { onProgress, signal }: RunStoryAnalysisOptions,
): Promise<{
  findings: StoryAnalysisFinding[];
  unsatisfiableChoiceIds: Set<string>;
}> {
  const sceneIds = new Set(input.scenes.map((s) => s.id));
  const startIds = input.scenes.filter((s) => s.isStart).map((s) => s.id);
  const choiceById = new Map(input.choices.map((c) => [c.id, c]));

  const checksByGroup = new Map<string, AnalysisChoiceCheck[]>();
  for (const check of input.choiceChecks) {
    if (!checksByGroup.has(check.groupId)) checksByGroup.set(check.groupId, []);
    checksByGroup.get(check.groupId)!.push(check);
  }
  const groupsByChoice = new Map<string, AnalysisChoiceCheckGroup[]>();
  for (const group of input.choiceCheckGroups) {
    if (!groupsByChoice.has(group.choiceId)) groupsByChoice.set(group.choiceId, []);
    groupsByChoice.get(group.choiceId)!.push(group);
  }
  const itemGrantEffects = input.effects.filter((e) => e.effectType === 'itemGrant');
  const triggerSetEffects = input.effects.filter((e) => e.effectType === 'triggerSet');

  const unsatisfiableChoiceIds = new Set<string>();
  const maxIterations = input.choices.length + 1;
  let changed = true;
  let iterations = 0;

  while (changed && iterations <= maxIterations) {
    throwIfAborted(signal);
    changed = false;
    iterations++;

    const outgoing = new Map<string, string[]>();
    for (const choice of input.choices) {
      if (!sceneIds.has(choice.sceneId) || !sceneIds.has(choice.nextSceneId)) continue;
      if (unsatisfiableChoiceIds.has(choice.id)) continue;
      if (!outgoing.has(choice.sceneId)) outgoing.set(choice.sceneId, []);
      outgoing.get(choice.sceneId)!.push(choice.nextSceneId);
    }

    const levelByScene = new Map<string, number>();
    const queue: string[] = [];
    for (const id of startIds) {
      if (!levelByScene.has(id)) {
        levelByScene.set(id, 0);
        queue.push(id);
      }
    }
    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentLevel = levelByScene.get(current)!;
      for (const next of outgoing.get(current) ?? []) {
        if (!levelByScene.has(next)) {
          levelByScene.set(next, currentLevel + 1);
          queue.push(next);
        }
      }
    }

    function canReachSelf(sceneId: string): boolean {
      const visited = new Set<string>();
      const stack = [...(outgoing.get(sceneId) ?? [])];
      while (stack.length > 0) {
        const current = stack.pop()!;
        if (current === sceneId) return true;
        if (visited.has(current)) continue;
        visited.add(current);
        stack.push(...(outgoing.get(current) ?? []));
      }
      return false;
    }

    function effectLevel(effect: AnalysisEffect): number | undefined {
      if (effect.entityType === 'Scene') return levelByScene.get(effect.entityId);
      if (unsatisfiableChoiceIds.has(effect.entityId)) return undefined;
      const choice = choiceById.get(effect.entityId);
      return choice ? levelByScene.get(choice.sceneId) : undefined;
    }

    function isReachableBeforeOrAt(effects: AnalysisEffect[], maxLevel: number): boolean {
      return effects.some((effect) => {
        const level = effectLevel(effect);
        return level !== undefined && level <= maxLevel;
      });
    }

    function evaluateRawCondition(check: AnalysisChoiceCheck, choiceLevel: number): boolean {
      switch (check.type) {
        case 'sceneCount': {
          if (!check.sceneId) return false;
          const sceneLevel = levelByScene.get(check.sceneId);
          if (sceneLevel === undefined) return false;
          if ((check.minVisits ?? 1) <= 1) return true;
          return canReachSelf(check.sceneId);
        }
        case 'inventory': {
          if (!check.itemId) return false;
          if (check.itemPresence === 'lacks') return true;
          return isReachableBeforeOrAt(
            itemGrantEffects.filter((e) => e.itemId === check.itemId),
            choiceLevel,
          );
        }
        case 'trigger': {
          if (!check.triggerName) return false;
          if (check.triggerState === 'unset') return true;
          return isReachableBeforeOrAt(
            triggerSetEffects.filter((e) => e.triggerName === check.triggerName),
            choiceLevel,
          );
        }
        default:
          return false;
      }
    }

    for (const choice of input.choices) {
      if (unsatisfiableChoiceIds.has(choice.id)) continue;
      const groups = groupsByChoice.get(choice.id);
      if (!groups || groups.length === 0) continue;
      const choiceLevel = levelByScene.get(choice.sceneId);
      if (choiceLevel === undefined) continue; // já reportado por checkSceneReachability/checkChoices

      const satisfiable = groups.every((group) => {
        const checks = checksByGroup.get(group.id) ?? [];
        if (checks.length === 0) return true;
        const results = checks.map((check) => {
          const raw = evaluateRawCondition(check, choiceLevel);
          return check.mode === 'block' ? !raw : raw;
        });
        return group.combinator === 'OR' ? results.some(Boolean) : results.every(Boolean);
      });

      if (!satisfiable) {
        unsatisfiableChoiceIds.add(choice.id);
        changed = true;
      }
    }

    onProgress?.({ fraction: Math.min(iterations / maxIterations, 1) });
    // Cede o controle ao event loop a cada rodada - cada rodada é O(scenes + choices), então uma
    // história grande ainda faz vários yields por segundo, mantendo a UI responsiva.
    await yieldToEventLoop();
  }

  const findings = [...unsatisfiableChoiceIds].map((id) =>
    buildFinding(
      'choices',
      'warning',
      'Choice',
      { id, name: choiceById.get(id)?.text || id },
      'analysis_choice_never_satisfiable',
    ),
  );

  return { findings, unsatisfiableChoiceIds };
}

function checkChoices(input: StoryAnalysisInput): StoryAnalysisFinding[] {
  const sceneIds = new Set(input.scenes.map((s) => s.id));
  const findings: StoryAnalysisFinding[] = [];

  for (const choice of input.choices) {
    const ref = { id: choice.id, name: choice.text || choice.id };
    if (!sceneIds.has(choice.sceneId)) {
      findings.push(
        buildFinding('choices', 'error', 'Choice', ref, 'analysis_choice_dangling_scene'),
      );
    }
    if (!sceneIds.has(choice.nextSceneId)) {
      findings.push(
        buildFinding('choices', 'error', 'Choice', ref, 'analysis_choice_dangling_next_scene'),
      );
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
    Scene: input.scenes.map((s) => ({ id: s.id, name: s.name })),
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
        findings.push(
          buildFinding(
            'storySchema',
            'warning',
            navigableType,
            entity,
            'analysis_attribute_required_missing',
            { fieldName: field.name },
          ),
        );
        continue;
      }

      if (
        field.type === AttributeType.ENTITY &&
        raw !== null &&
        (!field.targetEntityType ||
          !entitiesByType[field.targetEntityType]?.some((target) => target.id === raw))
      ) {
        findings.push(
          buildFinding(
            'storySchema',
            'warning',
            navigableType,
            entity,
            'analysis_attribute_entity_missing',
            { fieldName: field.name },
          ),
        );
        continue;
      }

      if (!raw) continue;

      const isInvalid =
        field.type === AttributeType.NUMBER
          ? decoded === null
          : field.type === AttributeType.DATE
            ? // `Date.parse` continua como segunda chance de propósito: só o formato canônico
              // (`attributeDateValue.ts`) é aceito de primeira, mas valores de texto livre
              // gravados antes do date picker existir não devem virar warning todos de uma vez.
              !isValidAttributeDate(raw) && Number.isNaN(Date.parse(raw))
            : false;

      if (isInvalid) {
        findings.push(
          buildFinding(
            'storySchema',
            'warning',
            navigableType,
            entity,
            'analysis_attribute_invalid',
            { fieldName: field.name },
          ),
        );
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
  messageParams?: Record<string, string | number>,
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
