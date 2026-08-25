/**
 * Campos de uma história que só o dono altera.
 *
 * A regra existe dos dois lados: o cliente recusa a edição antes de gravar no log de operações
 * (senão a mudança ficaria presa, sendo rejeitada em todo push), e o servidor recusa de novo ao
 * receber a sincronização. Duas listas escritas à mão divergiram - o cliente tinha três campos e
 * o servidor cinco - e ninguém notou, porque a diferença só aparece quando um colaborador tenta
 * mudar exatamente o campo que faltava numa das listas.
 */
export const STORY_OWNER_ONLY_FIELDS = [
  'id',
  'userId',
  'type',
  'favoriteBehavior',
  'allowReaderComments',
] as const;

export type StoryOwnerOnlyField = (typeof STORY_OWNER_ONLY_FIELDS)[number];

/** Os campos de uma alteração que só o dono poderia fazer. Vazio = a alteração é permitida. */
export function ownerOnlyFieldsIn(changes: Record<string, unknown> | undefined | null): string[] {
  if (!changes) return [];
  return STORY_OWNER_ONLY_FIELDS.filter((field) => changes[field] !== undefined);
}
