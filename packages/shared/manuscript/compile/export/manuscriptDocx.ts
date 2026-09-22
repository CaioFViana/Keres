import {
  AlignmentType,
  Bookmark,
  Document,
  Footer,
  HeadingLevel,
  InternalHyperlink,
  LeaderType,
  Packer,
  PageBreak,
  PageNumber,
  PageReference,
  Paragraph,
  Tab,
  TabStopType,
  TextRun,
} from 'docx';
import {
  manuscriptTocEntries,
  type CompiledManuscript,
  type CompiledSpan,
  type ManuscriptRenderOptions,
  type ManuscriptTocEntry,
} from './manuscriptCompiler';

export type ManuscriptDocxLabels = {
  /** Prefix of a choice reference, e.g. "Go to page" - the number itself is a PAGEREF field. */
  goToPage: string;
  /** Index heading, e.g. "Contents". */
  tocHeading: string;
};

/** Half an inch, the manuscript first-line convention, in twentieths of a point. */
const FIRST_LINE_INDENT_TWIPS = 720;
const PARAGRAPH_SPACING_AFTER = 120;
/** Index page numbers flush right: A4 (11906 twips) minus 1" margins on both sides. */
const TOC_TAB_TWIPS = 9026;

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

/**
 * The compiled manuscript as a Word document: title page flow, chapters with page breaks,
 * one bookmark per scene, and every choice pointing at its target through a PAGEREF field -
 * so "go to page X" numbers resolve in Word/LibreOffice with zero pagination in the app.
 */
export function buildManuscriptDocument(
  manuscript: CompiledManuscript,
  labels: ManuscriptDocxLabels,
  options: ManuscriptRenderOptions = {},
): Document {
  const children: Paragraph[] = [];
  const pushToc = (entries: ManuscriptTocEntry[]) => {
    if (entries.length === 0) return;
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun(labels.tocHeading)],
      }),
    );
    for (const entry of entries) {
      children.push(
        new Paragraph({
          children: [
            new InternalHyperlink({
              anchor: entry.bookmarkId,
              children: [new TextRun(entry.text)],
            }),
            new Tab(),
            new PageReference(entry.bookmarkId, { hyperlink: true }),
          ],
          tabStops: [{ type: TabStopType.RIGHT, position: TOC_TAB_TWIPS, leader: LeaderType.DOT }],
          indent: entry.level === 1 ? { left: 360 } : undefined,
        }),
      );
    }
    // The title page holds the title and the index alone: the body always
    // opens on a fresh page, whatever kind of block leads it.
    children.push(new Paragraph({ children: [new PageBreak()] }));
  };
  let firstContent = true;
  let tocEmitted = false;
  for (const block of manuscript.blocks) {
    if (!tocEmitted && block.kind !== 'title' && block.kind !== 'subtitle') {
      tocEmitted = true;
      if (options.includeToc) pushToc(manuscriptTocEntries(manuscript.blocks));
    }
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
      case 'chapter': {
        const run = new TextRun(
          block.number === null ? block.name : `${block.number}. ${block.name}`,
        );
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            pageBreakBefore: !firstContent,
            children: options.includeToc
              ? [new Bookmark({ id: block.bookmarkId, children: [run] })]
              : [run],
          }),
        );
        firstContent = false;
        break;
      }
      case 'loose-heading': {
        const run = new TextRun(block.label);
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            pageBreakBefore: !firstContent,
            children: options.includeToc
              ? [new Bookmark({ id: block.bookmarkId, children: [run] })]
              : [run],
          }),
        );
        firstContent = false;
        break;
      }
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

/**
 * The document packed as bytes, ready for delivery. ArrayBuffer out of the
 * packer keeps this free of Node-only (`Buffer`) and browser-only (`atob`)
 * decoders on every runtime the package ships to.
 */
export async function buildManuscriptDocxBytes(
  manuscript: CompiledManuscript,
  labels: ManuscriptDocxLabels,
  options: ManuscriptRenderOptions = {},
): Promise<Uint8Array> {
  return new Uint8Array(
    await Packer.toArrayBuffer(buildManuscriptDocument(manuscript, labels, options)),
  );
}
