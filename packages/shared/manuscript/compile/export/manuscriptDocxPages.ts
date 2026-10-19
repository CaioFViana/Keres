import {
  AlignmentType,
  ImageRun,
  Paragraph,
  Table,
  TableBorders,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import type { CompiledManuscript } from './manuscriptCompiler';
import {
  DEFAULT_PAGE_ASPECT,
  openingsOf,
  pageImageOf,
  type PageBlock,
  type PageOpening,
  type PageRun,
} from './manuscriptPageFigure';

/** The width of the text on a page of the document, in pixels (96 per inch): A4 with 1" margins. */
const TEXT_WIDTH_PX = 600;

type PagesOf = Pick<CompiledManuscript, 'images' | 'pageAspect' | 'pageLayout'>;

/** A page's picture sized to a frame of `width` pixels in the shape of the page (whole, as Word has no crop). */
function pictureParagraph(
  block: PageBlock,
  manuscript: PagesOf,
  width: number,
  frames: number,
  alignment: (typeof AlignmentType)[keyof typeof AlignmentType],
): Paragraph {
  const image = pageImageOf(block, manuscript);
  if (!block.image || !image) {
    return new Paragraph({
      alignment,
      children: [new TextRun({ text: block.placeholder, italics: true })],
    });
  }
  const frameHeight = width / ((manuscript.pageAspect ?? DEFAULT_PAGE_ASPECT) * frames);
  const scale = Math.min(width / image.width, frameHeight / image.height);
  return new Paragraph({
    alignment,
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
  });
}

const cell = (percent: number, children: Paragraph[], columnSpan?: number): TableCell =>
  new TableCell({
    width: { size: percent, type: WidthType.PERCENTAGE },
    columnSpan,
    children: children.length > 0 ? children : [new Paragraph({ children: [] })],
  });

const borderless = (rows: TableRow[]): Table =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TableBorders.NONE,
    rows,
  });

/** A page as a row of a planning sheet: the picture in one cell, its caption and text in the other. */
function sheetTable(block: PageBlock, manuscript: PagesOf): Table {
  const frames = block.spread ? 2 : 1;
  const aspect = (manuscript.pageAspect ?? DEFAULT_PAGE_ASPECT) * frames;
  const share = aspect < 1 ? 38 : 55;
  const width = Math.round((TEXT_WIDTH_PX * share) / 100) - 12;
  const script = [
    new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({ text: block.label, bold: true })],
    }),
    ...block.text.map(
      (line) => new Paragraph({ spacing: { after: 80 }, children: [new TextRun(line)] }),
    ),
  ];
  return borderless([
    new TableRow({
      cantSplit: true,
      children: [
        cell(share, [pictureParagraph(block, manuscript, width, frames, AlignmentType.LEFT)]),
        cell(100 - share, script),
      ],
    }),
  ]);
}

/** An opening: two pages across, or one picture over both; an empty side keeps a lone right page on the right. */
function openingTable(opening: PageOpening, manuscript: PagesOf): Table {
  const half = Math.round(TEXT_WIDTH_PX / 2) - 12;
  const captioned = (page: PageBlock | null, frames: number, width: number): Paragraph[] =>
    page
      ? [
          pictureParagraph(page, manuscript, width, frames, AlignmentType.CENTER),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [new TextRun({ text: page.label })],
          }),
        ]
      : [];
  if (opening.wide) {
    return borderless([
      new TableRow({
        cantSplit: true,
        children: [cell(100, captioned(opening.wide, 2, TEXT_WIDTH_PX - 12), 2)],
      }),
    ]);
  }
  return borderless([
    new TableRow({
      cantSplit: true,
      children: [
        cell(50, captioned(opening.left, 1, half)),
        cell(50, captioned(opening.right, 1, half)),
      ],
    }),
  ]);
}

/** Page blocks of a comic in the layouts that set them in cells: a planning sheet, or the openings of a book. */
export function docxPageTables(
  block: PageBlock | PageRun,
  manuscript: PagesOf,
): (Table | Paragraph)[] {
  const tables =
    'pages' in block
      ? openingsOf(block.pages).map((opening) => openingTable(opening, manuscript))
      : [sheetTable(block, manuscript)];
  // Two tables in a row would be one table to Word: a line between them keeps them apart.
  return tables.flatMap((table) => [
    table,
    new Paragraph({ spacing: { after: 120 }, children: [] }),
  ]);
}
