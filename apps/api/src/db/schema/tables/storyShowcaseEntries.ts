import { relations } from 'drizzle-orm';
import { table, text, timestampNow } from '../columns';
import { showcaseVisibilityEnum, publicationLabelModeEnum } from '../enums';
import { stories } from './stories';
import { storyPublications } from './storyPublications';
import { users } from './users';

/**
 * Uma história que está publicada no Showcase, agora.
 *
 * Separada de `story_publications` porque o que ela guarda não é por versão: visibilidade e
 * senha valem para a história inteira, e trocar a senha não deve inventar uma versão nova.
 * A existência da linha *é* o "está publicada": despublicar apaga esta linha e todas as
 * versões na mesma transação, então uma versão órfã não é um estado alcançável.
 */
export const storyShowcaseEntries = table('story_showcase_entries', {
  storyId: text('story_id')
    .primaryKey()
    .references(() => stories.id),
  ownerUserId: text('owner_user_id')
    .notNull()
    .references(() => users.id),
  visibility: showcaseVisibilityEnum('visibility').notNull().default('public'),
  /**
   * bcrypt, `null` enquanto `visibility = 'public'`. Segredo compartilhado, não controle de
   * acesso por pessoa: serve para uma história ficar fora da listagem e para um link vazado
   * não bastar sozinho. Quem tem a senha pode repassá-la, e isso é aceito.
   */
  passwordHash: text('password_hash'),
  /** Último estilo de nome usado pelo dono, só para o app já vir marcado no estilo certo. */
  labelMode: publicationLabelModeEnum('label_mode').notNull().default('both'),
  createdAt: timestampNow('created_at'),
  /** Move a cada publicação/remoção - é dele que sai o ETag da listagem pública. */
  updatedAt: timestampNow('updated_at'),
});

export const storyShowcaseEntriesRelations = relations(storyShowcaseEntries, ({ one, many }) => ({
  story: one(stories, {
    fields: [storyShowcaseEntries.storyId],
    references: [stories.id],
  }),
  owner: one(users, {
    fields: [storyShowcaseEntries.ownerUserId],
    references: [users.id],
  }),
  publications: many(storyPublications),
}));
