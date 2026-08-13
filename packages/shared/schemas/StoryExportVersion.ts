/**
 * Versão do formato de exportação de história (`FullStoryExportType`), independente do
 * número de versão do app (client/api/package.json não são uma única fonte de verdade hoje).
 *
 * Só sobe manualmente quando uma release oficial muda o formato do pacote exportado -
 * não a cada commit/build.
 */
export const CURRENT_STORY_FORMAT_VERSION = 4;
