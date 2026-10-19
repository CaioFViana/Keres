module.exports = function (api) {
  // `api.env` also settles the cache key: the config differs between a test run and a build.
  const isTest = api.env('test');
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
      // See the plugin: Jest cannot run a dynamic `import()` the way Metro does.
      ...(isTest ? [require('./babel/dynamicImportToRequire')] : []),
    ],
  };
};
