const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch all files in the monorepo
config.watchFolders = [monorepoRoot];

// Let Metro resolve packages from both the project and monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Resolve .js imports to .ts source files (NodeNext requires .js extensions
// in TS imports but Metro needs to find the actual .ts files)
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.endsWith('.js')) {
    const tsName = moduleName.replace(/\.js$/, '.ts');
    try {
      return context.resolveRequest(context, tsName, platform);
    } catch {}
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
