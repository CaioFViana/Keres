import * as Print from 'expo-print';
import type { CompiledManuscript, CompiledSpan } from './manuscriptCompiler';

export type ManuscriptHtmlLabels = {
  /** Name-based cross-reference, e.g. "See" - the PDF renderer reports no page mapping. */
  goToScene: string;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function spansToHtml(spans: CompiledSpan[]): string {
  return spans
    .map((span) => {
      const text = escapeHtml(span.text).replace(/\n/g, '<br />');
      const emphasized =
        span.bold && span.italic
          ? `<strong><em>${text}</em></strong>`
          : span.bold
            ? `<strong>${text}</strong>`
            : span.italic
              ? `<em>${text}</em>`
              : text;
      const underlined = span.underline ? `<u>${emphasized}</u>` : emphasized;
      return span.strikethrough ? `<s>${underlined}</s>` : underlined;
    })
    .join('');
}

const BODY_HEADING_TAG = { 1: 'h4', 2: 'h5', 3: 'h6' } as const;

/**
 * The compiled manuscript as a self-contained print document. Chapters break pages;
 * choices link to their target scene's anchor by name. Page counters ride on print CSS
 * where the platform renderer honors them - unlike the DOCX, the PDF never promises
 * real "page X" cross-references because the print pipeline reports no layout mapping.
 */
export function buildManuscriptHtml(
  manuscript: CompiledManuscript,
  labels: ManuscriptHtmlLabels,
): string {
  const parts: string[] = [];
  for (const block of manuscript.blocks) {
    switch (block.kind) {
      case 'title':
        parts.push(`<h1 class="title">${escapeHtml(block.text)}</h1>`);
        break;
      case 'subtitle':
        parts.push(`<p class="subtitle">${escapeHtml(block.text)}</p>`);
        break;
      case 'chapter':
        parts.push(
          `<h2 class="chapter">${escapeHtml(block.number === null ? block.name : `${block.number}. ${block.name}`)}</h2>`,
        );
        break;
      case 'loose-heading':
        parts.push(`<h2 class="chapter loose">${escapeHtml(block.label)}</h2>`);
        break;
      case 'scene-heading':
        parts.push(
          `<h3 class="scene" id="${block.bookmarkId ?? ''}">${escapeHtml(`${block.number}. ${block.name}`)}</h3>`,
        );
        break;
      case 'body-heading': {
        const tag = BODY_HEADING_TAG[block.level];
        parts.push(`<${tag}>${spansToHtml(block.spans)}</${tag}>`);
        break;
      }
      case 'paragraph':
        parts.push(`<p>${spansToHtml(block.spans)}</p>`);
        break;
      case 'choice': {
        const lead = `• ${escapeHtml(block.text)}`;
        if (block.targetBookmarkId && block.targetSceneName) {
          parts.push(
            `<p class="choice">${lead} — ${escapeHtml(labels.goToScene)} <a href="#${block.targetBookmarkId}">${escapeHtml(block.targetSceneName)}</a></p>`,
          );
        } else if (block.targetSceneName) {
          parts.push(`<p class="choice">${lead} — ${escapeHtml(block.targetSceneName)}</p>`);
        } else {
          parts.push(`<p class="choice">${lead}</p>`);
        }
        break;
      }
    }
  }
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(manuscript.title)}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; line-height: 1.6; color: #111; max-width: 42rem; margin: 0 auto; padding: 1rem; }
  .title { text-align: center; font-size: 2rem; margin: 2rem 0 0.5rem; }
  .subtitle { text-align: center; font-style: italic; color: #555; margin: 0 0 3rem; }
  .chapter { font-size: 1.5rem; margin: 2.5rem 0 1rem; page-break-before: always; }
  h1.title + .chapter, .subtitle + .chapter { page-break-before: avoid; }
  .scene { font-size: 1.1rem; color: #444; margin: 2rem 0 0.75rem; }
  p { text-indent: 2em; margin: 0 0 0.6rem; }
  p.choice, .subtitle { text-indent: 0; }
  .choice { margin-left: 1rem; }
  a { color: #1a56db; }
  @page { margin: 2cm; @bottom-center { content: counter(page); } }
</style>
</head>
<body>
${parts.join('\n')}
</body>
</html>`;
}

/** Renders the HTML to a PDF file. Device-only: the print pipeline has no test double. */
export function printManuscriptPdf(html: string): Promise<{ uri: string }> {
  return Print.printToFileAsync({ html });
}
