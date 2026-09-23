import {
  manuscriptTocEntries,
  type CompiledManuscript,
  type CompiledSpan,
  type ManuscriptRenderOptions,
} from './manuscriptCompiler';

export type ManuscriptTextLabels = {
  /** Name-based cross-reference, e.g. "See" - plain text has no pages to point at. */
  goToScene: string;
  /** Index heading, e.g. "Contents". Markdown only; plain text has no index. */
  tocHeading: string;
};

/** Detectors for "this raw text would parse markup of its own". Mirror of the app serializer. */
const STAR_PAIR_PATTERN = /(\*[^*]+\*)|(\*\*.+?\*\*)/;
const UNDERSCORE_PAIR_PATTERN = /__.+?__/;
const TILDE_PAIR_PATTERN = /~~.+?~~/;

type MarkdownEscapeFlags = { stars: boolean; underscores: boolean; tildes: boolean };

/**
 * Lone markers are harmless and stay readable; emitted marks or a raw pair
 * force escaping, so literal text can never join or break a pair.
 */
function escapeFlagsFor(spans: CompiledSpan[]): MarkdownEscapeFlags {
  const raw = spans.map((span) => span.text).join('');
  return {
    stars: spans.some((span) => span.bold || span.italic) || STAR_PAIR_PATTERN.test(raw),
    underscores: spans.some((span) => span.underline) || UNDERSCORE_PAIR_PATTERN.test(raw),
    tildes: spans.some((span) => span.strikethrough) || TILDE_PAIR_PATTERN.test(raw),
  };
}

function escapeMarkdownText(text: string, flags: MarkdownEscapeFlags): string {
  let out = text.replace(/\\(?=[\\*_~#])/g, '\\\\');
  if (flags.stars) out = out.replace(/\*/g, '\\*');
  if (flags.underscores) out = out.replace(/_/g, '\\_');
  if (flags.tildes) out = out.replace(/~/g, '\\~');
  return out;
}

function spansToMarkdown(spans: CompiledSpan[]): string {
  const flags = escapeFlagsFor(spans);
  return spans
    .map((span) => {
      const text = escapeMarkdownText(span.text, flags);
      const wrap = (core: string) => {
        const emphasized =
          span.bold && span.italic
            ? `***${core}***`
            : span.bold
              ? `**${core}**`
              : span.italic
                ? `*${core}*`
                : core;
        const struck = span.strikethrough ? `~~${emphasized}~~` : emphasized;
        // Underline has no markdown syntax; embedded HTML is the portable fallback.
        return span.underline ? `<u>${struck}</u>` : struck;
      };
      if (!span.bold && !span.italic && !span.underline && !span.strikethrough) return text;
      // Flanking: external renderers ignore emphasis with boundary spaces
      // (`*of *` stays literal), so edge whitespace moves outside the markers.
      // An all-whitespace span keeps its markers verbatim instead: it renders
      // literally everywhere, exactly like its source.
      const leading = text.match(/^\s+/)?.[0] ?? '';
      const trailing = text.match(/\s+$/)?.[0] ?? '';
      const core = text.slice(leading.length, text.length - trailing.length);
      return core === '' ? wrap(text) : leading + wrap(core) + trailing;
    })
    .join('');
}

function spansToText(spans: CompiledSpan[]): string {
  return spans.map((span) => span.text).join('');
}

/** Link text cannot carry raw brackets; scene names sometimes do. */
function escapeMarkdownLinkText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\[/g, '\\[').replace(/\]/g, '\\]');
}

/** The compiled manuscript as Markdown - also the honest fallback if rich export fails. */
export function buildManuscriptMarkdown(
  manuscript: CompiledManuscript,
  labels: ManuscriptTextLabels,
  options: ManuscriptRenderOptions = {},
): string {
  const lines: string[] = [];
  const pushToc = () => {
    const entries = manuscriptTocEntries(manuscript.blocks);
    if (entries.length === 0) return;
    lines.push(`## ${labels.tocHeading}`, '');
    for (const entry of entries) {
      const bullet = entry.level === 0 ? '-' : '  -';
      lines.push(`${bullet} [${escapeMarkdownLinkText(entry.text)}](#${entry.bookmarkId})`);
    }
    lines.push('');
  };
  const anchorFor = (bookmarkId: string | null) =>
    options.includeToc && bookmarkId !== null ? `<a id="${bookmarkId}"></a>` : null;
  let tocEmitted = false;
  for (const block of manuscript.blocks) {
    if (!tocEmitted && block.kind !== 'title' && block.kind !== 'subtitle') {
      tocEmitted = true;
      if (options.includeToc) pushToc();
    }
    switch (block.kind) {
      case 'title':
        lines.push(`# ${block.text}`, '');
        break;
      case 'subtitle':
        lines.push(`*${block.text}*`, '');
        break;
      case 'chapter': {
        const anchor = anchorFor(block.bookmarkId);
        if (anchor) lines.push(anchor);
        lines.push(
          `## ${block.number === null ? block.name : `${block.number}. ${block.name}`}`,
          '',
        );
        break;
      }
      case 'loose-heading': {
        const anchor = anchorFor(block.bookmarkId);
        if (anchor) lines.push(anchor);
        lines.push(`## ${block.label}`, '');
        break;
      }
      case 'scene-heading': {
        const anchor = anchorFor(block.bookmarkId);
        if (anchor) lines.push(anchor);
        lines.push(`### ${block.number}. ${block.name}`, '');
        break;
      }
      case 'paragraph':
        // A literal leading hash would read as a heading; escape it per line.
        lines.push(spansToMarkdown(block.spans).replace(/^(#{1,3} )/gm, '\\$1'), '');
        break;
      case 'choice': {
        const lead = `- ${block.text}`;
        lines.push(
          block.targetSceneName ? `${lead} — ${labels.goToScene} ${block.targetSceneName}` : lead,
        );
        for (const line of [...(block.requirements ?? []), ...(block.effects ?? [])]) {
          lines.push(`  ${line}`);
        }
        lines.push('');
        break;
      }
    }
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

/** The compiled manuscript as plain text: headings underlined, no markup left. */
export function buildManuscriptText(
  manuscript: CompiledManuscript,
  labels: ManuscriptTextLabels,
): string {
  const lines: string[] = [];
  const underline = (text: string, char: string) => [text, char.repeat(text.length), ''];
  for (const block of manuscript.blocks) {
    switch (block.kind) {
      case 'title':
        lines.push(...underline(block.text, '='));
        break;
      case 'subtitle':
        lines.push(block.text, '');
        break;
      case 'chapter':
        lines.push(
          ...underline(block.number === null ? block.name : `${block.number}. ${block.name}`, '-'),
        );
        break;
      case 'loose-heading':
        lines.push(...underline(block.label, '-'));
        break;
      case 'scene-heading':
        lines.push(`${block.number}. ${block.name}`, '');
        break;
      case 'paragraph':
        lines.push(spansToText(block.spans), '');
        break;
      case 'choice': {
        const lead = `* ${block.text}`;
        lines.push(
          block.targetSceneName ? `${lead} — ${labels.goToScene} ${block.targetSceneName}` : lead,
        );
        for (const line of [...(block.requirements ?? []), ...(block.effects ?? [])]) {
          lines.push(`  ${line}`);
        }
        lines.push('');
        break;
      }
    }
  }
  return `${lines.join('\n').trimEnd()}\n`;
}
