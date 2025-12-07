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
   * @param instructions - Optional system instructions for the LLM
   * @returns Promise resolving to a session ID
   * @throws {FoundationModelsError} If session creation fails
   */
  async createSession(instructions?: string): Promise<string> {
    if (Platform.OS !== 'ios') {
      throw new FoundationModelsError('Foundation Models is only available on iOS', {
        type: 'notAvailable',
        code: 'PLATFORM_NOT_SUPPORTED',
      });
    }

    try {
      return await ExpoFoundationModelsModule.createSession(instructions ?? null);
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
