const COMBINING_MARKS = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g');

/**
 * "Power Type" -> "power_type". Vive em `packages/shared` (não só no client) para que a API
 * consiga re-derivar/validar a chave de forma independente do que o cliente mandou, em vez de
 * só confiar no valor recebido.
 *
 * Resultado sempre casa com `AttributeKeyRegex` (começa com letra, só [a-z0-9_]): um nome
 * começando com dígito ou vazio ganha o prefixo `f_` para nunca falhar a validação do schema.
 */
export function deriveAttributeKey(displayName: string): string {
  const base = displayName
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);

  return /^[a-z]/.test(base) ? base : `f_${base}`;
}
