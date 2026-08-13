/**
 * Mudança de estado que uma Scene ou Choice causa ao ser alcançada/escolhida - o lado
 * "escrita" que os `ChoiceCheck`s (lado "leitura") avaliam. Polimórfico como `Comment`
 * (`entityType`/`entityId`), sem FK de banco para `entityId`.
 *
 * - `itemGrant`/`itemTake`: usam `itemId`
 * - `triggerSet`/`triggerUnset`: usam `triggerName`
 */
export interface Effect {
  id: string
  storyId: string
  entityType: 'Scene' | 'Choice'
  entityId: string
  effectType: 'itemGrant' | 'itemTake' | 'triggerSet' | 'triggerUnset'
  itemId: string | null
  triggerName: string | null
  createdAt: Date
  updatedAt: Date
  version: number
  isDeleted: boolean // Added for conflict resolution (tombstones)
  deletedAt: Date | null // Added for conflict resolution (tombstones)
}
