import type { CompiledManuscript, CompiledSpan } from './manuscriptCompiler';

export type ManuscriptTextLabels = {
  /** Name-based cross-reference, e.g. "See" - plain text has no pages to point at. */
  goToScene: string;
};

function spansToMarkdown(spans: CompiledSpan[]): string {
  return spans
    .map((span) => {
      const emphasized =
        span.bold && span.italic
          ? `***${span.text}***`
          : span.bold
            ? `**${span.text}**`
            : span.italic
              ? `*${span.text}*`
              : span.text;
      const struck = span.strikethrough ? `~~${emphasized}~~` : emphasized;
      // Underline has no markdown syntax; embedded HTML is the portable fallback.
      return span.underline ? `<u>${struck}</u>` : struck;
    })
    .join('');
}

function spansToText(spans: CompiledSpan[]): string {
  return spans.map((span) => span.text).join('');
}

/** The compiled manuscript as Markdown - also the honest fallback if rich export fails. */
export function buildManuscriptMarkdown(
  manuscript: CompiledManuscript,
  labels: ManuscriptTextLabels,
): string {
  const lines: string[] = [];
  for (const block of manuscript.blocks) {
    switch (block.kind) {
      case 'title':
        lines.push(`# ${block.text}`, '');
        break;
      case 'subtitle':
        lines.push(`*${block.text}*`, '');
        break;
      case 'chapter':
        lines.push(`## ${block.number === null ? block.name : `${block.number}. ${block.name}`}`, '');
        break;
      case 'loose-heading':
        lines.push(`## ${block.label}`, '');
        break;
      case 'scene-heading':
        lines.push(`### ${block.number}. ${block.name}`, '');
        break;
      case 'body-heading':
        lines.push(`${'#'.repeat(block.level + 3)} ${spansToMarkdown(block.spans)}`, '');
        break;
      case 'paragraph':
        lines.push(spansToMarkdown(block.spans), '');
        break;
      case 'choice': {
        const lead = `- ${block.text}`;
        lines.push(
          block.targetSceneName ? `${lead} — ${labels.goToScene} ${block.targetSceneName}` : lead,
          '',
        );
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
        lines.push(...underline(block.number === null ? block.name : `${block.number}. ${block.name}`, '-'));
        break;
      case 'loose-heading':
        lines.push(...underline(block.label, '-'));
        break;
      case 'scene-heading':
        lines.push(`${block.number}. ${block.name}`, '');
        break;
      case 'body-heading':
        lines.push(spansToText(block.spans), '');
        break;
      case 'paragraph':
        lines.push(spansToText(block.spans), '');
        break;
      case 'choice': {
        const lead = `* ${block.text}`;
        lines.push(block.targetSceneName ? `${lead} — ${labels.goToScene} ${block.targetSceneName}` : lead, '');
        break;
      }
    }
  }
  return `${lines.join('\n').trimEnd()}\n`;
}
