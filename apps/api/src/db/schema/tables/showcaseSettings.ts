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
  updatedAt: timestampNow('updated_at'),
});
