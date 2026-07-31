const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/**
 * Volta datas que viraram string (`JSON.parse`, ou o import estático de um `.json` empacotado)
 * para `Date`.
 *
 * Os schemas de exportação de história (`FullStoryExportSchema` e afins) usam `z.date()`, que
 * rejeita string - sem isto, reimportar um `.json`/`.zip` exportado por este mesmo app, ou
 * instalar uma história de exemplo empacotada, falharia na validação antes mesmo de tentar
 * gravar qualquer coisa no banco, porque `JSON.stringify` sempre serializa `Date` como string
 * ISO e nada volta a converter de propósito.
 */
export function reviveDates<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(reviveDates) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(value)) {
      result[key] = reviveDates(entryValue);
    }
    return result as T;
  }
  if (typeof value === 'string' && ISO_DATE_PATTERN.test(value)) {
    return new Date(value) as unknown as T;
  }
  return value;
}
