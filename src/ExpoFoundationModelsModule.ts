import { NativeModule, requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import type {
  AdapterDownloadStatus,
  AdapterInfo,
  Availability,
  CreateSessionWithTranscriptOptions,
  ExpoFoundationModelsModuleEvents,
  ExtendedSessionOptions,
  FeedbackOptions,
  FeedbackResult,
  GenerationOptions,
  JSONSchema,
  LoadAdapterOptions,
  PrewarmOptions,
  SessionOptions,
  ToolResponse,
  ToolResult,
  TranscriptEntry,
} from './ExpoFoundationModels.types';

declare class ExpoFoundationModelsModuleType extends NativeModule<ExpoFoundationModelsModuleEvents> {
  // CoreML methods
  loadModel(modelName: string): Promise<string>;
  unloadModel(modelId: string): Promise<void>;
  predict(modelId: string, input: Record<string, unknown>): Promise<Record<string, unknown>>;
  isModelLoaded(modelId: string): boolean;
  getLoadedModels(): string[];

  // Foundation Models - Availability
  isAvailable(): boolean;
  getAvailability(): Availability;

  // Foundation Models - Session Management
  createSession(instructions: string | null): Promise<string>;
  createSessionWithConfig(options: ExtendedSessionOptions): Promise<string>;
  createSessionWithTools(options: SessionOptions): Promise<string>;
  createSessionWithTranscript(options: CreateSessionWithTranscriptOptions): Promise<string>;
  closeSession(sessionId: string): Promise<void>;
  getTranscript(sessionId: string): Promise<TranscriptEntry[]>;
  prewarm(sessionId: string, options: PrewarmOptions | null): Promise<void>;

  // Foundation Models - Text Generation
  respond(sessionId: string, prompt: string, options: GenerationOptions | null): Promise<string>;
  streamResponse(
    sessionId: string,
    prompt: string,
    options: GenerationOptions | null
  ): Promise<string>;

  // Foundation Models - Structured Output
  respondWithSchema(
    sessionId: string,
    prompt: string,
    schema: JSONSchema,
    options: GenerationOptions | null
  ): Promise<Record<string, unknown>>;
  respondWithChoices(
    sessionId: string,
    prompt: string,
    choices: string[],
    options: GenerationOptions | null
  ): Promise<string>;
  streamWithSchema(
    sessionId: string,
    prompt: string,
    schema: JSONSchema,
    options: GenerationOptions | null
  ): Promise<Record<string, unknown>>;

  // Foundation Models - Tool Calling
  respondWithTools(
    sessionId: string,
    prompt: string,
    options: GenerationOptions | null
  ): Promise<ToolResponse>;
  submitToolResult(sessionId: string, toolResult: ToolResult): Promise<ToolResponse>;
  streamWithTools(
    sessionId: string,
    prompt: string,
    options: GenerationOptions | null
  ): Promise<ToolResponse>;

  // Foundation Models - Adapters
  loadAdapter(name: string, options: LoadAdapterOptions | null): Promise<AdapterInfo>;
  loadAdapterFromFile(filePath: string, options: LoadAdapterOptions | null): Promise<AdapterInfo>;
  compileAdapter(adapterId: string): Promise<void>;
  unloadAdapter(adapterId: string): Promise<void>;
  getAdapterDownloadStatus(name: string): Promise<AdapterDownloadStatus>;
  removeObsoleteAdapters(): Promise<void>;
  isAdapterCompatible(name: string): Promise<boolean>;

  // Foundation Models - Feedback
  logFeedback(sessionId: string, options: FeedbackOptions): Promise<FeedbackResult>;
}

// Lazy load the native module to prevent crashes during app initialization
let _nativeModule: ExpoFoundationModelsModuleType | null = null;
let _loadAttempted = false;
let _loadError: Error | null = null;

/**
 * Check if the native module is available without throwing
 */
export function isNativeModuleAvailable(): boolean {
  if (Platform.OS !== 'ios') {
    return false;
  }
  if (_loadAttempted) {
    return _nativeModule !== null;
  }
  // Try to load the module
  _loadAttempted = true;
  _nativeModule = requireOptionalNativeModule<ExpoFoundationModelsModuleType>('ExpoFoundationModels');
  if (!_nativeModule) {
    console.warn('[ExpoFoundationModels] Native module not available - module may not be properly linked');
  }
  return _nativeModule !== null;
}

function getNativeModule(): ExpoFoundationModelsModuleType {
  if (_loadError) {
    throw _loadError;
  }
  if (!_nativeModule) {
    if (Platform.OS !== 'ios') {
      throw new Error('ExpoFoundationModels is only available on iOS');
    }
    if (!_loadAttempted) {
      _loadAttempted = true;
      _nativeModule = requireOptionalNativeModule<ExpoFoundationModelsModuleType>('ExpoFoundationModels');
    }
    if (!_nativeModule) {
      _loadError = new Error(
        'Cannot find native module ExpoFoundationModels. ' +
        'Make sure the native module is properly linked and try running `pod install` in the ios directory.'
      );
      console.error('[ExpoFoundationModels] Failed to load native module:', _loadError.message);
      throw _loadError;
    }
  }
  return _nativeModule;
}

// Create a proxy that lazily loads the native module on first access
const ExpoFoundationModelsModule = new Proxy({} as ExpoFoundationModelsModuleType, {
  get(_target, prop: string | symbol) {
    // Special case for addListener which needs to work for event subscriptions
    if (prop === 'addListener') {
      return (...args: Parameters<ExpoFoundationModelsModuleType['addListener']>) => {
        return getNativeModule().addListener(...args);
      };
    }
    
    const nativeModule = getNativeModule();
    const value = nativeModule[prop as keyof ExpoFoundationModelsModuleType];
    
    // Bind methods to the native module
    if (typeof value === 'function') {
      return value.bind(nativeModule);
    }
    
    return value;
  },
});

export default ExpoFoundationModelsModule;
