/**
 * Grupo de condições (`ChoiceCheck`) que precisam ser satisfeitas para uma Choice ficar
 * disponível. Os checks dentro de um grupo se combinam pelo `combinator` do grupo
 * (AND = todos, OR = algum); os grupos de uma mesma Choice se combinam por AND entre si.
 */
export interface ChoiceCheckGroup {
  id: string
  storyId: string
  choiceId: string
  combinator: 'AND' | 'OR'
  order: number
  createdAt: Date
  updatedAt: Date
  version: number
  isDeleted: boolean // Added for conflict resolution (tombstones)
  deletedAt: Date | null // Added for conflict resolution (tombstones)
}
