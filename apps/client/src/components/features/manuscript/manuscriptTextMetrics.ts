/**
 * The single source of manuscript text metrics, shared by the prose editor
 * (`RichBodyEditor`) and the reader (`MarkdownPreview`).
 *
 * Both render body text with these exact numbers so toggling between writing
 * and reading never shifts the layout: editing must feel like an existing
 * passage became editable, not like a field was inserted into the document.
 */
export const manuscriptTextMetrics = {
  fontSize: 17,
  lineHeight: 28,
  /** Vertical rhythm between rendered blocks (the raw input uses blank lines). */
  paragraphSpacing: 14,
  containerPaddingHorizontal: 20,
  containerPaddingVertical: 16,
} as const;
