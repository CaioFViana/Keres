const { TestEnvironment: JSDOMEnvironment } = require('jest-environment-jsdom');

/**
 * jsdom for the suites that exercise the web branches (`@jest-environment ./test/helpers/jsdomEnvironment.js`).
 *
 * The React Native preset's setup (0.88) defines `window` on the global with `Object.defineProperties`, which
 * throws `Cannot redefine property: window` where the global already is a jsdom window: its `window` is not
 * configurable. Inside jsdom `window` already is the global, which is all that line sets it to, so the
 * definition is dropped instead.
 *
 * Also what jsdom 26 took away and the suites still lean on: `window.location` can no longer be redefined (tests move
 * to another URL through `setJsdomUrl`), and `setImmediate`/`clearImmediate`, which React Native's animated helper calls,
 * are no longer on the window.
 */
class ReactNativeJSDOMEnvironment extends JSDOMEnvironment {
  constructor(config, context) {
    super(config, context);
    const sandbox = this.global;
    sandbox.setImmediate = setImmediate;
    sandbox.clearImmediate = clearImmediate;
    Object.defineProperty(sandbox, '__reconfigureJsdomUrl', {
      configurable: true,
      value: (url) => this.dom.reconfigure({ url }),
    });
    const defineProperties = sandbox.Object.defineProperties;
    sandbox.Object.defineProperties = function patchedDefineProperties(target, properties) {
      if (target === sandbox && properties && 'window' in properties) {
        const { window: _window, ...rest } = properties;
        return defineProperties.call(this, target, rest);
      }
      return defineProperties.call(this, target, properties);
    };
  }
}

module.exports = ReactNativeJSDOMEnvironment;
module.exports.TestEnvironment = ReactNativeJSDOMEnvironment;
