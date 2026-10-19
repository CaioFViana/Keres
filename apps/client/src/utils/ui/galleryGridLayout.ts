/** The widest a gallery tile grows before another column is added. */
const MAX_TILE = 240;
/** The narrowest a card gets; below it the grid drops to one column. */
const MIN_CARD = 150;
const MIN_COLUMNS = 2;
/** `GalleryGridItem` keeps a 5 px margin on each side. */
const TILE_MARGIN = 5;
/** The padding `GenericFilterSortList` puts around its content. */
export const GALLERY_LIST_PADDING = 10;
/** The padding of each row of tiles (the screen's `columnWrapperStyle`), which the list applies only to a grid. */
export const GALLERY_ROW_PADDING = 5;

export interface GalleryGridLayout {
  numColumns: number;
  /** The width of every card; all have it, so a short last row does not stretch its tiles. */
  cardWidth: number;
}

/**
 * Columns and card width for a gallery list of the given width. The number of columns follows the width
 * of the list itself (not the window's: the drawer takes part of it), so a wide screen shows more tiles
 * of about the same size instead of a few huge ones. `scrollbar` is the width a scrollbar inside the
 * list takes from it.
 */
export function galleryGridLayout(listWidth: number, scrollbar = 0): GalleryGridLayout {
  const available = listWidth - 2 * GALLERY_LIST_PADDING - scrollbar;
  const inner = Math.max(0, available - 2 * GALLERY_ROW_PADDING);
  const wanted = Math.max(MIN_COLUMNS, Math.ceil(inner / MAX_TILE));
  // On a very small screen one wide tile beats two cramped ones.
  const fitting = Math.max(1, Math.floor(inner / (MIN_CARD + TILE_MARGIN * 2)));
  const numColumns = Math.min(wanted, fitting);
  // A single column is a plain list: it has no row padding to leave room for.
  const row = numColumns > 1 ? inner : Math.max(0, available);
  const cardWidth = Math.max(0, Math.floor(row / numColumns) - TILE_MARGIN * 2);
  return { numColumns, cardWidth };
}

/**
 * How much of the list's width a scrollbar takes: the list's own width (the screen's, less the list's
 * padding) minus the width of its content. Zero where scrollbars float over the content.
 */
export function galleryScrollbarWidth(listWidth: number, contentWidth: number): number {
  if (listWidth <= 0 || contentWidth <= 0) return 0;
  return Math.max(0, Math.round(listWidth - 2 * GALLERY_LIST_PADDING - contentWidth));
}
