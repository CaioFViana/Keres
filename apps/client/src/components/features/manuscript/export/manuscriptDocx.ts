import {
  AlignmentType,
  Bookmark,
  Document,
  Footer,
  HeadingLevel,
  Packer,
  PageNumber,
  PageReference,
  Paragraph,
  TextRun,
} from 'docx';
import type { CompiledManuscript, CompiledSpan } from './manuscriptCompiler';

export type ManuscriptDocxLabels = {
  /** Prefix of a choice reference, e.g. "Go to page" - the number itself is a PAGEREF field. */
  goToPage: string;
};

/** Half an inch, the manuscript first-line convention, in twentieths of a point. */
const FIRST_LINE_INDENT_TWIPS = 720;
const PARAGRAPH_SPACING_AFTER = 120;

function spansToRuns(spans: CompiledSpan[]): TextRun[] {
  return spans.map(
    (span) =>
      new TextRun({
        text: span.text,
        bold: span.bold || undefined,
        italics: span.italic || undefined,
        underline: span.underline ? {} : undefined,
        strike: span.strikethrough || undefined,
      }),
  );
}

const BODY_HEADING_LEVEL = {
  1: HeadingLevel.HEADING_3,
  2: HeadingLevel.HEADING_4,
  3: HeadingLevel.HEADING_5,
} as const;

/**
 * The compiled manuscript as a Word document: title page flow, chapters with page breaks,
 * one bookmark per scene, and every choice pointing at its target through a PAGEREF field -
 * so "go to page X" numbers resolve in Word/LibreOffice with zero pagination in the app.
 */
export function buildManuscriptDocument(
  manuscript: CompiledManuscript,
  labels: ManuscriptDocxLabels,
): Document {
  const children: Paragraph[] = [];
  let firstContent = true;
  for (const block of manuscript.blocks) {
    switch (block.kind) {
      case 'title':
        children.push(
          new Paragraph({
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [new TextRun(block.text)],
          }),
        );
        break;
      case 'subtitle':
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 480 },
            children: [new TextRun({ text: block.text, italics: true })],
          }),
        );
        break;
      case 'chapter':
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            pageBreakBefore: !firstContent,
            children: [
              new TextRun(block.number === null ? block.name : `${block.number}. ${block.name}`),
            ],
          }),
        );
        firstContent = false;
        break;
      case 'loose-heading':
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            pageBreakBefore: !firstContent,
            children: [new TextRun(block.label)],
          }),
        );
        firstContent = false;
        break;
      case 'scene-heading': {
        const run = new TextRun(`${block.number}. ${block.name}`);
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            keepNext: true,
            children: block.bookmarkId
              ? [new Bookmark({ id: block.bookmarkId, children: [run] })]
              : [run],
          }),
        );
        firstContent = false;
        break;
      }
      case 'body-heading':
        children.push(
          new Paragraph({
            heading: BODY_HEADING_LEVEL[block.level],
            keepNext: true,
            children: spansToRuns(block.spans),
          }),
        );
        break;
      case 'paragraph':
        children.push(
          new Paragraph({
            indent: { firstLine: FIRST_LINE_INDENT_TWIPS },
            spacing: { after: PARAGRAPH_SPACING_AFTER },
            children: spansToRuns(block.spans),
          }),
        );
        break;
      case 'choice': {
        const lead = `• ${block.text}`;
        if (block.targetBookmarkId) {
          children.push(
            new Paragraph({
              children: [
                new TextRun(`${lead} — ${labels.goToPage} `),
                new PageReference(block.targetBookmarkId, { hyperlink: true }),
              ],
            }),
          );
        } else if (block.targetSceneName) {
          children.push(new Paragraph({ children: [new TextRun(`${lead} — ${block.targetSceneName}`)] }));
        } else {
          children.push(new Paragraph({ children: [new TextRun(lead)] }));
        }
        break;
      }
    }
  }
  return new Document({
    sections: [
      {
        children,
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ children: [PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES] }),
                ],
              }),
            ],
          }),
        },
      },
    ],
  });
}

/** The document packed as base64, ready to decode into bytes for delivery. */
export function buildManuscriptDocxBase64(
  manuscript: CompiledManuscript,
  labels: ManuscriptDocxLabels,
): Promise<string> {
  return Packer.toBase64String(buildManuscriptDocument(manuscript, labels));
}
