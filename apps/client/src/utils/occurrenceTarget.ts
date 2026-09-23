/**
 * A text occurrence a detail screen should land on: scroll `field` into view,
 * flashing `needle` where it sits. Backlink rows and global search results
 * navigate with one; detail screens consume it through the landing context.
 */
export interface OccurrenceTarget {
  /** Schema field key (`biography`) or custom-attribute key (`custom:<fieldId>`). */
  field: string;
  /**
   * Surface text located in the rendered value at landing time. Absent (or not
   * found) scrolls to the field without flashing - entity links and formatted
   * values land this way.
   */
  needle?: string;
}
