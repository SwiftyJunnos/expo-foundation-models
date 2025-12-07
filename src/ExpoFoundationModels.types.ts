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
 * JSON Schema type for structured output generation.
 * Supports a subset of JSON Schema Draft 7 compatible with Apple's Foundation Models.
 */
export type JSONSchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array';

/**
 * JSON Schema definition for structured output.
 *
 * @example
 * ```typescript
 * const personSchema: JSONSchema = {
 *   type: 'object',
 *   properties: {
 *     name: { type: 'string', description: 'Full name' },
 *     age: { type: 'integer' },
 *     hobbies: {
 *       type: 'array',
 *       items: { type: 'string' }
 *     }
 *   },
 *   required: ['name', 'age']
 * };
 * ```
 */
export type JSONSchema = {
  /** The type of the schema */
  type?: JSONSchemaType;

  /** Description of the field (helps guide generation) */
  description?: string;

  /** For object types: property definitions */
  properties?: { [key: string]: JSONSchema };

  /** For object types: list of required property names */
  required?: string[];

  /** For array types: schema for array items */
  items?: JSONSchema;

  /** For string/number types: allowed values (enum constraint) */
  enum?: (string | number)[];

  /** Minimum value for number/integer types */
  minimum?: number;

  /** Maximum value for number/integer types */
  maximum?: number;

  /** Minimum length for string types */
  minLength?: number;

  /** Maximum length for string types */
  maxLength?: number;

  /** Minimum items for array types */
  minItems?: number;

  /** Maximum items for array types */
  maxItems?: number;
};

/**
 * Partial schema event emitted during streaming structured output.
 */
export type PartialSchemaEvent = {
  sessionId: string;
  partial: Record<string, unknown>;
};

// MARK: - Tool Calling Types

/**
 * Definition of a tool that can be called by the model.
 *
 * @example
 * ```typescript
 * const weatherTool: Tool = {
 *   name: 'getWeather',
 *   description: 'Get current weather for a city',
 *   parameters: {
 *     type: 'object',
 *     properties: {
 *       city: { type: 'string', description: 'City name' },
 *       unit: { type: 'string', enum: ['celsius', 'fahrenheit'] }
 *     },
 *     required: ['city']
 *   }
 * };
 * ```
 */
export type Tool = {
  /** Unique name for the tool */
  name: string;
  /** Description of what the tool does (helps the model decide when to use it) */
  description: string;
  /** JSON Schema defining the tool's parameters */
  parameters?: JSONSchema;
};

/**
 * A tool call request from the model.
 */
export type ToolCall = {
  /** Unique ID for this tool call (used when submitting results) */
  id: string;
  /** Name of the tool to call */
  name: string;
  /** Arguments to pass to the tool */
  arguments: Record<string, unknown>;
};

/**
 * Result of a tool execution to submit back to the model.
 */
export type ToolResult = {
  /** The ID of the tool call this result is for */
  callId: string;
  /** The successful result data (mutually exclusive with error) */
  result?: unknown;
  /** Error message if the tool failed (mutually exclusive with result) */
  error?: string;
};

/**
 * Response from a tool-enabled session.
 */
export type ToolResponse = {
  /** Type of response */
  type: 'text' | 'toolCall';
  /** Text content (when type is 'text') */
  content?: string;
  /** Tool call request (when type is 'toolCall') */
  toolCall?: ToolCall;
};

/**
 * Options for creating a session with tools.
 */
export type SessionOptions = {
  /** System instructions for the model */
  instructions?: string;
  /** Tools available for the model to use */
  tools?: Tool[];
};

/**
 * Callbacks for streaming with tools.
 */
export type StreamWithToolsCallbacks = {
  /** Called for each token generated */
  onToken: (token: string) => void;
  /** Called when the model wants to use a tool */
  onToolCall: (toolCall: ToolCall) => void;
};

/**
 * Tool call event emitted during streaming.
 */
export type ToolCallEvent = {
  sessionId: string;
  toolCall: ToolCall;
};

/**
 * Events emitted by the ExpoFoundationModels module.
 */
export type ExpoFoundationModelsModuleEvents = {
  onToken: (event: TokenEvent) => void;
  onPartialSchema: (event: PartialSchemaEvent) => void;
  onToolCall: (event: ToolCallEvent) => void;
};
