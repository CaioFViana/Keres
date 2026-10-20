import type { Lang } from './http';

/**
 * Which language a page is in. The upload page follows the language the Keres server stored with the sending (the
 * app's own language). Anything else - an invalid link, the reviewer pages - follows the browser's Accept-Language.
 * English is the default. Only English and Portuguese exist; any other tag is treated as absent.
 */

/** `pt-BR` and `pt_BR` are Portuguese; `en-GB` is English; anything else is not one of ours. */
export function langOfTag(tag: string): Lang | undefined {
  const base = tag.trim().toLowerCase().split(/[-_]/)[0];
  if (base === 'pt') return 'pt';
  if (base === 'en') return 'en';
  return undefined;
}

/** The first language of an Accept-Language header we have, highest quality first. */
export function acceptedLang(header: string | null): Lang | undefined {
  if (!header) return undefined;
  const ranked = header
    .split(',')
    .map((entry, index) => {
      const [tag = '', ...params] = entry.split(';');
      const quality = params.map((param) => param.trim()).find((param) => param.startsWith('q='));
      const q = quality ? Number(quality.slice(2)) : 1;
      return { tag, index, q: Number.isNaN(q) ? 0 : q };
    })
    .sort((a, b) => b.q - a.q || a.index - b.index);
  for (const entry of ranked) {
    const lang = langOfTag(entry.tag);
    if (lang && entry.q > 0) return lang;
  }
  return undefined;
}

/** The page's language: the stored one when the caller has it, else the browser's, else English. */
export function pageLanguage(stored: string | undefined, acceptLanguage: string | null): Lang {
  return (
    (stored !== undefined ? langOfTag(stored) : undefined) ?? acceptedLang(acceptLanguage) ?? 'en'
  );
}
