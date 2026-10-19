import type { ArcMedium } from '../../metadata/ArcMedium';

/**
 * The frame a picture is shown in, in a comic or a storyboard: its shape, width over height. A page
 * keeps its picture whole inside the frame (`contain`) or fills the frame, cropping the picture
 * (centred) where it does not match (`cover`).
 */
export const PAGE_FORMATS = ['a5', 'comic-us', 'b5', 'wide'] as const;

export type PageFormat = (typeof PAGE_FORMATS)[number];

export function isPageFormat(value: unknown): value is PageFormat {
  return typeof value === 'string' && (PAGE_FORMATS as readonly string[]).includes(value);
}

/** Width over height of each frame. */
export const PAGE_FORMAT_ASPECT: Record<PageFormat, number> = {
  /** A5, 148 x 210 mm. */
  a5: 148 / 210,
  /** The American comic book page, 6.625 x 10.25 in. */
  'comic-us': 6.625 / 10.25,
  /** B5 (manga), 176 x 250 mm. */
  b5: 176 / 250,
  /** 16:9, a storyboard frame. */
  wide: 16 / 9,
};

/** What each medium frames its pictures in until the arc says otherwise. */
export const DEFAULT_PAGE_FORMAT: Record<ArcMedium, PageFormat> = {
  generic: 'a5',
  screenplay: 'a5',
  comic: 'comic-us',
  storyboard: 'wide',
  campaign: 'a5',
};

/** The format in effect: the arc's own choice, else its medium's. */
export function pageFormatFor(
  medium: ArcMedium,
  chosen: PageFormat | null | undefined,
): PageFormat {
  return chosen ?? DEFAULT_PAGE_FORMAT[medium];
}

/**
 * How the pages of a comic or a storyboard are laid out in a document.
 *  - `flow`: a caption, the picture across the width of the page, the text under it, one after another.
 *  - `sheet`: a planning sheet - the picture beside its text, as a script goes to an artist.
 *  - `spreads`: the pages in pairs as a printed comic opens (the first page alone on the right), pictures only.
 */
export const PAGE_LAYOUTS = ['flow', 'sheet', 'spreads'] as const;

export type PageLayout = (typeof PAGE_LAYOUTS)[number];

export function isPageLayout(value: unknown): value is PageLayout {
  return typeof value === 'string' && (PAGE_LAYOUTS as readonly string[]).includes(value);
}

/** What each medium lays its pages out as until the person chooses: a plan is read as a sheet. */
export const DEFAULT_PAGE_LAYOUT: Record<ArcMedium, PageLayout> = {
  generic: 'flow',
  screenplay: 'flow',
  comic: 'sheet',
  storyboard: 'sheet',
  campaign: 'flow',
};

/** The layout in effect for a work of this medium. */
export function pageLayoutFor(
  medium: ArcMedium,
  chosen: PageLayout | null | undefined,
): PageLayout {
  return chosen ?? DEFAULT_PAGE_LAYOUT[medium];
}
