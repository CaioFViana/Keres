import {
  sceneHeadingLabel,
  manuscriptTocEntries,
  type CompiledManuscript,
  type CompiledSpan,
  type ManuscriptRenderOptions,
} from './manuscriptCompiler';
import { bytesToBase64 } from '../../../utils/base64';
import { hasPages, PAGE_CSS, pageFigureMarkup } from './manuscriptPageFigure';

export type ManuscriptHtmlLabels = {
  /** Name-based cross-reference, e.g. "See" - the PDF renderer reports no page mapping. */
  goToScene: string;
  /** Index heading, e.g. "Contents". */
  tocHeading: string;
};

/** Escapes text for HTML and XHTML alike (the EPUB renderer shares it). */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Inline marks as HTML elements; well-formed XHTML too (`<br />`). */
export function spansToHtml(spans: CompiledSpan[]): string {
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

/**
 * CSS for what the writer asked beyond the defaults: body face, size and line height, block
 * paragraphs, and centered scene separators. Empty when nothing was asked, so a document without
 * options keeps its long-standing stylesheet byte for byte. HTML and EPUB share it.
 */
export function typographyCss(options: ManuscriptRenderOptions, hasSceneBreaks: boolean): string {
  const rules: string[] = [];
  const body = [
    options.fontFamily === 'sans'
      ? "font-family: 'Helvetica Neue', Arial, sans-serif;"
      : options.fontFamily === 'serif'
        ? "font-family: Georgia, 'Times New Roman', serif;"
        : '',
    options.fontSize ? `font-size: ${options.fontSize}pt;` : '',
    options.lineSpacing ? `line-height: ${options.lineSpacing};` : '',
  ].filter(Boolean);
  if (body.length > 0) rules.push(`body { ${body.join(' ')} }`);
  if (options.paragraphStyle === 'block') rules.push('p { text-indent: 0; margin: 0 0 1em; }');
  if (hasSceneBreaks) {
    rules.push('p.scene-break { text-align: center; text-indent: 0; margin: 1em 0; }');
  }
  return rules.join('\n');
}

/**
 * The compiled manuscript as a self-contained HTML document. Chapters break pages when
 * printed; choices link to their target scene's anchor by name, and page counters ride on
 * print CSS where the browser honors them. (The PDF is drawn by `manuscriptPdf.ts`, with real
 * page numbers.)
 */
export function buildManuscriptHtml(
  manuscript: CompiledManuscript,
  labels: ManuscriptHtmlLabels,
  options: ManuscriptRenderOptions = {},
): string {
  const parts: string[] = [];
  const pushToc = () => {
    const entries = manuscriptTocEntries(manuscript.blocks);
    if (entries.length === 0) return;
    const items = entries
      .map(
        (entry) =>
          `<li class="${entry.level === 0 ? 'toc-chapter' : 'toc-scene'}"><a href="#${entry.bookmarkId}">${escapeHtml(entry.text)}</a></li>`,
      )
      .join('\n');
    parts.push(
      `<nav class="toc"><h2>${escapeHtml(labels.tocHeading)}</h2>\n<ul>\n${items}\n</ul></nav>`,
    );
  };
  let tocEmitted = false;
  // A picture used twice is encoded once.
  const dataUris = new Map<string, string>();
  const dataUriOf = (mediaId: string, image: { mimeType: string; bytes: Uint8Array }) => {
    const known = dataUris.get(mediaId);
    if (known) return known;
    const uri = `data:${image.mimeType};base64,${bytesToBase64(image.bytes)}`;
    dataUris.set(mediaId, uri);
    return uri;
  };
  // Consecutive items share one list element; any other block closes it.
  let openList: 'ul' | 'ol' | null = null;
  const closeList = () => {
    if (openList) {
      parts.push(`</${openList}>`);
      openList = null;
    }
  };
  for (const block of manuscript.blocks) {
    if (!tocEmitted && block.kind !== 'title' && block.kind !== 'subtitle') {
      tocEmitted = true;
      if (options.includeToc) pushToc();
    }
    if (block.kind === 'bullet' || block.kind === 'ordered') {
      const tag = block.kind === 'bullet' ? 'ul' : 'ol';
      if (openList !== tag) {
        closeList();
        parts.push(`<${tag}>`);
        openList = tag;
      }
      parts.push(`<li>${spansToHtml(block.spans)}</li>`);
      continue;
    }
    closeList();
    switch (block.kind) {
      case 'title':
        parts.push(`<h1 class="title">${escapeHtml(block.text)}</h1>`);
        break;
      case 'subtitle':
        parts.push(`<p class="subtitle">${escapeHtml(block.text)}</p>`);
        break;
      case 'chapter':
        parts.push(
          `<h2 class="chapter"${options.includeToc ? ` id="${block.bookmarkId}"` : ''}>${escapeHtml(block.number === null ? block.name : `${block.number}. ${block.name}`)}</h2>`,
        );
        break;
      case 'loose-heading':
        parts.push(
          `<h2 class="chapter loose"${options.includeToc ? ` id="${block.bookmarkId}"` : ''}>${escapeHtml(block.label)}</h2>`,
        );
        break;
      case 'scene-heading':
        parts.push(
          `<h3 class="scene" id="${block.bookmarkId ?? ''}">${escapeHtml(sceneHeadingLabel(block))}</h3>`,
        );
        break;
      case 'paragraph':
        parts.push(`<p>${spansToHtml(block.spans)}</p>`);
        break;
      case 'scene-break':
        parts.push(`<p class="scene-break">${escapeHtml(block.text)}</p>`);
        break;
      case 'page':
        parts.push(pageFigureMarkup(block, manuscript, dataUriOf));
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
        for (const line of [...(block.requirements ?? []), ...(block.effects ?? [])]) {
          parts.push(`<p class="choice-detail">${escapeHtml(line)}</p>`);
        }
        break;
      }
    }
  }
  closeList();
  const extraCss = [
    typographyCss(
      options,
      manuscript.blocks.some((block) => block.kind === 'scene-break'),
    ),
    hasPages(manuscript.blocks) ? PAGE_CSS : '',
  ]
    .filter(Boolean)
    .join('\n');
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
  p.choice, p.choice-detail, .subtitle { text-indent: 0; }
  .choice { margin-left: 1rem; }
  .choice-detail { margin-left: 2.5rem; color: #444; }
  a { color: #1a56db; }${options.includeToc ? '\n  .toc ul { list-style: none; padding: 0; }\n  .toc-scene { margin-left: 1.5rem; }\n  nav.toc + * { page-break-before: always; break-before: page; }' : ''}
  @page { margin: 2cm; @bottom-center { content: counter(page); } }${extraCss ? `\n  ${extraCss.split('\n').join('\n  ')}` : ''}
</style>
</head>
<body>
${parts.join('\n')}
</body>
</html>`;
}
