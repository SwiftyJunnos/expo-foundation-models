import { NativeModule, requireNativeModule } from 'expo';

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

declare class ExpoFoundationModelsModule extends NativeModule<ExpoFoundationModelsModuleEvents> {
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

// This call loads the native module object from the JSI.
export default requireNativeModule<ExpoFoundationModelsModule>('ExpoFoundationModels');
