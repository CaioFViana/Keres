import { CURRENT_STORY_FORMAT_VERSION } from './StoryExportVersion';

/**
 * Um export com `formatVersion` maior que o suportado por este app - a pessoa importando
 * está numa versão do Keres mais antiga que quem exportou.
 */
export class StoryExportVersionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoryExportVersionError';
  }
}

type StoryExportMigration = {
  fromVersion: number;
  migrate: (data: any) => any;
};

// Nenhuma migração ainda foi necessária - o formato nunca mudou de forma incompatível desde
// que o versionamento foi introduzido. O registro existe pronto para quando isso acontecer.
const migrations: StoryExportMigration[] = [];

/**
 * Normaliza um export bruto (JSON já parseado, ainda não validado pelo `FullStoryExportSchema`)
 * para o formato atual, rodando qualquer migração pendente.
 *
 * Exports de antes deste campo existir não têm `formatVersion` - tratados como versão 0.
 * Deve rodar antes de `FullStoryExportSchema.parse()`, tanto no client quanto na API.
 */
export function migrateStoryExport(raw: any): any {
  const version = typeof raw?.formatVersion === 'number' ? raw.formatVersion : 0;

  if (version > CURRENT_STORY_FORMAT_VERSION) {
    throw new StoryExportVersionError(
      `This story export was created by a newer version of Keres (format ${version}) than this app supports (format ${CURRENT_STORY_FORMAT_VERSION}).`
    );
  }

  let data = raw;
  for (const migration of migrations
    .filter((m) => m.fromVersion >= version)
    .sort((a, b) => a.fromVersion - b.fromVersion)) {
    data = migration.migrate(data);
  }

  return { ...data, formatVersion: CURRENT_STORY_FORMAT_VERSION };
}
