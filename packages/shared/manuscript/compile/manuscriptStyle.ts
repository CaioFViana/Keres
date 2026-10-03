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

export const MANUSCRIPT_PRESETS = ['ebook', 'paperback', 'submission'] as const;
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

/**
 * The compiled manuscript as the style presents it. Pure: the renderers only ever draw what this
 * hands them. `language` picks the words of spelled-out chapter numbers.
 */
export function presentManuscript(
  manuscript: CompiledManuscript,
  style: ManuscriptStyle = {},
  language: 'en' | 'pt' = 'en',
): CompiledManuscript {
  const placeholders = style.placeholders ?? {};
  const fill = (text: string) =>
    Object.keys(placeholders).length === 0
      ? text
      : text.replace(/<\$([a-z]{1,20})>/g, (whole, name: string) => placeholders[name] ?? whole);
  const plain = (text: string) =>
    presentSpans(
      [{ text, bold: false, italic: false, underline: false, strikethrough: false }],
      style,
      fill,
    )[0]!.text;
  const numbering = style.chapterNumbering ?? 'arabic';

  const blocks: CompiledBlock[] = [];
  for (const block of manuscript.blocks) {
    switch (block.kind) {
      case 'title':
      case 'subtitle':
        blocks.push({ ...block, text: fill(block.text) });
        break;
      case 'chapter': {
        if (block.number === null || numbering === 'arabic') {
          blocks.push(block);
        } else if (numbering === 'none') {
          blocks.push({ ...block, number: null });
        } else {
          const label =
            numbering === 'roman'
              ? romanNumeral(block.number)
              : numberInWords(block.number, language);
          blocks.push({ ...block, number: null, name: `${label}. ${block.name}` });
        }
        break;
      }
      case 'paragraph':
      case 'bullet':
      case 'ordered':
        blocks.push({ ...block, spans: presentSpans(block.spans, style, fill) });
        break;
      case 'choice':
        blocks.push({ ...block, text: plain(block.text) });
        break;
      default:
        blocks.push(block);
    }
  }
  // The generated title page: its lines follow the title block (and a route's subtitle).
  const frontMatter = (style.frontMatter ?? []).map(fill).filter((line) => line.trim() !== '');
  if (frontMatter.length > 0) {
    let at = 0;
    while (
      at < blocks.length &&
      (blocks[at]!.kind === 'title' || blocks[at]!.kind === 'subtitle')
    ) {
      at += 1;
    }
    blocks.splice(at, 0, ...frontMatter.map((text): CompiledBlock => ({ kind: 'subtitle', text })));
  }
  return { title: fill(manuscript.title), blocks };
}
