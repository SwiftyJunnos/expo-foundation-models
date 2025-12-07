/**
 * Input/output types for CoreML predictions.
 */
export type MLValue = number | number[] | string;
export type MLDictionary = { [key: string]: MLValue };

/**
 * Sampling mode for token selection.
 *
 * - `greedy`: Always selects the most probable token (deterministic)
 * - `topK`: Selects from the top K most probable tokens
 * - `topP`: Nucleus sampling - selects from tokens until cumulative probability exceeds threshold
 */
export type SamplingMode =
  | { type: 'greedy' }
  | { type: 'topK'; k: number; seed?: number }
  | { type: 'topP'; probabilityThreshold: number; seed?: number };

/**
 * Generation options for Foundation Models.
 *
 * @example
 * ```typescript
 * // High creativity with nucleus sampling
 * const options: GenerationOptions = {
 *   temperature: 1.5,
 *   sampling: { type: 'topP', probabilityThreshold: 0.9 },
 *   maximumResponseTokens: 500
 * };
 *
 * // Deterministic output
 * const deterministicOptions: GenerationOptions = {
 *   temperature: 0,
 *   sampling: { type: 'greedy' }
 * };
 * ```
 */
export type GenerationOptions = {
  /**
   * Controls randomness in generation.
   * - 0.0: More deterministic
   * - 1.0: Balanced
   * - 2.0: More creative/random
   * @default 1.0
   */
  temperature?: number;

  /**
   * Token sampling strategy.
   * - `greedy`: Always pick the most likely token
   * - `topK`: Sample from top K tokens
   * - `topP`: Nucleus sampling with probability threshold
   */
  sampling?: SamplingMode;

  /**
   * Maximum number of tokens to generate.
   * Must be a positive integer.
   */
  maximumResponseTokens?: number;
};

/**
 * Token event emitted during streaming generation.
 */
export type TokenEvent = {
  token: string;
  sessionId: string;
};

/**
 * Reasons why Foundation Models may be unavailable.
 */
export type UnavailableReason =
  | 'deviceNotEligible'
  | 'appleIntelligenceNotEnabled'
  | 'modelNotReady'
  | 'platformNotSupported'
  | 'unknown';

/**
 * Availability status for Foundation Models.
 */
export type AvailabilityStatus = 'available' | 'unavailable';

/**
 * Detailed availability information for Foundation Models.
 */
export type Availability = {
  /** Whether Foundation Models is available for use */
  available: boolean;
  /** Current status */
  status: AvailabilityStatus;
  /** Reason for unavailability (only present when unavailable) */
  reason?: UnavailableReason;
  /** Additional message for unknown reasons */
  message?: string;
};

/**
 * Error types that can occur during Foundation Models operations.
 */
export type GenerationErrorType =
  | 'guardrailViolation'
  | 'refusal'
  | 'notAvailable'
  | 'sessionNotFound'
  | 'generationFailed'
  | 'streamingFailed'
  | 'unsupportedLanguage'
  | 'unknown';

/**
 * Detailed error information from Foundation Models.
 */
export type GenerationErrorInfo = {
  /** The type of error that occurred */
  type: GenerationErrorType;
  /** Human-readable error message */
  message: string;
  /** For refusal errors, an explanation of why the model refused */
  refusalExplanation?: string;
  /** Additional context about the error */
  context?: string;
};

/**
 * Events emitted by the ExpoFoundationModels module.
 */
export type ExpoFoundationModelsModuleEvents = {
  onToken: (event: TokenEvent) => void;
};
