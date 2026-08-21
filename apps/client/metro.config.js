const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Metro default is (cpus − 1) transformer workers, each its own Node heap. Docker
// Desktop / WSL2 reports the host CPU count against a much smaller memory budget, so
// `expo export` would spawn a dozen workers and freeze the machine. CI (GitHub and
// the API image build) keeps a single worker; a local export on a large machine stays
// parallel.
if (process.env.CI) {
  config.maxWorkers = 1;
}

// expo-sqlite's web implementation (wa-sqlite, used by the "web" export - see
// apps/desktop) imports a .wasm file as an asset. Metro's default config doesn't treat
// .wasm as an asset extension, so without this the web bundler can't resolve it.
config.resolver.assetExts.push('wasm');

// zustand's ESM build (the one Metro picks up by default via package.json's "import"
// export condition) has a Vite-style `import.meta.env` check baked into devtools() -
// unused here, but shipped in the same file as the persist()/createJSONStorage() this
// project does use. That's a hard SyntaxError once Metro serves the bundle as a classic
// <script> (no type="module") in the web export - see apps/desktop. zustand's CJS build
// has no import.meta at all, so force Metro to resolve zustand there on every platform.
const zustandRoot = path.dirname(require.resolve('zustand/package.json'));
const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'zustand' || moduleName.startsWith('zustand/')) {
    const subpath = moduleName === 'zustand' ? 'index' : moduleName.slice('zustand/'.length);
    return { type: 'sourceFile', filePath: path.join(zustandRoot, `${subpath}.js`) };
  }
  return upstreamResolveRequest
    ? upstreamResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
