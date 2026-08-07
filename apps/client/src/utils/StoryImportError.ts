/**
 * Erro de importação de história com causa que o usuário consegue entender e agir.
 *
 * Em arquivo próprio porque tanto `storyTransfer.ts` (leitura de `.json`) quanto
 * `storyMediaBundle.ts` (leitura de `.zip`) precisam lançá-lo, e nenhum dos dois deveria
 * depender do outro só por causa deste tipo.
 */
export class StoryImportError extends Error {
  readonly reason: 'unreadable' | 'invalid_format' | 'future_format_version';

  constructor(reason: 'unreadable' | 'invalid_format' | 'future_format_version', message: string) {
    super(message);
    this.name = 'StoryImportError';
    this.reason = reason;
  }
}
