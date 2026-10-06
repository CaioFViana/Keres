import {
  AlignmentType,
  Bookmark,
  Document,
  Footer,
  HeadingLevel,
  ImageRun,
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
  sceneHeadingLabel,
  manuscriptTocEntries,
  type CompiledManuscript,
  type CompiledSpan,
  type ManuscriptRenderOptions,
  type ManuscriptTocEntry,
} from './manuscriptCompiler';
import { DEFAULT_PAGE_ASPECT, pageImageOf } from './manuscriptPageFigure';

export type ManuscriptDocxLabels = {
  /** Prefix of a choice reference, e.g. "Go to page" - the number itself is a PAGEREF field. */
  goToPage: string;
  /** Index heading, e.g. "Contents". */
  tocHeading: string;
};

/** Half an inch, the manuscript first-line convention, in twentieths of a point. */
const FIRST_LINE_INDENT_TWIPS = 720;
const PARAGRAPH_SPACING_AFTER = 120;
/** Block paragraphs: no indent, a full line of space between them. */
const BLOCK_SPACING_AFTER = 240;
/** The width of a picture on a page: the text width of A4 with 1" margins, in pixels (96 per inch). */
const PAGE_IMAGE_WIDTH_PX = 600;

/** Index page numbers flush right: A4 (11906 twips) minus 1" margins on both sides. */
const TOC_TAB_TWIPS = 9026;

/**
 * Body face, size and line height as document defaults - only when asked for, so a document
 * without them keeps Word's own defaults byte for byte.
 */
function documentStyles(options: ManuscriptRenderOptions) {
  const run = {
    ...(options.fontFamily
      ? { font: options.fontFamily === 'sans' ? 'Arial' : 'Times New Roman' }
      : {}),
    ...(options.fontSize ? { size: Math.round(options.fontSize * 2) } : {}),
  };
  const paragraph = options.lineSpacing
    ? { spacing: { line: Math.round(240 * options.lineSpacing) } }
    : undefined;
  if (Object.keys(run).length === 0 && !paragraph) return {};
  return {
    styles: {
      default: {
        document: {
          ...(Object.keys(run).length > 0 ? { run } : {}),
          ...(paragraph ? { paragraph } : {}),
        },
      },
    },
  };
}

function spansToRuns(spans: CompiledSpan[]): TextRun[] {
  // Adjacent spans with identical marks ride one run: the parsers already
  // merge, so this is normally a no-op pass — kept so a future span source
  // can never multiply runs (and the document) behind the renderers' backs.
  // Newlines never merge: break handling stays exactly where each span put it.
  const merged: CompiledSpan[] = [];
  for (const span of spans) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      !prev.text.includes('\n') &&
      !span.text.includes('\n') &&
      prev.bold === span.bold &&
      prev.italic === span.italic &&
      prev.underline === span.underline &&
      prev.strikethrough === span.strikethrough
    ) {
      merged[merged.length - 1] = { ...prev, text: prev.text + span.text };
    } else {
      merged.push({ ...span });
    }
  }
  return merged.map(
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
            // A tab only triggers the dot leader inside a run: bare under
            // <w:p> it is invalid and readers drop it with the dots.
            new TextRun({ children: [new Tab()] }),
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
  // Display numbers of one ordered run; any other block restarts the run at 1.
  let orderedNumber = 0;
  for (const block of manuscript.blocks) {
    if (!tocEmitted && block.kind !== 'title' && block.kind !== 'subtitle') {
      tocEmitted = true;
      if (options.includeToc) pushToc(manuscriptTocEntries(manuscript.blocks));
    }
    if (block.kind !== 'ordered') orderedNumber = 0;
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
        const run = new TextRun(sceneHeadingLabel(block));
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
          new Paragraph(
            options.paragraphStyle === 'block'
              ? { spacing: { after: BLOCK_SPACING_AFTER }, children: spansToRuns(block.spans) }
              : {
                  indent: { firstLine: FIRST_LINE_INDENT_TWIPS },
                  spacing: { after: PARAGRAPH_SPACING_AFTER },
                  children: spansToRuns(block.spans),
                },
          ),
        );
        break;
      case 'bullet':
        children.push(
          new Paragraph({
            indent: { left: 360 },
            spacing: { after: PARAGRAPH_SPACING_AFTER },
            children: [new TextRun('•  '), ...spansToRuns(block.spans)],
          }),
        );
        break;
      case 'ordered': {
        orderedNumber += 1;
        children.push(
          new Paragraph({
            indent: { left: 360 },
            spacing: { after: PARAGRAPH_SPACING_AFTER },
            children: [new TextRun(`${orderedNumber}.  `), ...spansToRuns(block.spans)],
          }),
        );
        break;
      }
      case 'page': {
        children.push(
          new Paragraph({
            keepNext: true,
            spacing: { before: 240, after: 80 },
            children: [new TextRun({ text: block.label, bold: true })],
          }),
        );
        const image = pageImageOf(block, manuscript);
        if (!block.image || !image) {
          children.push(
            new Paragraph({
              spacing: { after: 240 },
              children: [new TextRun({ text: block.placeholder, italics: true })],
            }),
          );
          break;
        }
        // The picture sits whole in the frame; Word has no crop to give, so a page that fills its
        // frame is shown whole here too.
        const frameHeight = PAGE_IMAGE_WIDTH_PX / (manuscript.pageAspect ?? DEFAULT_PAGE_ASPECT);
        const scale = Math.min(PAGE_IMAGE_WIDTH_PX / image.width, frameHeight / image.height);
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [
              new ImageRun({
                type: image.mimeType === 'image/jpeg' ? 'jpg' : 'png',
                data: image.bytes,
                transformation: {
                  width: Math.max(1, Math.round(image.width * scale)),
                  height: Math.max(1, Math.round(image.height * scale)),
                },
                altText: { name: block.label, title: block.label, description: block.label },
              }),
            ],
          }),
        );
        break;
      }
      case 'scene-break':
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 240, after: 240 },
            children: [new TextRun(block.text)],
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
          children.push(
            new Paragraph({ children: [new TextRun(`${lead} — ${block.targetSceneName}`)] }),
          );
        } else {
          children.push(new Paragraph({ children: [new TextRun(lead)] }));
        }
        for (const line of [...(block.requirements ?? []), ...(block.effects ?? [])]) {
          children.push(
            new Paragraph({
              indent: { left: 720 },
              children: [new TextRun(line)],
            }),
          );
        }
        break;
      }
    }
  }
  return new Document({
    // PAGEREF fields (index numbers, "go to page" choices) carry no cached
    // result: readers resolve them on open instead of showing blanks.
    features: { updateFields: true },
    ...documentStyles(options),
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
