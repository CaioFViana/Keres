import { boolean, table, text, timestampNow } from '../columns';

/**
 * Configuração global do Showcase. Tabela de uma linha só, mesmo padrão de
 * `registration_settings`: `id` é sempre o literal 'singleton', e `ShowcaseSettingsService`
 * cria a linha sob demanda na primeira leitura - nenhuma migração precisa inserir dados.
 *
 * Desligado por padrão de propósito: subir a API não pode, sozinho, colocar um site público no
 * ar. Quem hospeda decide se esse servidor tem cara pública ou não.
 */
export const SHOWCASE_SETTINGS_SINGLETON_ID = 'singleton';

export const showcaseSettings = table('showcase_settings', {
  id: text('id').primaryKey(),
  isShowcaseEnabled: boolean('is_showcase_enabled').notNull().default(false),
  /** O cliente Expo hospedado em `/`; desligado, a raiz vira a landing mínima do servidor. */
  isHostedClientEnabled: boolean('is_hosted_client_enabled').notNull().default(true),
  updatedAt: timestampNow('updated_at'),
});
