/**
 * The only icon family the app draws, and so the only one it ships.
 *
 * `@expo/vector-icons` is a barrel over twenty families, and a bundler that follows its `import` keeps
 * the glyph map of each (~430 KB of JavaScript) and emits each one's font (4 MB in the export, the
 * installer and the Pages artifact), to draw a hundred and some icons of one of them. Everything the app
 * imports from `@expo/vector-icons` is resolved to this file instead - by Metro (`metro.config.js`) and by
 * TypeScript (`paths` in `tsconfig.json`) alike, so an import of a family that is not here fails to
 * compile instead of coming out `undefined` on a device.
 *
 * Need another family? Export it here; that is the whole cost.
 */
export { default as Ionicons } from '@expo/vector-icons/Ionicons';
