// Reexport the native module. On web, it will be resolved to ExpoFoundationModelsModule.web.ts
// and on native platforms to ExpoFoundationModelsModule.ts
export { default } from './ExpoFoundationModelsModule';
export { default as ExpoFoundationModelsView } from './ExpoFoundationModelsView';
export * from  './ExpoFoundationModels.types';
