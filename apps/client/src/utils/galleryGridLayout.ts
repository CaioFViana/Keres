/** The widest a gallery tile grows before another column is added. */
const MAX_TILE = 240;
/** The narrowest a card gets; below it the grid drops to one column. */
const MIN_CARD = 150;
const MIN_COLUMNS = 2;
/** `GalleryGridItem` keeps a 5 px margin on each side. */
const TILE_MARGIN = 5;
/** The padding `GenericFilterSortList` puts around its content. */
const LIST_PADDING = 10;
/** The padding of each row of tiles (the screen's `columnWrapperStyle`). */
export const GALLERY_ROW_PADDING = 5;
/** What a classic (non-overlay) vertical scrollbar takes from the list, which the list's own width hides. */
export const WEB_SCROLLBAR_ALLOWANCE = 16;

export interface GalleryGridLayout {
  numColumns: number;
  /** The width of every card; all have it, so a short last row does not stretch its tiles. */
  cardWidth: number;
}

/**
 * Columns and card width for a gallery list of the given width. The number of columns follows the width
 * of the list itself (not the window's: the drawer takes part of it), so a wide screen shows more tiles
 * of about the same size instead of a few huge ones. `scrollbar` is the width kept free for a scrollbar
 * that sits inside the list.
 */
export function galleryGridLayout(listWidth: number, scrollbar = 0): GalleryGridLayout {
  const sides = 2 * (LIST_PADDING + GALLERY_ROW_PADDING);
  const inner = Math.max(0, listWidth - sides - scrollbar);
  const wanted = Math.max(MIN_COLUMNS, Math.ceil(inner / MAX_TILE));
  // On a very small screen one wide tile beats two cramped ones.
  const fitting = Math.max(1, Math.floor(inner / (MIN_CARD + TILE_MARGIN * 2)));
  const numColumns = Math.min(wanted, fitting);
  const cardWidth = Math.max(0, Math.floor(inner / numColumns) - TILE_MARGIN * 2);
  return { numColumns, cardWidth };
}
