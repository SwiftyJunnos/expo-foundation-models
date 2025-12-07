import { NativeModule, requireNativeModule } from 'expo';

import type { ExpoFoundationModelsModuleEvents, GenerationOptions } from './ExpoFoundationModels.types';

declare class ExpoFoundationModelsModule extends NativeModule<ExpoFoundationModelsModuleEvents> {
  // CoreML methods
  loadModel(modelName: string): Promise<string>;
  unloadModel(modelId: string): Promise<void>;
  predict(modelId: string, input: Record<string, unknown>): Promise<Record<string, unknown>>;
  isModelLoaded(modelId: string): boolean;
  getLoadedModels(): string[];

  // Foundation Models methods
  isAvailable(): boolean;
  createSession(instructions: string | null): Promise<string>;
  closeSession(sessionId: string): Promise<void>;
  respond(sessionId: string, prompt: string, options: GenerationOptions | null): Promise<string>;
  streamResponse(sessionId: string, prompt: string, options: GenerationOptions | null): Promise<string>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<ExpoFoundationModelsModule>('ExpoFoundationModels');
