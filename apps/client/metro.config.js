const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add custom resolver for TypeScript path aliases
config.resolver.alias = {
  ...config.resolver.alias,
  '@': path.resolve(__dirname, '.'),
};

// Ensure Metro looks for modules in the correct places, especially for monorepos
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, './node_modules'),
  path.resolve(__dirname, '../../node_modules'), // For monorepo setup
];

module.exports = config;