/**
 * Condição bruta dentro de um `ChoiceCheckGroup`. Tabela única com colunas nulláveis por
 * tipo (mesmo padrão de `Comment.fieldId`/`fieldKey`) - exatamente o subconjunto de campos
 * relevante para `type` é preenchido:
 * - `sceneCount`: `sceneId` + `minVisits`
 * - `inventory`: `itemId` + `itemPresence`
 * - `trigger`: `triggerName` + `triggerState`
 *
 * `mode` decide o sentido da condição: em `block`, a condição verdadeira bloqueia a
 * choice; em `enable`, a condição verdadeira é o que a habilita.
 */
export interface ChoiceCheck {
  id: string;
  storyId: string;
  groupId: string;
  mode: 'block' | 'enable';
  type: 'sceneCount' | 'inventory' | 'trigger';
  order: number;
  sceneId: string | null;
  minVisits: number | null;
  itemId: string | null;
  itemPresence: 'has' | 'lacks' | null;
  triggerName: string | null;
  triggerState: 'set' | 'unset' | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isDeleted: boolean; // Added for conflict resolution (tombstones)
  deletedAt: Date | null; // Added for conflict resolution (tombstones)
}
