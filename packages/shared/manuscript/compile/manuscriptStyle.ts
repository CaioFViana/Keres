import { z } from 'zod';
import type {
  CompiledBlock,
  CompiledManuscript,
  CompiledSpan,
  ManuscriptRenderOptions,
} from './export/manuscriptCompiler';

/**
 * How a manuscript looks beyond its content: typography the renderers honor, and presentation
 * applied to the compiled blocks before any renderer sees them (numbering, quotes, spaces,
 * placeholders, the lines of a generated title page). Every field is optional and absent means
 * the long-standing output, byte for byte. Presets are defaults over these fields, never formats.
 */
export const ManuscriptStyleSchema = z.object({
  paragraphStyle: z.enum(['indent', 'block']).optional(),
  /** Body size in points. */
  fontSize: z.number().min(8).max(24).optional(),
  /** Line height as a multiple of the body size. */
  lineSpacing: z.number().min(1).max(3).optional(),
  fontFamily: z.enum(['serif', 'sans']).optional(),
  /** PDF page: A4, or a 6"x9" trade paperback. */
  pageSize: z.enum(['a4', '6x9']).optional(),
  sceneSeparator: z.enum(['none', 'hash', 'asterisks', 'rule']).optional(),
  chapterNumbering: z.enum(['arabic', 'roman', 'words', 'none']).optional(),
  quotes: z.enum(['straight', 'curly', 'guillemets']).optional(),
  /** Runs of spaces collapse to one. */
  collapseSpaces: z.boolean().optional(),
  /** Lines of a generated title page, under the title: author, copyright... (localized by the caller). */
  frontMatter: z.array(z.string().max(300)).max(8).optional(),
  /** `<$name>` in the text becomes its value: `author`, `title`, `date`... */
  placeholders: z.record(z.string().regex(/^[a-z]{1,20}$/), z.string().max(300)).optional(),
});
export type ManuscriptStyle = z.infer<typeof ManuscriptStyleSchema>;

export const MANUSCRIPT_PRESETS = ['ebook', 'paperback', 'submission', 'chronicle'] as const;
export type ManuscriptPreset = (typeof MANUSCRIPT_PRESETS)[number];

/** A preset: a format and the settings its destination expects, each one overridable. */
export type ManuscriptPresetSettings = {
  format: 'epub' | 'pdf' | 'docx';
  includeToc: boolean;
  includeSceneNames: boolean;
  titlePage: boolean;
  style: ManuscriptStyle;
};

export const MANUSCRIPT_PRESET_SETTINGS: Record<ManuscriptPreset, ManuscriptPresetSettings> = {
  // Reflowable: the reader picks the face and size; separators and curly quotes carry over.
  ebook: {
    format: 'epub',
    includeToc: true,
    includeSceneNames: false,
    titlePage: true,
    style: {
      paragraphStyle: 'indent',
      sceneSeparator: 'asterisks',
      quotes: 'curly',
      collapseSpaces: true,
    },
  },
  // Print-ready interior: 6"x9", book leading, indented paragraphs.
  paperback: {
    format: 'pdf',
    includeToc: true,
    includeSceneNames: false,
    titlePage: true,
    style: {
      pageSize: '6x9',
      fontSize: 11,
      lineSpacing: 1.35,
      paragraphStyle: 'indent',
      sceneSeparator: 'asterisks',
      quotes: 'curly',
      collapseSpaces: true,
    },
  },
  // Standard manuscript format: Times 12, double-spaced, `#` between scenes.
  submission: {
    format: 'docx',
    includeToc: false,
    includeSceneNames: false,
    titlePage: true,
    style: {
      fontFamily: 'serif',
      fontSize: 12,
      lineSpacing: 2,
      paragraphStyle: 'indent',
      sceneSeparator: 'hash',
      collapseSpaces: true,
    },
  },
  // The record of a tabletop campaign, for the table to read: every session a heading in the index,
  // each scene named, plain paragraphs and a rule between scenes. Offered where the work is a campaign.
  chronicle: {
    format: 'pdf',
    includeToc: true,
    includeSceneNames: true,
    titlePage: false,
    style: {
      paragraphStyle: 'block',
      sceneSeparator: 'rule',
      collapseSpaces: true,
    },
  },
};

const SEPARATOR_TEXT = { hash: '#', asterisks: '* * *', rule: '———' } as const;

/** The text drawn between scenes, or null for none. */
export function sceneSeparatorText(style: ManuscriptStyle = {}): string | null {
  const separator = style.sceneSeparator ?? 'none';
  return separator === 'none' ? null : SEPARATOR_TEXT[separator];
}

/** The renderer flags a style and an index choice amount to. */
export function renderOptionsOf(
  style: ManuscriptStyle = {},
  includeToc = false,
): ManuscriptRenderOptions {
  return {
    ...(includeToc ? { includeToc } : {}),
    ...(style.paragraphStyle ? { paragraphStyle: style.paragraphStyle } : {}),
    ...(style.fontSize ? { fontSize: style.fontSize } : {}),
    ...(style.lineSpacing ? { lineSpacing: style.lineSpacing } : {}),
    ...(style.fontFamily ? { fontFamily: style.fontFamily } : {}),
    ...(style.pageSize ? { pageSize: style.pageSize } : {}),
  };
}

const ROMAN: [number, string][] = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

export function romanNumeral(value: number): string {
  if (value < 1 || value > 3999) return String(value);
  let rest = value;
  let text = '';
  for (const [amount, symbol] of ROMAN) {
    while (rest >= amount) {
      text += symbol;
      rest -= amount;
    }
  }
  return text;
}

const WORDS = {
  en: {
    units: [
      '',
      'One',
      'Two',
      'Three',
      'Four',
      'Five',
      'Six',
      'Seven',
      'Eight',
      'Nine',
      'Ten',
      'Eleven',
      'Twelve',
      'Thirteen',
      'Fourteen',
      'Fifteen',
      'Sixteen',
      'Seventeen',
      'Eighteen',
      'Nineteen',
    ],
    tens: ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'],
    join: (ten: string, unit: string) => `${ten}-${unit}`,
    hundred: 'One Hundred',
  },
  pt: {
    units: [
      '',
      'Um',
      'Dois',
      'Três',
      'Quatro',
      'Cinco',
      'Seis',
      'Sete',
      'Oito',
      'Nove',
      'Dez',
      'Onze',
      'Doze',
      'Treze',
      'Catorze',
      'Quinze',
      'Dezesseis',
      'Dezessete',
      'Dezoito',
      'Dezenove',
    ],
    tens: [
      '',
      '',
      'Vinte',
      'Trinta',
      'Quarenta',
      'Cinquenta',
      'Sessenta',
      'Setenta',
      'Oitenta',
      'Noventa',
    ],
    join: (ten: string, unit: string) => `${ten} e ${unit.toLowerCase()}`,
    hundred: 'Cem',
  },
} as const;

/** A number in words (1-100, English or Portuguese); digits beyond. */
export function numberInWords(value: number, language: 'en' | 'pt'): string {
  const words = WORDS[language];
  if (value === 100) return words.hundred;
  if (value < 1 || value > 100) return String(value);
  if (value < 20) return words.units[value]!;
  const ten = words.tens[Math.floor(value / 10)]!;
  const unit = value % 10;
  return unit === 0 ? ten : words.join(ten, words.units[unit]!);
}

/** Curly (or guillemet) quotes by context: after a start, a space or an opener, a quote opens. */
function typographicQuotes(text: string, style: 'curly' | 'guillemets', before: string): string {
  let previous = before;
  let out = '';
  for (const char of text) {
    const opens = previous === '' || /[\s([{—–-]/.test(previous);
    if (char === '"') {
      out += style === 'guillemets' ? (opens ? '«' : '»') : opens ? '“' : '”';
    } else if (char === "'") {
      out += opens ? '‘' : '’';
    } else {
      out += char;
    }
    previous = char;
  }
  return out;
}

function presentSpans(
  spans: CompiledSpan[],
  style: ManuscriptStyle,
  fill: (text: string) => string,
) {
  let before = '';
  return spans.map((span) => {
    let text = fill(span.text);
    if (style.collapseSpaces) {
      text = text.replace(/ {2,}/g, ' ');
      if (before.endsWith(' ') && text.startsWith(' ')) text = text.slice(1);
    }
    if (style.quotes && style.quotes !== 'straight') {
      text = typographicQuotes(text, style.quotes, before.slice(-1));
    }
    if (text.length > 0) before = text;
    return { ...span, text };
  });
}

/** One block through the style: pure in (block, style, fill, language). */
export type BlockPresenter = (block: CompiledBlock) => CompiledBlock;

function fillFor(style: ManuscriptStyle): (text: string) => string {
  const placeholders = style.placeholders ?? {};
  return (text) =>
    Object.keys(placeholders).length === 0
      ? text
      : text.replace(/<\$([a-z]{1,20})>/g, (whole, name: string) => placeholders[name] ?? whole);
}

/**
 * The per-block half of `presentManuscript`, shared with the compilers: when
 * the pipeline presents each block at creation, no second full copy of every
 * span ever exists. Behavior is identical either way (each block is
 * independent: no transform reads its neighbors).
 */
export function blockPresenterFor(
  style: ManuscriptStyle = {},
  language: 'en' | 'pt' = 'en',
): BlockPresenter {
  const fill = fillFor(style);
  // Without quotes, collapsing or placeholders every span transform below is
  // provably a no-op: return blocks untouched instead of copying every span.
  // (Chapter numbering is checked per block regardless.)
  const spansIdentity =
    (!style.quotes || style.quotes === 'straight') &&
    !style.collapseSpaces &&
    Object.keys(style.placeholders ?? {}).length === 0;
  const plain = (text: string) =>
    presentSpans(
      [{ text, bold: false, italic: false, underline: false, strikethrough: false }],
      style,
      fill,
    )[0]!.text;
  const numbering = style.chapterNumbering ?? 'arabic';
  return (block) => {
    switch (block.kind) {
      case 'title':
      case 'subtitle':
        return spansIdentity ? block : { ...block, text: fill(block.text) };
      case 'chapter': {
        if (block.number === null || numbering === 'arabic') {
          return block;
        }
        if (numbering === 'none') {
          return { ...block, number: null };
        }
        const label =
          numbering === 'roman'
            ? romanNumeral(block.number)
            : numberInWords(block.number, language);
        return { ...block, number: null, name: `${label}. ${block.name}` };
      }
      case 'paragraph':
      case 'bullet':
      case 'ordered':
        return spansIdentity ? block : { ...block, spans: presentSpans(block.spans, style, fill) };
      case 'choice':
        return spansIdentity ? block : { ...block, text: plain(block.text) };
      default:
        return block;
    }
  };
}

/**
 * The compiled manuscript as the style presents it. Pure: the renderers only ever draw what this
 * hands them. `language` picks the words of spelled-out chapter numbers.
 */
export function presentManuscript(
  manuscript: CompiledManuscript,
  style: ManuscriptStyle = {},
  language: 'en' | 'pt' = 'en',
): CompiledManuscript {
  const present = blockPresenterFor(style, language);
  const finished = finishPresentedManuscript(
    manuscript.title,
    manuscript.blocks.map(present),
    style,
  );
  // The pictures and their frame ride along: presenting changes words, never what a page shows.
  return {
    ...finished,
    ...(manuscript.images ? { images: manuscript.images } : {}),
    ...(manuscript.pageAspect !== undefined ? { pageAspect: manuscript.pageAspect } : {}),
  };
}

/**
 * The tail half of `presentManuscript` over already-presented blocks: front
 * matter plus title fill. The pipeline's fused path ends here instead of
 * mapping a second full copy of every span.
 */
export function finishPresentedManuscript(
  title: string,
  blocks: CompiledBlock[],
  style: ManuscriptStyle = {},
): CompiledManuscript {
  const fill = fillFor(style);
  const out = [...blocks];
  // The generated title page: its lines follow the title block (and a route's subtitle).
  const frontMatter = (style.frontMatter ?? []).map(fill).filter((line) => line.trim() !== '');
  if (frontMatter.length > 0) {
    let at = 0;
    while (at < out.length && (out[at]!.kind === 'title' || out[at]!.kind === 'subtitle')) {
      at += 1;
    }
    out.splice(at, 0, ...frontMatter.map((text): CompiledBlock => ({ kind: 'subtitle', text })));
  }
  return { title: fill(title), blocks: out };
}
