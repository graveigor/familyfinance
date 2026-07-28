// Metro em monorepo: por padrão ele só olha a pasta do app, então precisa ser
// avisado de onde ficam o @gastos/core e os node_modules da raiz.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const raizDoApp = __dirname;
const raizDoMonorepo = path.resolve(raizDoApp, '../..');

const config = getDefaultConfig(raizDoApp);

config.watchFolders = [raizDoMonorepo];
config.resolver.nodeModulesPaths = [
  path.resolve(raizDoApp, 'node_modules'),
  path.resolve(raizDoMonorepo, 'node_modules'),
];

// `disableHierarchicalLookup` NÃO entra aqui. Ele é a receita para pnpm e yarn,
// onde a árvore é plana; com npm, pacotes de versão conflitante ficam aninhados
// (expo-modules-core mora dentro de expo/node_modules) e desligar a busca
// hierárquica faz o Metro não encontrá-los.

module.exports = config;
