/**
 * Reading a form post. A form that does not parse is refused as a whole; a field that is not text is refused as well.
 * Nothing read here is logged, and nothing read here is kept beyond the handler that asked for it.
 */

export const MAX_FORM_BYTES = 16 * 1024;

/** The form of a post, or undefined when the body is not a form. Oversized bodies are not read at all. */
export async function readForm(request: Request): Promise<FormData | undefined> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > MAX_FORM_BYTES) return undefined;
  try {
    return await request.formData();
  } catch {
    return undefined;
  }
}

/** A text field, trimmed when `trim` is set. A missing or file field reads as empty. */
export function textField(form: FormData, name: string, trim = false): string {
  const value = form.get(name);
  if (typeof value !== 'string') return '';
  return trim ? value.trim() : value;
}
