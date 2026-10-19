/** Removes a UTF-8 BOM from the start of JSON text, if present. */
export function stripUtf8Bom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}
