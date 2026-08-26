import { Platform } from 'react-native';
import ExpoFoundationModelsModule, { isNativeModuleAvailable } from './ExpoFoundationModelsModule';
import type {
  MLValue,
  MLDictionary,
  ContextOptions,
  FoundationModelsErrorCode,
  FoundationModelsErrorObject,
  FoundationModelsFeatures,
  FeaturesResult,
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
  ModelVariantInfo,
  PccModelSpecifier,
  PromptImage,
  PromptWithAttachments,
  ToolCallingMode,
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
  LocaleInfo,
  // Error diagnostics types
  CoreMLErrorCause,
  FoundationModelsErrorCause,
  DeviceInfo,
  ModelFeatureInfo,
  InputValidationIssue,
  CoreMLModelDiagnostics,
  InputValidationResult,
  ContextWindowDiagnostics,
  SessionDiagnostics,
  AvailabilityDiagnostics,
  CoreMLDiagnostics,
  FoundationModelsDiagnostics,
} from './ExpoFoundationModels.types';

export type {
  MLValue,
  MLDictionary,
  ContextOptions,
  FoundationModelsErrorCode,
  FoundationModelsErrorObject,
  FoundationModelsFeatures,
  FeaturesResult,
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
  ModelVariantInfo,
  PccModelSpecifier,
  PromptImage,
  PromptWithAttachments,
  ToolCallingMode,
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
  LocaleInfo,
  // Error diagnostics types
  CoreMLErrorCause,
  FoundationModelsErrorCause,
  DeviceInfo,
  ModelFeatureInfo,
  InputValidationIssue,
  CoreMLModelDiagnostics,
  InputValidationResult,
  ContextWindowDiagnostics,
  SessionDiagnostics,
  AvailabilityDiagnostics,
  CoreMLDiagnostics,
  FoundationModelsDiagnostics,
};

// MARK: - Validation Helpers

/**
 * Assert that the current platform is iOS.
 * @throws {CoreMLError} If not on iOS
 */
function assertIOSForCoreML(): void {
  if (Platform.OS !== 'ios') {
    throw new CoreMLError('CoreML is only available on iOS', { code: 'PLATFORM_NOT_SUPPORTED' });
  }
}

/**
 * Assert that the current platform is iOS for Foundation Models.
 * @throws {FoundationModelsError} If not on iOS
 */
function assertIOSForFoundationModels(): void {
  if (Platform.OS !== 'ios') {
    throw new FoundationModelsError('Foundation Models is only available on iOS', {
      type: 'notAvailable',
      code: 'PLATFORM_NOT_SUPPORTED',
    });
  }
}

/**
 * Assert that a value is a non-empty string.
 * @throws {CoreMLError} If validation fails
 */
function assertNonEmptyStringForCoreML(value: unknown, name: string): asserts value is string {
  if (!value || typeof value !== 'string') {
    throw new CoreMLError(`${name} must be a non-empty string`);
  }
}

/**
 * Assert that a session ID is valid.
 * @throws {FoundationModelsError} If validation fails
 */
function assertSessionId(sessionId: unknown): asserts sessionId is string {
  if (!sessionId || typeof sessionId !== 'string') {
    throw new FoundationModelsError('Session ID must be a non-empty string', {
      type: 'sessionNotFound',
    });
  }
}

/**
 * Assert that a prompt is a valid string or a prompt object with attachments.
 *
 * String form: non-empty string.
 * Object form ({@link PromptWithAttachments}): `text` must be a non-empty
 * string and each entry in `images` must carry exactly one of `uri` or
 * `base64`.
 *
 * @throws {FoundationModelsError} If validation fails
 */
function assertPromptInput(
  prompt: unknown,
  errorType: GenerationErrorType = 'generationFailed'
): asserts prompt is string | PromptWithAttachments {
  if (typeof prompt === 'string') {
    if (!prompt) {
      throw new FoundationModelsError('Prompt must be a non-empty string', {
        type: errorType,
      });
    }
    return;
  }
  if (!prompt || typeof prompt !== 'object') {
    throw new FoundationModelsError(
      'Prompt must be a non-empty string or an object with text and optional images',
      { type: errorType }
    );
  }
  const p = prompt as Record<string, unknown>;
  if (typeof p.text !== 'string' || !p.text) {
    throw new FoundationModelsError('Prompt text must be a non-empty string', {
      type: errorType,
    });
  }
  if (p.images === undefined) {
    return;
  }
  if (!Array.isArray(p.images)) {
    throw new FoundationModelsError('Prompt images must be an array', {
      type: errorType,
    });
  }
  for (const image of p.images) {
    if (!image || typeof image !== 'object') {
      throw new FoundationModelsError(
        'Each prompt image must be an object with exactly one of uri or base64',
        { type: errorType }
      );
    }
    const img = image as Record<string, unknown>;
    const hasOwn = (key: string) => Object.prototype.hasOwnProperty.call(img, key);
    const hasUriField = hasOwn('uri');
    const hasBase64Field = hasOwn('base64');
    if (hasUriField === hasBase64Field) {
      // Both fields present (even when one is empty) or neither present.
      throw new FoundationModelsError(
        'Each prompt image must have exactly one of uri or base64',
        { type: errorType }
      );
    }
    // The single present own field must carry a non-empty string so an
    // ambiguous image never crosses the bridge to fail natively.
    const field = hasUriField ? 'uri' : 'base64';
    const value = img[field];
    if (typeof value !== 'string' || value.length === 0) {
      throw new FoundationModelsError(`Prompt image ${field} must be a non-empty string`, {
        type: errorType,
      });
    }
  }
}

/**
 * Assert that a schema is valid.
 * @throws {FoundationModelsError} If validation fails
 */
function assertSchema(schema: unknown, errorType: GenerationErrorType = 'generationFailed'): asserts schema is JSONSchema {
  if (!schema || typeof schema !== 'object') {
    throw new FoundationModelsError('Schema must be a valid JSON Schema object', {
      type: errorType,
    });
  }
}

/**
 * Assert that choices array is valid.
 * @throws {FoundationModelsError} If validation fails
 */
function assertChoices(choices: unknown): asserts choices is string[] {
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new FoundationModelsError('Choices must be a non-empty array', {
      type: 'generationFailed',
    });
  }
}

/**
 * Assert that a name/ID string is valid for Foundation Models.
 * @throws {FoundationModelsError} If validation fails
 */
function assertNonEmptyString(value: unknown, name: string, errorType: GenerationErrorType = 'generationFailed'): asserts value is string {
  if (!value || typeof value !== 'string') {
    throw new FoundationModelsError(`${name} must be a non-empty string`, {
      type: errorType,
    });
  }
}

// MARK: - Error Classes

/**
 * Error thrown when CoreML operations fail.
 *
 * Provides detailed diagnostic information about the root cause of the error
 * and actionable suggestions for resolution.
 *
 * @example
 * ```typescript
 * try {
 *   await CoreML.predict(modelId, input);
 * } catch (error) {
 *   if (error instanceof CoreMLError) {
 *     console.log('Root cause:', error.cause);
 *     console.log('Suggestions:', error.suggestions);
 *     if (error.isInputShapeIssue()) {
 *       console.log('Input shape diagnostics:', error.diagnostics?.inputShapes);
 *     }
 *   }
 * }
 * ```
 */
export class CoreMLError extends Error {
  /** Error code for backward compatibility */
  public readonly code?: string;

  /** Root cause of the error */
  public readonly cause?: CoreMLErrorCause;

  /** Detailed diagnostic information */
  public readonly diagnostics?: CoreMLDiagnostics;

  /** Actionable suggestions to resolve the error */
  public readonly suggestions: string[];

  constructor(
    message: string,
    options?: {
      code?: string;
      cause?: CoreMLErrorCause;
      diagnostics?: CoreMLDiagnostics;
      suggestions?: string[];
    }
  ) {
    super(message);
    this.name = 'CoreMLError';
    this.code = options?.code;
    this.cause = options?.cause;
    this.diagnostics = options?.diagnostics;
    this.suggestions = options?.suggestions ?? [];
  }

  /**
   * Get a human-readable explanation of the root cause.
   */
  getCauseExplanation(): string {
    return getCoreMLCauseExplanation(this.cause);
  }

  /**
   * Check if error is due to compute unit incompatibility.
   */
  isComputeUnitIssue(): boolean {
    return this.cause === 'computeUnitIncompatible';
  }

  /**
   * Check if error is due to input shape mismatch.
   */
  isInputShapeIssue(): boolean {
    return this.cause === 'inputShapeMismatch';
  }

  /**
   * Check if error is due to insufficient memory.
   */
  isMemoryIssue(): boolean {
    return this.cause === 'insufficientMemory' || this.cause === 'memoryAllocationFailed';
  }

  /**
   * Check if error is due to model not found.
   */
  isModelNotFound(): boolean {
    return this.cause === 'fileNotFound';
  }

  /**
   * Check if error is due to data type mismatch.
   */
  isDataTypeIssue(): boolean {
    return this.cause === 'dataTypeMismatch';
  }

  /**
   * Convert to a plain object for logging/serialization.
   */
  toJSON(): {
    message: string;
    code?: string;
    cause?: CoreMLErrorCause;
    causeExplanation: string;
    diagnostics?: CoreMLDiagnostics;
    suggestions: string[];
  } {
    return {
      message: this.message,
      code: this.code,
      cause: this.cause,
      causeExplanation: this.getCauseExplanation(),
      diagnostics: this.diagnostics,
      suggestions: this.suggestions,
    };
  }
}

/**
 * Get a human-readable explanation for a CoreML error cause.
 */
function getCoreMLCauseExplanation(cause?: CoreMLErrorCause): string {
  switch (cause) {
    case 'computeUnitIncompatible':
      return 'The model requires compute units (Neural Engine, GPU) not available on this device.';
    case 'fileCorrupted':
      return 'The model file appears to be corrupted or incomplete.';
    case 'fileNotFound':
      return 'The model file was not found in the app bundle.';
    case 'insufficientMemory':
      return 'There is not enough memory available to load the model.';
    case 'unsupportedOperation':
      return 'The model contains operations not supported on this device or iOS version.';
    case 'modelVersionMismatch':
      return 'The model was compiled for a different CoreML version.';
    case 'compilationRequired':
      return 'The model needs to be compiled (.mlmodelc) before use.';
    case 'inputShapeMismatch':
      return 'The input data shape does not match what the model expects.';
    case 'missingFeature':
      return 'A required input feature was not provided.';
    case 'dataTypeMismatch':
      return 'The input data type does not match what the model expects.';
    case 'numericOverflow':
      return 'A numeric value exceeded the allowed range.';
    case 'invalidInputValue':
      return 'An input value is invalid (NaN, Infinity, or out of range).';
    case 'memoryAllocationFailed':
      return 'Failed to allocate memory for the prediction.';
    default:
      return 'An unknown error occurred.';
  }
}

/**
 * Error thrown when Foundation Models operations fail.
 *
 * Provides detailed diagnostic information about the root cause of the error
 * and actionable suggestions for resolution.
 *
 * @example
 * ```typescript
 * try {
 *   await FoundationModels.respond(sessionId, prompt);
 * } catch (error) {
 *   if (error instanceof FoundationModelsError) {
 *     console.log('Error type:', error.type);
 *     console.log('Root cause:', error.cause);
 *     console.log('Suggestions:', error.suggestions);
 *
 *     if (error.isGuardrailViolation()) {
 *       console.log('Content blocked by safety filters');
 *     } else if (error.isContextWindowExceeded()) {
 *       console.log('Context window exceeded - start a new session');
 *     } else if (error.isDeviceEligibilityIssue()) {
 *       console.log('Device eligibility:', error.diagnostics?.deviceEligibility);
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

  /** Normalized cross-platform error code reported by the native layer */
  public readonly errorCode?: FoundationModelsErrorCode;

  /** Root cause of the error */
  public readonly cause?: FoundationModelsErrorCause;

  /** Detailed diagnostic information */
  public readonly diagnostics?: FoundationModelsDiagnostics;

  /** Actionable suggestions to resolve the error */
  public readonly suggestions: string[];

  constructor(
    message: string,
    options?: {
      type?: GenerationErrorType;
      code?: string;
      errorCode?: FoundationModelsErrorCode;
      refusalExplanation?: string;
      context?: string;
      cause?: FoundationModelsErrorCause;
      diagnostics?: FoundationModelsDiagnostics;
      suggestions?: string[];
    }
  ) {
    super(message);
    this.name = 'FoundationModelsError';
    this.type = options?.type ?? 'unknown';
    this.code = options?.code;
    this.errorCode = options?.errorCode;
    this.refusalExplanation = options?.refusalExplanation;
    this.context = options?.context;
    this.cause = options?.cause;
    this.diagnostics = options?.diagnostics;
    this.suggestions = options?.suggestions ?? [];
  }

  /**
   * Get a human-readable explanation of the root cause.
   */
  getCauseExplanation(): string {
    return getFoundationModelsCauseExplanation(this.cause);
  }

  /** Check if this is a guardrail violation error */
  isGuardrailViolation(): boolean {
    return this.type === 'guardrailViolation' || this.cause === 'guardrailViolation';
  }

  /** Check if this is a refusal error */
  isRefusal(): boolean {
    return this.type === 'refusal' || this.cause === 'contentRefused';
  }

  /**
   * Check if error is due to context window being exceeded.
   */
  isContextWindowExceeded(): boolean {
    return this.cause === 'contextWindowExceeded' || this.cause === 'inputTooLong';
  }

  /**
   * Check if error is a device eligibility issue.
   */
  isDeviceEligibilityIssue(): boolean {
    return this.cause === 'deviceNotEligible' || this.cause === 'appleIntelligenceDisabled';
  }

  /**
   * Check if error is a model availability issue.
   */
  isModelAvailabilityIssue(): boolean {
    return this.cause === 'modelNotDownloaded' || this.cause === 'modelDownloading';
  }

  /**
   * Check if error is a session issue.
   */
  isSessionIssue(): boolean {
    return this.cause === 'sessionExpired' || this.cause === 'sessionInvalidated';
  }

  /** Convert to a plain object for serialization */
  toJSON(): GenerationErrorInfo & {
    cause?: FoundationModelsErrorCause;
    causeExplanation: string;
    diagnostics?: FoundationModelsDiagnostics;
    suggestions: string[];
  } {
    return {
      type: this.type,
      message: this.message,
      refusalExplanation: this.refusalExplanation,
      context: this.context,
      cause: this.cause,
      causeExplanation: this.getCauseExplanation(),
      diagnostics: this.diagnostics,
      suggestions: this.suggestions,
    };
  }
}

/**
 * Get a human-readable explanation for a Foundation Models error cause.
 */
function getFoundationModelsCauseExplanation(cause?: FoundationModelsErrorCause): string {
  switch (cause) {
    case 'deviceNotEligible':
      return 'This device does not support Apple Intelligence. Requires iPhone 15 Pro or newer, or M1+ Mac.';
    case 'appleIntelligenceDisabled':
      return 'Apple Intelligence is not enabled. Enable it in Settings > Apple Intelligence & Siri.';
    case 'modelNotDownloaded':
      return 'The on-device model has not been downloaded yet.';
    case 'modelDownloading':
      return 'The on-device model is currently downloading.';
    case 'unsupportedRegion':
      return 'Apple Intelligence is not available in this region.';
    case 'unsupportedOSVersion':
      return 'This feature requires iOS 26 or later.';
    case 'contextWindowExceeded':
      return 'The conversation exceeded the maximum context window size.';
    case 'inputTooLong':
      return 'The input prompt is too long for the model to process.';
    case 'outputTruncated':
      return 'The response was truncated due to token limits.';
    case 'unsupportedLanguage':
      return 'The requested language is not supported by the model.';
    case 'guardrailViolation':
      return 'The content was blocked by safety filters.';
    case 'contentRefused':
      return 'The model refused to generate the requested content.';
    case 'sessionExpired':
      return 'The session has expired or timed out.';
    case 'sessionInvalidated':
      return 'The session was invalidated due to an error.';
    case 'concurrencyLimit':
      return 'Too many concurrent requests. Please wait and try again.';
    default:
      return 'An unknown error occurred.';
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
    assertNonEmptyStringForCoreML(modelName, 'Model name');
    assertIOSForCoreML();

    try {
      return await ExpoFoundationModelsModule.loadModel(modelName);
    } catch (error) {
      throw new CoreMLError(
        `Failed to load model '${modelName}': ${error instanceof Error ? error.message : String(error)}`,
        { code: 'LOAD_FAILED', cause: 'fileNotFound' }
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
    assertNonEmptyStringForCoreML(modelId, 'Model ID');
    assertIOSForCoreML();

    try {
      await ExpoFoundationModelsModule.unloadModel(modelId);
    } catch (error) {
      throw new CoreMLError(
        `Failed to unload model '${modelId}': ${error instanceof Error ? error.message : String(error)}`,
        { code: 'UNLOAD_FAILED' }
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
    assertNonEmptyStringForCoreML(modelId, 'Model ID');
    if (!input || typeof input !== 'object') {
      throw new CoreMLError('Input must be an object');
    }
    assertIOSForCoreML();

    try {
      const result = await ExpoFoundationModelsModule.predict(modelId, input);
      return result as MLDictionary;
    } catch (error) {
      throw new CoreMLError(
        `Prediction failed: ${error instanceof Error ? error.message : String(error)}`,
        { code: 'PREDICTION_FAILED' }
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

  /**
   * Diagnostics API for CoreML models.
   * Provides programmatic access to detailed diagnostic information.
   */
  diagnostics: {
    /**
     * Get detailed diagnostics for a loaded model.
     *
     * @param modelId - The model ID to diagnose
     * @returns Model diagnostic information including input/output features
     *
     * @example
     * ```typescript
     * const diag = await CoreML.diagnostics.getModel(modelId);
     * console.log('Input features:', diag.inputFeatures);
     * console.log('Output features:', diag.outputFeatures);
     * ```
     */
    async getModel(modelId: string): Promise<CoreMLModelDiagnostics> {
      assertNonEmptyStringForCoreML(modelId, 'Model ID');
      assertIOSForCoreML();

      try {
        return (await ExpoFoundationModelsModule.getModelDiagnostics(
          modelId
        )) as CoreMLModelDiagnostics;
      } catch (error) {
        throw new CoreMLError(
          `Failed to get model diagnostics: ${error instanceof Error ? error.message : String(error)}`,
          { code: 'DIAGNOSTICS_FAILED' }
        );
      }
    },

    /**
     * Validate input before prediction to catch errors early.
     *
     * @param modelId - The model to validate against
     * @param input - The input to validate
     * @returns Validation result with any issues found
     *
     * @example
     * ```typescript
     * const validation = await CoreML.diagnostics.validateInput(modelId, input);
     * if (!validation.isValid) {
     *   console.log('Issues:', validation.issues);
     *   console.log('Suggestions:', validation.suggestions);
     * }
     * ```
     */
    async validateInput(
      modelId: string,
      input: MLDictionary
    ): Promise<InputValidationResult> {
      assertNonEmptyStringForCoreML(modelId, 'Model ID');
      if (!input || typeof input !== 'object') {
        throw new CoreMLError('Input must be an object', { code: 'INVALID_INPUT' });
      }
      assertIOSForCoreML();

      try {
        return (await ExpoFoundationModelsModule.validateModelInput(
          modelId,
          input
        )) as InputValidationResult;
      } catch (error) {
        throw new CoreMLError(
          `Failed to validate input: ${error instanceof Error ? error.message : String(error)}`,
          { code: 'VALIDATION_FAILED' }
        );
      }
    },
  },
};

/** Feature flags reported when Foundation Models is not usable (non-iOS, missing native module, or failure). */
const ALL_FEATURES_UNAVAILABLE: FoundationModelsFeatures = {
  privateCloudCompute: false,
  imageAttachments: false,
  contextOptions: false,
  toolCallingMode: false,
  tokenCounting: false,
  modelVariant: false,
};

/** All valid values of {@link FoundationModelsErrorCode}, for runtime validation of native payloads. */
const FOUNDATION_MODELS_ERROR_CODES: readonly FoundationModelsErrorCode[] = [
  'contextSizeExceeded',
  'rateLimited',
  'refusal',
  'guardrailViolation',
  'unsupportedLanguageOrLocale',
  'unsupportedCapability',
  'assetsUnavailable',
  'concurrentRequests',
  'timeout',
  'transcriptMutationWhileResponding',
  'unsupportedGenerationGuide',
  'decodingFailure',
  'featureUnavailable',
  'unknown',
];

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
    // First check if native module is available
    if (!isNativeModuleAvailable()) {
      return false;
    }
    try {
      return ExpoFoundationModelsModule.isAvailable();
    } catch (error) {
      console.warn('[FoundationModels] isAvailable() failed:', error);
      return false;
    }
  },

  /**
   * Get device locale information for debugging language support issues.
   *
   * This is useful for diagnosing "unsupported language" errors when the
   * device settings appear correct.
   *
   * @returns LocaleInfo object with device locale configuration
   *
   * @example
   * ```typescript
   * const locale = FoundationModels.getLocaleInfo();
   * console.log('Language:', locale.languageCode);  // e.g., "ko"
   * console.log('Region:', locale.regionCode);      // e.g., "KR"
   * console.log('Identifier:', locale.currentIdentifier);  // e.g., "ko_KR"
   * console.log('Preferred:', locale.preferredLanguages);  // e.g., ["ko-KR", "en-US"]
   * ```
   */
  getLocaleInfo(): LocaleInfo {
    if (Platform.OS !== 'ios') {
      return {
        currentIdentifier: 'unknown',
        languageCode: 'unknown',
        regionCode: 'unknown',
        preferredLanguages: [],
        calendar: 'unknown',
      };
    }
    if (!isNativeModuleAvailable()) {
      return {
        currentIdentifier: 'unknown',
        languageCode: 'unknown',
        regionCode: 'unknown',
        preferredLanguages: [],
        calendar: 'unknown',
      };
    }
    try {
      return ExpoFoundationModelsModule.getLocaleInfo();
    } catch (error) {
      console.warn('[FoundationModels] getLocaleInfo() failed:', error);
      return {
        currentIdentifier: 'error',
        languageCode: 'error',
        regionCode: 'error',
        preferredLanguages: [],
        calendar: 'error',
      };
    }
  },

  /**
   * Get detailed availability information for Foundation Models.
   *
   * This provides more context than `isAvailable()`, including the specific
   * reason why Foundation Models may be unavailable, plus OS version and
   * iOS 27+ feature flags when reported by the native layer.
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
        osVersion: Platform.Version?.toString() ?? 'unknown',
        features: ALL_FEATURES_UNAVAILABLE,
      };
    }
    // Check if native module is available
    if (!isNativeModuleAvailable()) {
      return {
        available: false,
        status: 'unavailable',
        reason: 'nativeModuleNotAvailable',
        message: 'Native module not properly linked',
        osVersion: Platform.Version?.toString() ?? 'unknown',
        features: ALL_FEATURES_UNAVAILABLE,
      };
    }
    try {
      return ExpoFoundationModelsModule.getAvailability();
    } catch (error) {
      return {
        available: false,
        status: 'unavailable',
        reason: 'unknown',
        message: error instanceof Error ? error.message : String(error),
        osVersion: Platform.Version?.toString() ?? 'unknown',
        features: ALL_FEATURES_UNAVAILABLE,
      };
    }
  },

  /**
   * Get the Foundation Models feature flags supported on this device, together
   * with the OS version they were reported for.
   *
   * All flags are `false` when Foundation Models is not usable (non-iOS,
   * missing native module) or on OS versions below each feature's minimum
   * (`tokenCounting`: iOS 26.4+, all others: iOS 27+).
   *
   * @returns OS version and nested feature flags
   *
   * @example
   * ```typescript
   * const { osVersion, features } = await FoundationModels.getFeatures();
   * if (features.imageAttachments) {
   *   await FoundationModels.respond(sessionId, {
   *     text: 'What is in this image?',
   *     images: [{ uri: 'file:///tmp/photo.jpg' }]
   *   });
   * }
   * ```
   */
  async getFeatures(): Promise<FeaturesResult> {
    const fallback: FeaturesResult = {
      osVersion: Platform.Version?.toString() ?? 'unknown',
      features: ALL_FEATURES_UNAVAILABLE,
    };
    if (Platform.OS !== 'ios' || !isNativeModuleAvailable()) {
      return fallback;
    }
    try {
      return await ExpoFoundationModelsModule.getFeatures();
    } catch (error) {
      console.warn('[FoundationModels] getFeatures() failed:', error);
      return fallback;
    }
  },

  /**
   * Count the tokens the system model would use for the given text.
   *
   * Requires iOS 26.4+; fails with a `featureUnavailable` normalized error on
   * older versions.
   *
   * @param text - The text to count tokens for
   * @returns Promise resolving to the token count
   * @throws {FoundationModelsError} If counting fails or the OS is too old
   */
  async getTokenCount(text: string): Promise<number> {
    assertIOSForFoundationModels();
    assertNonEmptyString(text, 'Text');

    try {
      return await ExpoFoundationModelsModule.getTokenCount(text);
    } catch (error) {
      throw parseNativeError(error, 'Failed to count tokens', 'TOKEN_COUNT_FAILED');
    }
  },

  /**
   * Get the context window size of the system model, in tokens.
   *
   * Requires iOS 26.4+; resolves to `null` on older versions.
   *
   * @returns Promise resolving to the context size, or null when unavailable
   */
  async getContextSize(): Promise<number | null> {
    assertIOSForFoundationModels();

    try {
      return await ExpoFoundationModelsModule.getContextSize();
    } catch (error) {
      throw parseNativeError(error, 'Failed to get context size', 'CONTEXT_SIZE_FAILED');
    }
  },

  /**
   * Get information about the current model variant.
   *
   * Requires iOS 27+; resolves to `null` on older versions.
   *
   * @returns Promise resolving to variant info, or null when unavailable
   */
  async getModelVariant(): Promise<ModelVariantInfo | null> {
    assertIOSForFoundationModels();

    try {
      return await ExpoFoundationModelsModule.getModelVariant();
    } catch (error) {
      throw parseNativeError(error, 'Failed to get model variant', 'MODEL_VARIANT_FAILED');
    }
  },

  /**
   * Diagnostics API for Foundation Models.
   * Provides programmatic access to detailed diagnostic information.
   */
  diagnostics: {
    /**
     * Get detailed availability diagnostics including device eligibility.
     *
     * @returns Comprehensive diagnostic information about model availability
     *
     * @example
     * ```typescript
     * const diag = await FoundationModels.diagnostics.getAvailability();
     * if (!diag.isAvailable) {
     *   console.log('Cause:', diag.cause);
     *   console.log('Explanation:', diag.causeExplanation);
     *   console.log('Suggestions:', diag.suggestions);
     * }
     * ```
     */
    getAvailability(): AvailabilityDiagnostics {
      if (Platform.OS !== 'ios') {
        return {
          isAvailable: false,
          status: 'unavailable',
          cause: 'unsupportedOSVersion',
          causeExplanation: 'Foundation Models is only available on iOS',
          deviceModel: 'unknown',
          osVersion: Platform.Version?.toString() ?? 'unknown',
          requiredOSVersion: 'iOS 26.0+',
          suggestions: ['Use an iOS device with iOS 26 or later'],
          timestamp: new Date().toISOString(),
        };
      }
      return ExpoFoundationModelsModule.getAvailabilityDiagnostics() as AvailabilityDiagnostics;
    },

    /**
     * Get session diagnostics including context window usage.
     *
     * @param sessionId - The session to diagnose
     * @returns Session diagnostic information
     *
     * @example
     * ```typescript
     * const diag = await FoundationModels.diagnostics.getSession(sessionId);
     * console.log(`Token usage: ${diag.contextWindow.estimatedUsedTokens}/${diag.contextWindow.maxTokens}`);
     * if (diag.contextWindow.remainingTokens < 500) {
     *   console.log('Warning: Running low on context window');
     * }
     * ```
     */
    async getSession(sessionId: string): Promise<SessionDiagnostics> {
      assertIOSForFoundationModels();
      assertSessionId(sessionId);

      try {
        return (await ExpoFoundationModelsModule.getSessionDiagnostics(
          sessionId
        )) as SessionDiagnostics;
      } catch (error) {
        throw new FoundationModelsError(
          `Failed to get session diagnostics: ${error instanceof Error ? error.message : String(error)}`,
          { type: 'generationFailed', code: 'DIAGNOSTICS_FAILED' }
        );
      }
    },

    /**
     * Analyze an error and get enhanced diagnostic information.
     *
     * @param error - The error to analyze
     * @returns Enhanced error information with diagnostics and suggestions
     *
     * @example
     * ```typescript
     * try {
     *   await FoundationModels.respond(sessionId, prompt);
     * } catch (error) {
     *   const analysis = FoundationModels.diagnostics.analyzeError(error);
     *   console.log('Root cause:', analysis.cause);
     *   console.log('Explanation:', analysis.explanation);
     *   console.log('Suggestions:', analysis.suggestions);
     * }
     * ```
     */
    analyzeError(error: Error): {
      cause: FoundationModelsErrorCause | CoreMLErrorCause;
      explanation: string;
      suggestions: string[];
      diagnostics?: FoundationModelsDiagnostics | CoreMLDiagnostics;
    } {
      if (error instanceof FoundationModelsError) {
        return {
          cause: error.cause ?? 'unknown',
          explanation: error.getCauseExplanation(),
          suggestions: error.suggestions,
          diagnostics: error.diagnostics,
        };
      }
      if (error instanceof CoreMLError) {
        return {
          cause: error.cause ?? 'unknown',
          explanation: error.getCauseExplanation(),
          suggestions: error.suggestions,
          diagnostics: error.diagnostics,
        };
      }
      // Analyze unknown errors by message pattern
      const message = error.message.toLowerCase();
      if (message.includes('guardrail') || message.includes('safety')) {
        return {
          cause: 'guardrailViolation',
          explanation: getFoundationModelsCauseExplanation('guardrailViolation'),
          suggestions: [
            'Rephrase your request to avoid triggering safety filters',
            'Remove potentially sensitive content from the prompt',
          ],
        };
      }
      if (message.includes('context') || message.includes('token') || message.includes('exceeded')) {
        return {
          cause: 'contextWindowExceeded',
          explanation: getFoundationModelsCauseExplanation('contextWindowExceeded'),
          suggestions: [
            'Reduce the length of your prompt',
            'Start a new session to reset the context',
          ],
        };
      }
      return {
        cause: 'unknown',
        explanation: 'An unknown error occurred.',
        suggestions: ['Check the error message for more details'],
      };
    },
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
    assertIOSForFoundationModels();

    try {
      // Handle legacy string API
      if (optionsOrInstructions === undefined) {
        return await ExpoFoundationModelsModule.createSession(null);
      }
      if (typeof optionsOrInstructions === 'string') {
        return await ExpoFoundationModelsModule.createSession(optionsOrInstructions);
      }

      // Handle new options object API
      const options = optionsOrInstructions;

      // If options contain advanced config (model, tools, guardrails, useCase, or
      // adapterId), use createSessionWithConfig
      if (
        options.model ||
        (options.tools && options.tools.length > 0) ||
        options.guardrails ||
        options.useCase ||
        options.adapterId
      ) {
        return await ExpoFoundationModelsModule.createSessionWithConfig({
          instructions: options.instructions,
          guardrails: options.guardrails,
          useCase: options.useCase,
          tools: options.tools,
          adapterId: options.adapterId,
          model: options.model,
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
    assertSessionId(sessionId);

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
    prompt: string | PromptWithAttachments,
    options?: GenerationOptions
  ): Promise<string> {
    assertSessionId(sessionId);
    assertPromptInput(prompt);

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
    prompt: string | PromptWithAttachments,
    onToken: (token: string) => void,
    options?: GenerationOptions
  ): Promise<string> {
    assertSessionId(sessionId);
    assertPromptInput(prompt, 'streamingFailed');

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
   * @returns Promise resolving to the generated value matching the schema.
   * Object roots resolve to an object; non-object roots (array, string,
   * number, boolean) resolve to the generated value as-is — pass an explicit
   * generic when the root is not an object.
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
    prompt: string | PromptWithAttachments,
    schema: JSONSchema,
    options?: GenerationOptions
  ): Promise<T> {
    assertIOSForFoundationModels();
    assertSessionId(sessionId);
    assertPromptInput(prompt);
    assertSchema(schema);

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
    prompt: string | PromptWithAttachments,
    choices: string[],
    options?: GenerationOptions
  ): Promise<string> {
    assertIOSForFoundationModels();
    assertSessionId(sessionId);
    assertPromptInput(prompt);
    assertChoices(choices);

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
   * @returns Promise resolving to the complete generated value matching the
   * schema; non-object roots resolve to the value as-is (pass an explicit
   * generic). Partial events may carry any JSON value for non-object roots.
   * @throws {FoundationModelsError} If streaming fails
   */
  async streamWithSchema<T = Record<string, unknown>>(
    sessionId: string,
    prompt: string | PromptWithAttachments,
    schema: JSONSchema,
    onPartial: (partial: Partial<T>) => void,
    options?: GenerationOptions
  ): Promise<T> {
    assertIOSForFoundationModels();
    assertSessionId(sessionId);
    assertPromptInput(prompt, 'streamingFailed');
    assertSchema(schema, 'streamingFailed');

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
    assertIOSForFoundationModels();

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
    prompt: string | PromptWithAttachments,
    options?: GenerationOptions
  ): Promise<ToolResponse> {
    assertIOSForFoundationModels();
    assertSessionId(sessionId);
    assertPromptInput(prompt);

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
    assertIOSForFoundationModels();
    assertSessionId(sessionId);
    assertNonEmptyString(toolResult.callId, 'Tool call ID');

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
    prompt: string | PromptWithAttachments,
    callbacks: StreamWithToolsCallbacks,
    options?: GenerationOptions
  ): Promise<ToolResponse> {
    assertIOSForFoundationModels();
    assertSessionId(sessionId);
    assertPromptInput(prompt, 'streamingFailed');

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
    assertIOSForFoundationModels();
    assertSessionId(sessionId);

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
    assertIOSForFoundationModels();
    assertSessionId(sessionId);

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
    assertIOSForFoundationModels();

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
    assertIOSForFoundationModels();
    assertNonEmptyString(name, 'Adapter name');

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
    assertIOSForFoundationModels();
    assertNonEmptyString(filePath, 'File path');

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
    assertIOSForFoundationModels();
    assertNonEmptyString(adapterId, 'Adapter ID');

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
    assertIOSForFoundationModels();
    assertNonEmptyString(adapterId, 'Adapter ID');

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
    assertIOSForFoundationModels();

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
    assertIOSForFoundationModels();

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
    assertIOSForFoundationModels();

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
    assertIOSForFoundationModels();
    assertSessionId(sessionId);

    try {
      return await ExpoFoundationModelsModule.logFeedback(sessionId, options);
    } catch (error) {
      throw parseNativeError(error, 'Failed to log feedback', 'FEEDBACK_FAILED');
    }
  },
};

/**
 * Parse native error and convert to FoundationModelsError with proper type,
 * root cause, diagnostics, and suggestions.
 */
function parseNativeError(
  error: unknown,
  fallbackMessage: string,
  fallbackCode: string
): FoundationModelsError {
  // Try to extract structured error info from native layer
  const nativeInfo = extractNativeErrorInfo(error);

  if (error instanceof Error) {
    const message = error.message;
    const lowerMessage = message.toLowerCase();

    // Normalized native error codes are authoritative — check them before
    // message heuristics so iOS 26/27 behavior stays identical.
    if (nativeInfo?.normalizedCode === 'featureUnavailable') {
      return new FoundationModelsError(message, {
        type: 'notAvailable',
        code: 'FEATURE_UNAVAILABLE',
        errorCode: 'featureUnavailable',
        cause: 'unsupportedOSVersion',
        context: nativeInfo?.context,
        diagnostics: nativeInfo?.diagnostics,
        suggestions: nativeInfo?.suggestions ?? [
          'This capability is unavailable on this device or OS version',
          'Check FoundationModels.getFeatures() before using version-gated APIs',
        ],
      });
    }
    // Check for known error patterns and map to causes
    if (lowerMessage.includes('guardrail') || lowerMessage.includes('safety') || lowerMessage.includes('blocked')) {
      return new FoundationModelsError(message, {
        type: 'guardrailViolation',
        code: 'GUARDRAIL_VIOLATION',
        errorCode: nativeInfo?.normalizedCode,
        cause: 'guardrailViolation',
        context: nativeInfo?.context,
        diagnostics: nativeInfo?.diagnostics,
        suggestions: nativeInfo?.suggestions ?? [
          'Rephrase your request to avoid triggering safety filters',
          'Remove potentially sensitive content from the prompt',
        ],
      });
    }

    if (lowerMessage.includes('refused') || lowerMessage.includes('refusal') || lowerMessage.includes('cannot')) {
      return new FoundationModelsError(message, {
        type: 'refusal',
        code: 'REFUSAL',
        errorCode: nativeInfo?.normalizedCode,
        cause: 'contentRefused',
        refusalExplanation: nativeInfo?.refusalExplanation,
        context: nativeInfo?.context,
        diagnostics: nativeInfo?.diagnostics,
        suggestions: nativeInfo?.suggestions ?? [
          'The model cannot fulfill this type of request',
          'Try rephrasing or asking for something different',
        ],
      });
    }

    if (lowerMessage.includes('context') || lowerMessage.includes('token') || lowerMessage.includes('exceeded') || lowerMessage.includes('window')) {
      return new FoundationModelsError(message, {
        type: 'generationFailed',
        code: 'CONTEXT_EXCEEDED',
        errorCode: nativeInfo?.normalizedCode,
        cause: 'contextWindowExceeded',
        diagnostics: nativeInfo?.diagnostics,
        suggestions: nativeInfo?.suggestions ?? [
          'Reduce the length of your prompt',
          'Start a new session to reset the context',
          'Summarize previous conversation before continuing',
        ],
      });
    }

    if (lowerMessage.includes('not available') || lowerMessage.includes('notavailable') || lowerMessage.includes('unavailable')) {
      let cause: FoundationModelsErrorCause = 'unknown';
      if (lowerMessage.includes('device') || lowerMessage.includes('eligible')) {
        cause = 'deviceNotEligible';
      } else if (lowerMessage.includes('intelligence') || lowerMessage.includes('enabled') || lowerMessage.includes('settings')) {
        cause = 'appleIntelligenceDisabled';
      } else if (lowerMessage.includes('download') || lowerMessage.includes('ready')) {
        cause = 'modelNotDownloaded';
      }
      return new FoundationModelsError(message, {
        type: 'notAvailable',
        code: 'NOT_AVAILABLE',
        errorCode: nativeInfo?.normalizedCode,
        cause,
        diagnostics: nativeInfo?.diagnostics,
        suggestions: nativeInfo?.suggestions ?? [getFoundationModelsCauseExplanation(cause)],
      });
    }

    if (lowerMessage.includes('session not found') || lowerMessage.includes('sessionnotfound')) {
      return new FoundationModelsError(message, {
        type: 'sessionNotFound',
        code: 'SESSION_NOT_FOUND',
        errorCode: nativeInfo?.normalizedCode,
        cause: 'sessionExpired',
        suggestions: nativeInfo?.suggestions ?? [
          'Create a new session and try again',
          'Sessions may expire after periods of inactivity',
        ],
      });
    }

    if (lowerMessage.includes('unsupported language') || lowerMessage.includes('locale')) {
      return new FoundationModelsError(message, {
        type: 'unsupportedLanguage',
        code: 'UNSUPPORTED_LANGUAGE',
        errorCode: nativeInfo?.normalizedCode,
        cause: 'unsupportedLanguage',
        suggestions: nativeInfo?.suggestions ?? [
          'Use a supported language (English, etc.)',
          'Check your device language settings',
        ],
      });
    }

    if (lowerMessage.includes('too long') || (lowerMessage.includes('input') && lowerMessage.includes('limit'))) {
      return new FoundationModelsError(message, {
        type: 'generationFailed',
        code: 'INPUT_TOO_LONG',
        errorCode: nativeInfo?.normalizedCode,
        cause: 'inputTooLong',
        suggestions: nativeInfo?.suggestions ?? [
          'Shorten your prompt',
          'Split your request into smaller parts',
        ],
      });
    }

    // Use native-provided cause if available, otherwise default to generationFailed
    return new FoundationModelsError(`${fallbackMessage}: ${message}`, {
      type: nativeInfo?.type ?? 'generationFailed',
      code: fallbackCode,
      errorCode: nativeInfo?.normalizedCode,
      cause: nativeInfo?.cause,
      context: nativeInfo?.context,
      diagnostics: nativeInfo?.diagnostics,
      suggestions: nativeInfo?.suggestions ?? [],
    });
  }

  return new FoundationModelsError(`${fallbackMessage}: ${String(error)}`, {
    type: 'unknown',
    code: fallbackCode,
  });
}

/**
 * Extract structured error information from native error objects.
 * Native errors may include additional properties with diagnostic info.
 */
function extractNativeErrorInfo(error: unknown): {
  type?: GenerationErrorType;
  cause?: FoundationModelsErrorCause;
  normalizedCode?: FoundationModelsErrorCode;
  refusalExplanation?: string;
  context?: string;
  diagnostics?: FoundationModelsDiagnostics;
  suggestions?: string[];
} | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const errorObj = error as Record<string, unknown>;

  // Check if error has structured info (from native layer)
  const result: ReturnType<typeof extractNativeErrorInfo> = {};

  if (typeof errorObj.type === 'string') {
    result.type = errorObj.type as GenerationErrorType;
  }

  if (typeof errorObj.cause === 'string') {
    result.cause = errorObj.cause as FoundationModelsErrorCause;
  }

  if (
    typeof errorObj.code === 'string' &&
    (FOUNDATION_MODELS_ERROR_CODES as readonly string[]).includes(errorObj.code)
  ) {
    result.normalizedCode = errorObj.code as FoundationModelsErrorCode;
  }

  if (typeof errorObj.refusalExplanation === 'string') {
    result.refusalExplanation = errorObj.refusalExplanation;
  }

  if (typeof errorObj.context === 'string') {
    result.context = errorObj.context;
  }

  if (errorObj.diagnostics && typeof errorObj.diagnostics === 'object') {
    result.diagnostics = errorObj.diagnostics as FoundationModelsDiagnostics;
  }

  if (Array.isArray(errorObj.suggestions)) {
    result.suggestions = errorObj.suggestions.filter(
      (s): s is string => typeof s === 'string'
    );
  }

  return Object.keys(result).length > 0 ? result : null;
}
