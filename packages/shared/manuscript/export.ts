/**
 * The manuscript renderers that carry heavy libraries: DOCX (`docx`) and EPUB (`jszip`), and the
 * entry points that dispatch to them. Deliberately NOT in the `@keres/shared` barrel: a barrel
 * pulls everything it re-exports into every bundle that touches it, and an admin panel or a reader
 * has no use for a word-processor writer.
 *
 * Import from `@keres/shared/manuscript/export`. The blocks themselves (`presentedManuscriptOf`,
 * the Markdown/HTML/text/PDF renderers) stay in the barrel.
 */
export * from './compile/export/manuscriptDocx';
export * from './compile/export/manuscriptEpub';
export * from './compile/export/manuscriptPdfFonts';
export * from './compile/manuscriptRender';
export * from './compile/compileStoryManuscript';
