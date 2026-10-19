/**
 * Test-only: turns `import('x')` into the CommonJS equivalent.
 *
 * Metro (the app) understands `import()` and turns it into a chunk; Jest runs the files as CommonJS and its
 * VM refuses a dynamic import without `--experimental-vm-modules`. `babel-preset-expo` leaves the call as
 * it is, and the one plugin that rewrites it (`dynamic-import-node`) is not a dependency here. So the
 * lazy `import()` of the example stories (and of anything else loaded that way) would throw under test.
 *
 * The result has the namespace shape `import()` gives - `default` plus the named exports - so code written
 * for the bundler (`.then((module) => module.default)`) reads the same here.
 */
module.exports = function dynamicImportToRequire({ template }) {
  const loader = template.expression(`
    Promise.resolve().then(() => {
      const loaded = require(SOURCE);
      return loaded && loaded.__esModule ? loaded : Object.assign({ default: loaded }, loaded);
    })
  `);
  return {
    name: 'keres-dynamic-import-to-require',
    visitor: {
      CallExpression(path) {
        if (path.node.callee.type !== 'Import') return;
        path.replaceWith(loader({ SOURCE: path.node.arguments[0] }));
      },
    },
  };
};
