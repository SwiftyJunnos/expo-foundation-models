import { Platform } from 'react-native';
import ExpoFoundationModelsModule from './ExpoFoundationModelsModule';
import type {
  MLValue,
  MLDictionary,
  GenerationOptions,
  SamplingMode,
  TokenEvent,
  Availability,
  AvailabilityStatus,
  UnavailableReason,
  GenerationErrorType,
  GenerationErrorInfo,
  JSONSchema,
  JSONSchemaType,
  PartialSchemaEvent,
  Tool,
  ToolCall,
  ToolResult,
  ToolResponse,
  SessionOptions,
  StreamWithToolsCallbacks,
  ToolCallEvent,
  TranscriptEntry,
  TranscriptEntryType,
  PrewarmOptions,
  CreateSessionWithTranscriptOptions,
  GuardrailsMode,
  ModelUseCase,
  ExtendedSessionOptions,
  AdapterDownloadStatus,
  AdapterInfo,
  LoadAdapterOptions,
  AdapterDownloadEvent,
  FeedbackSentiment,
  FeedbackIssueCategory,
  FeedbackIssue,
  FeedbackOptions,
  FeedbackResult,
} from './ExpoFoundationModels.types';

export type {
  MLValue,
  MLDictionary,
  GenerationOptions,
  SamplingMode,
  TokenEvent,
  Availability,
  AvailabilityStatus,
  UnavailableReason,
  GenerationErrorType,
  GenerationErrorInfo,
  JSONSchema,
  JSONSchemaType,
  PartialSchemaEvent,
  Tool,
  ToolCall,
  ToolResult,
  ToolResponse,
  SessionOptions,
  StreamWithToolsCallbacks,
  ToolCallEvent,
  TranscriptEntry,
  TranscriptEntryType,
  PrewarmOptions,
  CreateSessionWithTranscriptOptions,
  GuardrailsMode,
  ModelUseCase,
  ExtendedSessionOptions,
  AdapterDownloadStatus,
  AdapterInfo,
  LoadAdapterOptions,
  AdapterDownloadEvent,
  FeedbackSentiment,
  FeedbackIssueCategory,
  FeedbackIssue,
  FeedbackOptions,
  FeedbackResult,
};

/**
 * Error thrown when CoreML operations fail.
 */
export class CoreMLError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'CoreMLError';
  }
}

/**
 * Error thrown when Foundation Models operations fail.
 *
 * @example
 * ```typescript
 * try {
 *   await FoundationModels.respond(sessionId, prompt);
 * } catch (error) {
 *   if (error instanceof FoundationModelsError) {
 *     switch (error.type) {
 *       case 'guardrailViolation':
 *         console.log('Content blocked by safety filters');
 *         break;
 *       case 'refusal':
 *         console.log('Model refused:', error.refusalExplanation);
 *         break;
 *     }
 *   }
 * }
 * ```
 */
export class FoundationModelsError extends Error {
  /** The type of generation error */
  public readonly type: GenerationErrorType;

  /** For refusal errors, explanation of why the model refused */
  public readonly refusalExplanation?: string;

  /** Additional error context */
  public readonly context?: string;

  /** Legacy error code (for backward compatibility) */
  public readonly code?: string;

  constructor(
    message: string,
    options?: {
      type?: GenerationErrorType;
      code?: string;
      refusalExplanation?: string;
      context?: string;
    }
  ) {
    super(message);
    this.name = 'FoundationModelsError';
    this.type = options?.type ?? 'unknown';
    this.code = options?.code;
    this.refusalExplanation = options?.refusalExplanation;
    this.context = options?.context;
  }

  /** Check if this is a guardrail violation error */
  isGuardrailViolation(): boolean {
    return this.type === 'guardrailViolation';
  }

  /** Check if this is a refusal error */
  isRefusal(): boolean {
    return this.type === 'refusal';
  }

  /** Convert to a plain object for serialization */
  toJSON(): GenerationErrorInfo {
    return {
      type: this.type,
      message: this.message,
      refusalExplanation: this.refusalExplanation,
      context: this.context,
    };
  }
}

/**
 * CoreML - Expo bridge for Apple CoreML models.
 *
 * @example
 * ```typescript
 * import { CoreML } from 'expo-foundation-models';
 *
 * // Load a model
 * const modelId = await CoreML.loadModel('MyClassifier');
 *
 * // Run prediction
 * const result = await CoreML.predict(modelId, {
 *   inputFeature: [1.0, 2.0, 3.0, 4.0],
 * });
 *
 * // Cleanup
 * await CoreML.unloadModel(modelId);
 * ```
 */
export const CoreML = {
  /**
   * Load a CoreML model from the app bundle.
   *
   * The model must be added to your Xcode project and included in the app target.
   * Xcode will compile .mlmodel or .mlpackage files to .mlmodelc at build time.
   *
   * @param modelName - Name of the model (without extension)
   * @returns Promise resolving to a unique model ID
   * @throws {CoreMLError} If model cannot be found or loaded
   */
  async loadModel(modelName: string): Promise<string> {
    if (!modelName || typeof modelName !== 'string') {
      throw new CoreMLError('Model name must be a non-empty string');
    }

    if (Platform.OS !== 'ios') {
      throw new CoreMLError('CoreML is only available on iOS', 'PLATFORM_NOT_SUPPORTED');
    }

    try {
      return await ExpoFoundationModelsModule.loadModel(modelName);
    } catch (error) {
      throw new CoreMLError(
        `Failed to load model '${modelName}': ${error instanceof Error ? error.message : String(error)}`,
        'LOAD_FAILED'
      );
    }
  },

  /**
   * Unload a model to free memory.
   *
   * @param modelId - The model ID returned from loadModel
   * @throws {CoreMLError} If model is not loaded
   */
  async unloadModel(modelId: string): Promise<void> {
    if (!modelId || typeof modelId !== 'string') {
      throw new CoreMLError('Model ID must be a non-empty string');
    }

    if (Platform.OS !== 'ios') {
      throw new CoreMLError('CoreML is only available on iOS', 'PLATFORM_NOT_SUPPORTED');
    }

    try {
      await ExpoFoundationModelsModule.unloadModel(modelId);
    } catch (error) {
      throw new CoreMLError(
        `Failed to unload model '${modelId}': ${error instanceof Error ? error.message : String(error)}`,
        'UNLOAD_FAILED'
      );
    }
  },

  /**
   * Run prediction on a loaded model.
   *
   * @param modelId - The model ID returned from loadModel
   * @param input - Dictionary of input features matching the model's input specification
   * @returns Promise resolving to prediction output dictionary
   * @throws {CoreMLError} If prediction fails
   */
  async predict(modelId: string, input: MLDictionary): Promise<MLDictionary> {
    if (!modelId || typeof modelId !== 'string') {
      throw new CoreMLError('Model ID must be a non-empty string');
    }

    if (!input || typeof input !== 'object') {
      throw new CoreMLError('Input must be an object');
    }

    if (Platform.OS !== 'ios') {
      throw new CoreMLError('CoreML is only available on iOS', 'PLATFORM_NOT_SUPPORTED');
    }

    try {
      const result = await ExpoFoundationModelsModule.predict(modelId, input);
      return result as MLDictionary;
    } catch (error) {
      throw new CoreMLError(
        `Prediction failed: ${error instanceof Error ? error.message : String(error)}`,
        'PREDICTION_FAILED'
      );
    }
  },

  /**
   * Check if a model is currently loaded.
   *
   * @param modelId - The model ID to check
   * @returns true if model is loaded, false otherwise
   */
  isModelLoaded(modelId: string): boolean {
    if (!modelId || typeof modelId !== 'string') {
      return false;
    }
    if (Platform.OS !== 'ios') {
      return false;
    }
    return ExpoFoundationModelsModule.isModelLoaded(modelId);
  },

  /**
   * Get list of all currently loaded model IDs.
   *
   * @returns Array of model IDs
   */
  getLoadedModels(): string[] {
    if (Platform.OS !== 'ios') {
      return [];
    }
    return ExpoFoundationModelsModule.getLoadedModels();
  },
};

/**
 * FoundationModels - Expo bridge for Apple Intelligence on-device LLM.
 *
 * @example
 * ```typescript
 * import { FoundationModels } from 'expo-foundation-models';
 *
 * // Check availability
 * if (FoundationModels.isAvailable()) {
 *   // Create session
 *   const sessionId = await FoundationModels.createSession('You are helpful.');
 *
 *   // Generate response
 *   const response = await FoundationModels.respond(sessionId, 'Hello!');
 *
 *   // Cleanup
 *   await FoundationModels.closeSession(sessionId);
 * }
 * ```
 */
export const FoundationModels = {
  /**
   * Check if Foundation Models (Apple Intelligence) is available.
   * Requires iOS 26+ and Apple Silicon device.
   *
   * @returns true if Foundation Models is available
   */
  isAvailable(): boolean {
    if (Platform.OS !== 'ios') {
      return false;
    }
    return ExpoFoundationModelsModule.isAvailable();
  },

  /**
   * Get detailed availability information for Foundation Models.
   *
   * This provides more context than `isAvailable()`, including the specific
   * reason why Foundation Models may be unavailable.
   *
   * @returns Availability object with status and optional reason
   *
   * @example
   * ```typescript
   * const availability = FoundationModels.getAvailability();
   * if (!availability.available) {
   *   switch (availability.reason) {
   *     case 'deviceNotEligible':
   *       console.log('This device does not support Apple Intelligence');
   *       break;
   *     case 'appleIntelligenceNotEnabled':
   *       console.log('Please enable Apple Intelligence in Settings');
   *       break;
   *     case 'modelNotReady':
   *       console.log('Model is still downloading...');
   *       break;
   *   }
   * }
   * ```
   */
  getAvailability(): Availability {
    if (Platform.OS !== 'ios') {
      return {
        available: false,
        status: 'unavailable',
        reason: 'platformNotSupported',
      };
    }
    return ExpoFoundationModelsModule.getAvailability() as Availability;
  },

  /**
   * Create a new Foundation Models session.
   *
   * @param optionsOrInstructions - Session options or legacy string instructions
   * @returns Promise resolving to a session ID
   * @throws {FoundationModelsError} If session creation fails
   *
   * @example
   * ```typescript
   * // Legacy API with string instructions
   * const sessionId = await FoundationModels.createSession('You are helpful');
   *
   * // New API with options object
   * const sessionId = await FoundationModels.createSession({
   *   instructions: 'You are helpful',
   *   guardrails: 'default',
   *   useCase: 'general'
   * });
   *
   * // Permissive mode for content transformation
   * const sessionId = await FoundationModels.createSession({
   *   guardrails: 'permissiveContentTransformations'
   * });
   * ```
   */
  async createSession(optionsOrInstructions?: string | ExtendedSessionOptions): Promise<string> {
    if (Platform.OS !== 'ios') {
      throw new FoundationModelsError('Foundation Models is only available on iOS', {
        type: 'notAvailable',
        code: 'PLATFORM_NOT_SUPPORTED',
      });
    }

    try {
      // Handle legacy string API
      if (optionsOrInstructions === undefined || typeof optionsOrInstructions === 'string') {
        return await ExpoFoundationModelsModule.createSession(optionsOrInstructions ?? null);
      }

      // Handle new options object API
      const options = optionsOrInstructions;

      // If options contain advanced config (tools, guardrails, useCase, or adapterId), use createSessionWithConfig
      if (options.tools && options.tools.length > 0 || options.guardrails || options.useCase || options.adapterId) {
        return await ExpoFoundationModelsModule.createSessionWithConfig({
          instructions: options.instructions,
          guardrails: options.guardrails,
          useCase: options.useCase,
          tools: options.tools,
          adapterId: options.adapterId,
        });
      }

      // Fall back to simple createSession for instructions-only
      return await ExpoFoundationModelsModule.createSession(options.instructions ?? null);
    } catch (error) {
      throw parseNativeError(error, 'Failed to create session', 'SESSION_FAILED');
    }
  },

  /**
   * Close a Foundation Models session.
   *
   * @param sessionId - The session ID to close
   * @throws {FoundationModelsError} If session is not found
   */
  async closeSession(sessionId: string): Promise<void> {
    if (!sessionId || typeof sessionId !== 'string') {
      throw new FoundationModelsError('Session ID must be a non-empty string', {
        type: 'sessionNotFound',
      });
    }

    try {
      await ExpoFoundationModelsModule.closeSession(sessionId);
    } catch (error) {
      throw parseNativeError(error, 'Failed to close session', 'CLOSE_FAILED');
    }
  },

  /**
   * Generate a response from the on-device LLM.
   *
   * @param sessionId - The session ID
   * @param prompt - The user prompt
   * @param options - Optional generation options
   * @returns Promise resolving to the generated text
   * @throws {FoundationModelsError} If generation fails
   */
  async respond(
    sessionId: string,
    prompt: string,
    options?: GenerationOptions
  ): Promise<string> {
    if (!sessionId || typeof sessionId !== 'string') {
      throw new FoundationModelsError('Session ID must be a non-empty string', {
        type: 'sessionNotFound',
      });
    }

    if (!prompt || typeof prompt !== 'string') {
      throw new FoundationModelsError('Prompt must be a non-empty string', {
        type: 'generationFailed',
      });
    }

    try {
      return await ExpoFoundationModelsModule.respond(sessionId, prompt, options ?? null);
    } catch (error) {
      throw parseNativeError(error, 'Generation failed', 'GENERATION_FAILED');
    }
  },

  /**
   * Stream a response from the on-device LLM token by token.
   *
   * @param sessionId - The session ID
   * @param prompt - The user prompt
   * @param onToken - Callback invoked for each generated token
   * @param options - Optional generation options
   * @returns Promise resolving to the complete generated text
   * @throws {FoundationModelsError} If streaming fails
   */
  async streamResponse(
    sessionId: string,
    prompt: string,
    onToken: (token: string) => void,
    options?: GenerationOptions
  ): Promise<string> {
    if (!sessionId || typeof sessionId !== 'string') {
      throw new FoundationModelsError('Session ID must be a non-empty string', {
        type: 'sessionNotFound',
      });
    }

    if (!prompt || typeof prompt !== 'string') {
      throw new FoundationModelsError('Prompt must be a non-empty string', {
        type: 'streamingFailed',
      });
    }

    const subscription = ExpoFoundationModelsModule.addListener('onToken', (event: TokenEvent) => {
      if (event.sessionId === sessionId) {
        onToken(event.token);
      }
    });

    try {
      const result = await ExpoFoundationModelsModule.streamResponse(
        sessionId,
        prompt,
        options ?? null
      );
      return result;
    } catch (error) {
      throw parseNativeError(error, 'Streaming failed', 'STREAMING_FAILED');
    } finally {
      subscription.remove();
    }
  },

  /**
   * Generate structured output conforming to a JSON schema.
   *
   * @param sessionId - The session ID
   * @param prompt - The user prompt
   * @param schema - JSON Schema defining the expected output structure
   * @param options - Optional generation options
   * @returns Promise resolving to an object matching the schema
   * @throws {FoundationModelsError} If generation fails
   *
   * @example
   * ```typescript
   * const personSchema = {
   *   type: 'object',
   *   properties: {
   *     name: { type: 'string' },
   *     age: { type: 'integer' }
   *   },
   *   required: ['name', 'age']
   * };
   *
   * const person = await FoundationModels.respondWithSchema(
   *   sessionId,
   *   'Generate a person profile',
   *   personSchema
   * );
   * // Returns: { name: "John", age: 30 }
   * ```
   */
  async respondWithSchema<T = Record<string, unknown>>(
    sessionId: string,
    prompt: string,
    schema: JSONSchema,
    options?: GenerationOptions
  ): Promise<T> {
    if (Platform.OS !== 'ios') {
      throw new FoundationModelsError('Foundation Models is only available on iOS', {
        type: 'notAvailable',
        code: 'PLATFORM_NOT_SUPPORTED',
      });
    }

    if (!sessionId || typeof sessionId !== 'string') {
      throw new FoundationModelsError('Session ID must be a non-empty string', {
        type: 'sessionNotFound',
      });
    }

    if (!prompt || typeof prompt !== 'string') {
      throw new FoundationModelsError('Prompt must be a non-empty string', {
        type: 'generationFailed',
      });
    }

    if (!schema || typeof schema !== 'object') {
      throw new FoundationModelsError('Schema must be a valid JSON Schema object', {
        type: 'generationFailed',
      });
    }

    try {
      const result = await ExpoFoundationModelsModule.respondWithSchema(
        sessionId,
        prompt,
        schema,
        options ?? null
      );
      return result as T;
    } catch (error) {
      throw parseNativeError(error, 'Schema generation failed', 'SCHEMA_GENERATION_FAILED');
    }
  },

  /**
   * Generate a response constrained to one of the provided choices.
   *
   * @param sessionId - The session ID
   * @param prompt - The user prompt
   * @param choices - Array of allowed response values
   * @param options - Optional generation options
   * @returns Promise resolving to one of the choices
   * @throws {FoundationModelsError} If generation fails
   *
   * @example
   * ```typescript
   * const sentiment = await FoundationModels.respondWithChoices(
   *   sessionId,
   *   'What is the sentiment of: "I love this!"',
   *   ['positive', 'negative', 'neutral']
   * );
   * // Returns: "positive"
   * ```
   */
  async respondWithChoices(
    sessionId: string,
    prompt: string,
    choices: string[],
    options?: GenerationOptions
  ): Promise<string> {
    if (Platform.OS !== 'ios') {
      throw new FoundationModelsError('Foundation Models is only available on iOS', {
        type: 'notAvailable',
        code: 'PLATFORM_NOT_SUPPORTED',
      });
    }

    if (!sessionId || typeof sessionId !== 'string') {
      throw new FoundationModelsError('Session ID must be a non-empty string', {
        type: 'sessionNotFound',
      });
    }

    if (!prompt || typeof prompt !== 'string') {
      throw new FoundationModelsError('Prompt must be a non-empty string', {
        type: 'generationFailed',
      });
    }

    if (!Array.isArray(choices) || choices.length === 0) {
      throw new FoundationModelsError('Choices must be a non-empty array', {
        type: 'generationFailed',
      });
    }

    try {
      const result = await ExpoFoundationModelsModule.respondWithChoices(
        sessionId,
        prompt,
        choices,
        options ?? null
      );
      return result;
    } catch (error) {
      throw parseNativeError(error, 'Choice generation failed', 'CHOICE_GENERATION_FAILED');
    }
  },

  /**
   * Stream structured output with partial updates.
   *
   * @param sessionId - The session ID
   * @param prompt - The user prompt
   * @param schema - JSON Schema defining the expected output structure
   * @param onPartial - Callback invoked with partial results as they're generated
   * @param options - Optional generation options
   * @returns Promise resolving to the complete object matching the schema
   * @throws {FoundationModelsError} If streaming fails
   */
  async streamWithSchema<T = Record<string, unknown>>(
    sessionId: string,
    prompt: string,
    schema: JSONSchema,
    onPartial: (partial: Partial<T>) => void,
    options?: GenerationOptions
  ): Promise<T> {
    if (Platform.OS !== 'ios') {
      throw new FoundationModelsError('Foundation Models is only available on iOS', {
        type: 'notAvailable',
        code: 'PLATFORM_NOT_SUPPORTED',
      });
    }

    if (!sessionId || typeof sessionId !== 'string') {
      throw new FoundationModelsError('Session ID must be a non-empty string', {
        type: 'sessionNotFound',
      });
    }

    if (!prompt || typeof prompt !== 'string') {
      throw new FoundationModelsError('Prompt must be a non-empty string', {
        type: 'streamingFailed',
      });
    }

    if (!schema || typeof schema !== 'object') {
      throw new FoundationModelsError('Schema must be a valid JSON Schema object', {
        type: 'streamingFailed',
      });
    }

    const subscription = ExpoFoundationModelsModule.addListener(
      'onPartialSchema',
      (event: PartialSchemaEvent) => {
        if (event.sessionId === sessionId) {
          onPartial(event.partial as Partial<T>);
        }
      }
    );

    try {
      const result = await ExpoFoundationModelsModule.streamWithSchema(
        sessionId,
        prompt,
        schema,
        options ?? null
      );
      return result as T;
    } catch (error) {
      throw parseNativeError(error, 'Schema streaming failed', 'SCHEMA_STREAMING_FAILED');
    } finally {
      subscription.remove();
    }
  },

  // MARK: - Tool Calling

  /**
   * Create a session with tools that the model can call.
   *
   * @param options - Session options including tools and instructions
   * @returns Promise resolving to a session ID
   * @throws {FoundationModelsError} If session creation fails
   *
   * @example
   * ```typescript
   * const sessionId = await FoundationModels.createSessionWithTools({
   *   instructions: 'You are a helpful assistant',
   *   tools: [{
   *     name: 'getWeather',
   *     description: 'Get weather for a city',
   *     parameters: {
   *       type: 'object',
   *       properties: { city: { type: 'string' } },
   *       required: ['city']
   *     }
   *   }]
   * });
   * ```
   */
  async createSessionWithTools(options: SessionOptions): Promise<string> {
    if (Platform.OS !== 'ios') {
      throw new FoundationModelsError('Foundation Models is only available on iOS', {
        type: 'notAvailable',
        code: 'PLATFORM_NOT_SUPPORTED',
      });
    }

    if (!options.tools || options.tools.length === 0) {
      throw new FoundationModelsError('At least one tool must be provided', {
        type: 'generationFailed',
      });
    }

    try {
      return await ExpoFoundationModelsModule.createSessionWithTools(options);
    } catch (error) {
      throw parseNativeError(error, 'Failed to create session with tools', 'SESSION_FAILED');
    }
  },

  /**
   * Send a prompt to a tool-enabled session.
   *
   * The response may be either text or a tool call request.
   *
   * @param sessionId - The session ID
   * @param prompt - The user prompt
   * @param options - Optional generation options
   * @returns Promise resolving to either text content or a tool call
   * @throws {FoundationModelsError} If generation fails
   *
   * @example
   * ```typescript
   * const response = await FoundationModels.respondWithTools(sessionId, "What's the weather in Tokyo?");
   * if (response.type === 'toolCall') {
   *   // Execute the tool and submit result
   *   const result = await myTools[response.toolCall.name](response.toolCall.arguments);
   *   await FoundationModels.submitToolResult(sessionId, {
   *     callId: response.toolCall.id,
   *     result
   *   });
   * } else {
   *   console.log(response.content);
   * }
   * ```
   */
  async respondWithTools(
    sessionId: string,
    prompt: string,
    options?: GenerationOptions
  ): Promise<ToolResponse> {
    if (Platform.OS !== 'ios') {
      throw new FoundationModelsError('Foundation Models is only available on iOS', {
        type: 'notAvailable',
        code: 'PLATFORM_NOT_SUPPORTED',
      });
    }

    if (!sessionId || typeof sessionId !== 'string') {
      throw new FoundationModelsError('Session ID must be a non-empty string', {
        type: 'sessionNotFound',
      });
    }

    if (!prompt || typeof prompt !== 'string') {
      throw new FoundationModelsError('Prompt must be a non-empty string', {
        type: 'generationFailed',
      });
    }

    try {
      return await ExpoFoundationModelsModule.respondWithTools(sessionId, prompt, options ?? null);
    } catch (error) {
      throw parseNativeError(error, 'Tool response failed', 'TOOL_RESPONSE_FAILED');
    }
  },

  /**
   * Submit the result of a tool execution back to the model.
   *
   * @param sessionId - The session ID
   * @param toolResult - The tool execution result
   * @returns Promise resolving to the model's response (text or another tool call)
   * @throws {FoundationModelsError} If submission fails
   *
   * @example
   * ```typescript
   * const response = await FoundationModels.submitToolResult(sessionId, {
   *   callId: 'call-123',
   *   result: { temperature: 25, condition: 'sunny' }
   * });
   * ```
   */
  async submitToolResult(sessionId: string, toolResult: ToolResult): Promise<ToolResponse> {
    if (Platform.OS !== 'ios') {
      throw new FoundationModelsError('Foundation Models is only available on iOS', {
        type: 'notAvailable',
        code: 'PLATFORM_NOT_SUPPORTED',
      });
    }

    if (!sessionId || typeof sessionId !== 'string') {
      throw new FoundationModelsError('Session ID must be a non-empty string', {
        type: 'sessionNotFound',
      });
    }

    if (!toolResult.callId || typeof toolResult.callId !== 'string') {
      throw new FoundationModelsError('Tool call ID must be a non-empty string', {
        type: 'generationFailed',
      });
    }

    try {
      return await ExpoFoundationModelsModule.submitToolResult(sessionId, toolResult);
    } catch (error) {
      throw parseNativeError(error, 'Tool result submission failed', 'TOOL_RESULT_FAILED');
    }
  },

  /**
   * Stream a response from a tool-enabled session.
   *
   * @param sessionId - The session ID
   * @param prompt - The user prompt
   * @param callbacks - Callbacks for tokens and tool calls
   * @param options - Optional generation options
   * @returns Promise resolving to the final response
   * @throws {FoundationModelsError} If streaming fails
   */
  async streamWithTools(
    sessionId: string,
    prompt: string,
    callbacks: StreamWithToolsCallbacks,
    options?: GenerationOptions
  ): Promise<ToolResponse> {
    if (Platform.OS !== 'ios') {
      throw new FoundationModelsError('Foundation Models is only available on iOS', {
        type: 'notAvailable',
        code: 'PLATFORM_NOT_SUPPORTED',
      });
    }

    if (!sessionId || typeof sessionId !== 'string') {
      throw new FoundationModelsError('Session ID must be a non-empty string', {
        type: 'sessionNotFound',
      });
    }

    if (!prompt || typeof prompt !== 'string') {
      throw new FoundationModelsError('Prompt must be a non-empty string', {
        type: 'streamingFailed',
      });
    }

    const tokenSubscription = ExpoFoundationModelsModule.addListener(
      'onToken',
      (event: TokenEvent) => {
        if (event.sessionId === sessionId) {
          callbacks.onToken(event.token);
        }
      }
    );

    const toolCallSubscription = ExpoFoundationModelsModule.addListener(
      'onToolCall',
      (event: ToolCallEvent) => {
        if (event.sessionId === sessionId) {
          callbacks.onToolCall(event.toolCall);
        }
      }
    );

    try {
      return await ExpoFoundationModelsModule.streamWithTools(sessionId, prompt, options ?? null);
    } catch (error) {
      throw parseNativeError(error, 'Tool streaming failed', 'TOOL_STREAMING_FAILED');
    } finally {
      tokenSubscription.remove();
      toolCallSubscription.remove();
    }
  },

  // MARK: - Session Management

  /**
   * Get the transcript (conversation history) of a session.
   *
   * @param sessionId - The session ID
   * @returns Promise resolving to array of transcript entries
   * @throws {FoundationModelsError} If session not found
   *
   * @example
   * ```typescript
   * const transcript = await FoundationModels.getTranscript(sessionId);
   * for (const entry of transcript) {
   *   switch (entry.type) {
   *     case 'prompt':
   *       console.log('User:', entry.content);
   *       break;
   *     case 'response':
   *       console.log('Assistant:', entry.content);
   *       break;
   *   }
   * }
   * ```
   */
  async getTranscript(sessionId: string): Promise<TranscriptEntry[]> {
    if (Platform.OS !== 'ios') {
      throw new FoundationModelsError('Foundation Models is only available on iOS', {
        type: 'notAvailable',
        code: 'PLATFORM_NOT_SUPPORTED',
      });
    }

    if (!sessionId || typeof sessionId !== 'string') {
      throw new FoundationModelsError('Session ID must be a non-empty string', {
        type: 'sessionNotFound',
      });
    }

    try {
      return await ExpoFoundationModelsModule.getTranscript(sessionId);
    } catch (error) {
      throw parseNativeError(error, 'Failed to get transcript', 'TRANSCRIPT_FAILED');
    }
  },

  /**
   * Prewarm a session to reduce latency for subsequent requests.
   *
   * This loads necessary resources into memory and optionally caches a prompt prefix.
   *
   * @param sessionId - The session ID
   * @param options - Optional prewarm options
   * @throws {FoundationModelsError} If session not found
   *
   * @example
   * ```typescript
   * // Prewarm with a common prompt prefix
   * await FoundationModels.prewarm(sessionId, {
   *   promptPrefix: 'You are an expert programmer helping with:'
   * });
   * ```
   */
  async prewarm(sessionId: string, options?: PrewarmOptions): Promise<void> {
    if (Platform.OS !== 'ios') {
      throw new FoundationModelsError('Foundation Models is only available on iOS', {
        type: 'notAvailable',
        code: 'PLATFORM_NOT_SUPPORTED',
      });
    }

    if (!sessionId || typeof sessionId !== 'string') {
      throw new FoundationModelsError('Session ID must be a non-empty string', {
        type: 'sessionNotFound',
      });
    }

    try {
      await ExpoFoundationModelsModule.prewarm(sessionId, options ?? null);
    } catch (error) {
      throw parseNativeError(error, 'Failed to prewarm session', 'PREWARM_FAILED');
    }
  },

  /**
   * Create a new session with initial transcript entries.
   *
   * This is useful for resuming a conversation or providing context.
   *
   * @param transcriptEntries - Initial transcript entries
   * @param instructions - Optional system instructions
   * @returns Promise resolving to a session ID
   * @throws {FoundationModelsError} If creation fails
   *
   * @example
   * ```typescript
   * const sessionId = await FoundationModels.createSessionWithTranscript([
   *   { type: 'prompt', content: 'What is React?' },
   *   { type: 'response', content: 'React is a JavaScript library...' }
   * ], 'You are a helpful programming assistant');
   *
   * // Continue the conversation
   * const response = await FoundationModels.respond(sessionId, 'Tell me more');
   * ```
   */
  async createSessionWithTranscript(
    transcriptEntries: TranscriptEntry[],
    instructions?: string
  ): Promise<string> {
    if (Platform.OS !== 'ios') {
      throw new FoundationModelsError('Foundation Models is only available on iOS', {
        type: 'notAvailable',
        code: 'PLATFORM_NOT_SUPPORTED',
      });
    }

    if (!Array.isArray(transcriptEntries) || transcriptEntries.length === 0) {
      throw new FoundationModelsError('Transcript entries must be a non-empty array', {
        type: 'generationFailed',
      });
    }

    try {
      const options: CreateSessionWithTranscriptOptions = {
        transcriptEntries,
      };
      if (instructions) {
        options.instructions = instructions;
      }
      return await ExpoFoundationModelsModule.createSessionWithTranscript(options);
    } catch (error) {
      throw parseNativeError(error, 'Failed to create session with transcript', 'SESSION_FAILED');
    }
  },

  // MARK: - Adapter Methods

  /**
   * Load a custom adapter from Background Assets.
   *
   * Adapters specialize the system language model for custom use cases.
   * Requires the `com.apple.developer.foundation-model-adapter` entitlement.
   *
   * @param name - Name of the adapter to load
   * @param options - Optional loading options
   * @returns Promise resolving to adapter info
   * @throws {FoundationModelsError} If adapter not found or incompatible
   *
   * @example
   * ```typescript
   * const adapter = await FoundationModels.loadAdapter('myCustomAdapter');
   * const sessionId = await FoundationModels.createSession({
   *   adapterId: adapter.id
   * });
   * ```
   */
  async loadAdapter(name: string, options?: LoadAdapterOptions): Promise<AdapterInfo> {
    if (Platform.OS !== 'ios') {
      throw new FoundationModelsError('Foundation Models is only available on iOS', {
        type: 'notAvailable',
        code: 'PLATFORM_NOT_SUPPORTED',
      });
    }

    if (!name || typeof name !== 'string') {
      throw new FoundationModelsError('Adapter name must be a non-empty string', {
        type: 'generationFailed',
      });
    }

    try {
      return await ExpoFoundationModelsModule.loadAdapter(name, options ?? null);
    } catch (error) {
      throw parseNativeError(error, 'Failed to load adapter', 'ADAPTER_LOAD_FAILED');
    }
  },

  /**
   * Load a custom adapter from a local file.
   *
   * @param filePath - Path to the .fmadapter file
   * @param options - Optional loading options
   * @returns Promise resolving to adapter info
   * @throws {FoundationModelsError} If file not found or invalid
   *
   * @example
   * ```typescript
   * const adapter = await FoundationModels.loadAdapterFromFile(
   *   '/path/to/my_adapter.fmadapter'
   * );
   * ```
   */
  async loadAdapterFromFile(filePath: string, options?: LoadAdapterOptions): Promise<AdapterInfo> {
    if (Platform.OS !== 'ios') {
      throw new FoundationModelsError('Foundation Models is only available on iOS', {
        type: 'notAvailable',
        code: 'PLATFORM_NOT_SUPPORTED',
      });
    }

    if (!filePath || typeof filePath !== 'string') {
      throw new FoundationModelsError('File path must be a non-empty string', {
        type: 'generationFailed',
      });
    }

    try {
      return await ExpoFoundationModelsModule.loadAdapterFromFile(filePath, options ?? null);
    } catch (error) {
      throw parseNativeError(error, 'Failed to load adapter from file', 'ADAPTER_LOAD_FAILED');
    }
  },

  /**
   * Compile an adapter for faster inference.
   *
   * This prepares the adapter's draft model for optimized performance.
   * Compilation can be computationally intensive but is cached for subsequent uses.
   *
   * @param adapterId - ID of the adapter to compile
   * @throws {FoundationModelsError} If adapter not found
   */
  async compileAdapter(adapterId: string): Promise<void> {
    if (Platform.OS !== 'ios') {
      throw new FoundationModelsError('Foundation Models is only available on iOS', {
        type: 'notAvailable',
        code: 'PLATFORM_NOT_SUPPORTED',
      });
    }

    if (!adapterId || typeof adapterId !== 'string') {
      throw new FoundationModelsError('Adapter ID must be a non-empty string', {
        type: 'generationFailed',
      });
    }

    try {
      await ExpoFoundationModelsModule.compileAdapter(adapterId);
    } catch (error) {
      throw parseNativeError(error, 'Failed to compile adapter', 'ADAPTER_COMPILE_FAILED');
    }
  },

  /**
   * Unload an adapter to free memory.
   *
   * @param adapterId - ID of the adapter to unload
   * @throws {FoundationModelsError} If adapter not found
   */
  async unloadAdapter(adapterId: string): Promise<void> {
    if (Platform.OS !== 'ios') {
      throw new FoundationModelsError('Foundation Models is only available on iOS', {
        type: 'notAvailable',
        code: 'PLATFORM_NOT_SUPPORTED',
      });
    }

    if (!adapterId || typeof adapterId !== 'string') {
      throw new FoundationModelsError('Adapter ID must be a non-empty string', {
        type: 'generationFailed',
      });
    }

    try {
      await ExpoFoundationModelsModule.unloadAdapter(adapterId);
    } catch (error) {
      throw parseNativeError(error, 'Failed to unload adapter', 'ADAPTER_UNLOAD_FAILED');
    }
  },

  /**
   * Get the download status of an adapter.
   *
   * @param name - Name of the adapter
   * @returns Promise resolving to download status
   */
  async getAdapterDownloadStatus(name: string): Promise<AdapterDownloadStatus> {
    if (Platform.OS !== 'ios') {
      throw new FoundationModelsError('Foundation Models is only available on iOS', {
        type: 'notAvailable',
        code: 'PLATFORM_NOT_SUPPORTED',
      });
    }

    try {
      return await ExpoFoundationModelsModule.getAdapterDownloadStatus(name);
    } catch (error) {
      throw parseNativeError(error, 'Failed to get adapter download status', 'ADAPTER_STATUS_FAILED');
    }
  },

  /**
   * Remove all obsolete adapters that are no longer compatible with the system model.
   *
   * Call this before downloading new adapters to ensure compatibility and manage storage.
   */
  async removeObsoleteAdapters(): Promise<void> {
    if (Platform.OS !== 'ios') {
      throw new FoundationModelsError('Foundation Models is only available on iOS', {
        type: 'notAvailable',
        code: 'PLATFORM_NOT_SUPPORTED',
      });
    }

    try {
      await ExpoFoundationModelsModule.removeObsoleteAdapters();
    } catch (error) {
      throw parseNativeError(error, 'Failed to remove obsolete adapters', 'ADAPTER_REMOVE_FAILED');
    }
  },

  /**
   * Check if an adapter is compatible with the current system model.
   *
   * @param name - Name of the adapter to check
   * @returns Promise resolving to true if compatible
   */
  async isAdapterCompatible(name: string): Promise<boolean> {
    if (Platform.OS !== 'ios') {
      throw new FoundationModelsError('Foundation Models is only available on iOS', {
        type: 'notAvailable',
        code: 'PLATFORM_NOT_SUPPORTED',
      });
    }

    try {
      return await ExpoFoundationModelsModule.isAdapterCompatible(name);
    } catch (error) {
      throw parseNativeError(error, 'Failed to check adapter compatibility', 'ADAPTER_CHECK_FAILED');
    }
  },

  // MARK: - Feedback & Analytics

  /**
   * Log feedback about a model response.
   *
   * This allows users to provide feedback about the quality of model responses,
   * which can be used for analytics and improvement. The feedback is serialized
   * into an attachment that can be included in bug reports.
   *
   * @param sessionId - The session ID
   * @param options - Feedback options including sentiment and optional issues
   * @returns Promise resolving to feedback result with optional attachment
   * @throws {FoundationModelsError} If session not found or feedback logging fails
   *
   * @example
   * ```typescript
   * // Positive feedback
   * await FoundationModels.logFeedback(sessionId, {
   *   sentiment: 'positive'
   * });
   *
   * // Negative feedback with details
   * await FoundationModels.logFeedback(sessionId, {
   *   sentiment: 'negative',
   *   issues: [
   *     { category: 'incorrect', explanation: 'The date was wrong' },
   *     { category: 'tooVerbose' }
   *   ],
   *   desiredResponse: 'The correct date is January 1, 2020'
   * });
   * ```
   */
  async logFeedback(sessionId: string, options: FeedbackOptions): Promise<FeedbackResult> {
    if (Platform.OS !== 'ios') {
      throw new FoundationModelsError('Foundation Models is only available on iOS', {
        type: 'notAvailable',
        code: 'PLATFORM_NOT_SUPPORTED',
      });
    }

    if (!sessionId || typeof sessionId !== 'string') {
      throw new FoundationModelsError('Session ID must be a non-empty string', {
        type: 'sessionNotFound',
      });
    }

    try {
      return await ExpoFoundationModelsModule.logFeedback(sessionId, options);
    } catch (error) {
      throw parseNativeError(error, 'Failed to log feedback', 'FEEDBACK_FAILED');
    }
  },
};

/**
 * Parse native error and convert to FoundationModelsError with proper type.
 */
function parseNativeError(
  error: unknown,
  fallbackMessage: string,
  fallbackCode: string
): FoundationModelsError {
  if (error instanceof Error) {
    // Try to extract error type from native error message
    const message = error.message;

    // Check for known error patterns
    if (message.includes('guardrail') || message.includes('safety')) {
      return new FoundationModelsError(message, {
        type: 'guardrailViolation',
        code: 'GUARDRAIL_VIOLATION',
      });
    }

    if (message.includes('refused') || message.includes('refusal')) {
      return new FoundationModelsError(message, {
        type: 'refusal',
        code: 'REFUSAL',
      });
    }

    if (message.includes('not available') || message.includes('notAvailable')) {
      return new FoundationModelsError(message, {
        type: 'notAvailable',
        code: 'NOT_AVAILABLE',
      });
    }

    if (message.includes('Session not found') || message.includes('sessionNotFound')) {
      return new FoundationModelsError(message, {
        type: 'sessionNotFound',
        code: 'SESSION_NOT_FOUND',
      });
    }

    if (message.includes('unsupported language') || message.includes('locale')) {
      return new FoundationModelsError(message, {
        type: 'unsupportedLanguage',
        code: 'UNSUPPORTED_LANGUAGE',
      });
    }

    return new FoundationModelsError(`${fallbackMessage}: ${message}`, {
      type: 'generationFailed',
      code: fallbackCode,
    });
  }

  return new FoundationModelsError(`${fallbackMessage}: ${String(error)}`, {
    type: 'unknown',
    code: fallbackCode,
  });
}
