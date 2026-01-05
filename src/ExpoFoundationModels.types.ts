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

// MARK: - Session Management Types

/**
 * Types of entries that can appear in a session transcript.
 */
export type TranscriptEntryType =
  | 'instructions'
  | 'prompt'
  | 'response'
  | 'toolCall'
  | 'toolOutput';

/**
 * An entry in the session transcript.
 */
export type TranscriptEntry =
  | { type: 'instructions'; content: string }
  | { type: 'prompt'; content: string }
  | { type: 'response'; content: string }
  | { type: 'toolCall'; name: string; arguments: Record<string, unknown>; callId: string }
  | { type: 'toolOutput'; content: string; callId: string };

/**
 * Options for prewarming a session.
 */
export type PrewarmOptions = {
  /**
   * A prompt prefix to cache for faster subsequent requests.
   * This helps reduce latency when you know the beginning of your prompts.
   */
  promptPrefix?: string;
};

/**
 * Options for creating a session with initial transcript.
 */
export type CreateSessionWithTranscriptOptions = {
  /** Initial transcript entries to populate the session */
  transcriptEntries: TranscriptEntry[];
  /** Optional system instructions */
  instructions?: string;
};

// MARK: - Guardrails & Model Configuration Types

/**
 * Guardrails mode for content safety.
 *
 * - `default`: Enforces safety by blocking unsafe content in prompts and responses
 *   with a guardrailViolation error. Recommended for most applications.
 *
 * - `permissiveContentTransformations`: Allows the model to reason about sensitive
 *   source material for transformation tasks (e.g., summarizing articles with
 *   mature content, tagging chat conversations with profanity).
 *   Note: This mode only works for generating string values. When using guided
 *   generation (schemas), default guardrails are still applied.
 *
 * @example
 * ```typescript
 * // Default mode (recommended)
 * const sessionId = await FoundationModels.createSession({
 *   guardrails: 'default'
 * });
 *
 * // Permissive mode for content transformation
 * const sessionId = await FoundationModels.createSession({
 *   guardrails: 'permissiveContentTransformations'
 * });
 * ```
 */
export type GuardrailsMode = 'default' | 'permissiveContentTransformations';

/**
 * Use case for the language model.
 *
 * - `general`: General-purpose prompting (default). Suitable for most text generation tasks.
 *
 * - `contentTagging`: Optimized for categorizing and organizing data with content tags.
 *   Identifies topics, actions, objects, and emotions in input text.
 *
 * @example
 * ```typescript
 * // General use case (default)
 * const sessionId = await FoundationModels.createSession({
 *   useCase: 'general'
 * });
 *
 * // Content tagging use case
 * const sessionId = await FoundationModels.createSession({
 *   useCase: 'contentTagging'
 * });
 * ```
 */
export type ModelUseCase = 'general' | 'contentTagging';

/**
 * Extended session options including guardrails and use case configuration.
 *
 * @example
 * ```typescript
 * const sessionId = await FoundationModels.createSession({
 *   instructions: 'You are a helpful assistant',
 *   guardrails: 'default',
 *   useCase: 'general'
 * });
 * ```
 */
export type ExtendedSessionOptions = {
  /** System instructions for the model */
  instructions?: string;
  /** Guardrails mode for content safety */
  guardrails?: GuardrailsMode;
  /** Use case for the model */
  useCase?: ModelUseCase;
  /** Tools available for the model to use */
  tools?: Tool[];
  /** Adapter ID to use for the session (from loadAdapter or loadAdapterFromFile) */
  adapterId?: string;
};

// MARK: - Adapter Types

/**
 * Download status for an adapter.
 */
export type AdapterDownloadStatus =
  | { state: 'notStarted' }
  | { state: 'downloading'; progress: number }
  | { state: 'paused' }
  | { state: 'completed' }
  | { state: 'failed'; error: string };

/**
 * Information about a loaded adapter.
 *
 * @example
 * ```typescript
 * const adapter = await FoundationModels.loadAdapter('myCustomAdapter');
 * console.log('Adapter ID:', adapter.id);
 * console.log('Metadata:', adapter.metadata);
 * ```
 */
export type AdapterInfo = {
  /** Unique identifier for this adapter instance */
  id: string;
  /** Name of the adapter */
  name: string;
  /** Whether the adapter is ready for use */
  isReady: boolean;
  /** Whether the adapter has been compiled for faster inference */
  isCompiled: boolean;
  /** Creator-defined metadata from the adapter */
  metadata?: Record<string, unknown>;
};

/**
 * Options for loading an adapter.
 */
export type LoadAdapterOptions = {
  /**
   * Whether to automatically compile the adapter after loading.
   * Compilation improves inference speed but takes additional time.
   * @default false
   */
  compile?: boolean;
};

/**
 * Event emitted during adapter download progress.
 */
export type AdapterDownloadEvent = {
  /** Name of the adapter being downloaded */
  adapterName: string;
  /** Current download status */
  status: AdapterDownloadStatus;
};

// MARK: - Feedback Types

/**
 * Sentiment for model response feedback.
 *
 * - `positive`: The response was helpful and satisfactory
 * - `neutral`: The response was neither particularly good nor bad
 * - `negative`: The response was unsatisfactory or problematic
 *
 * @example
 * ```typescript
 * await FoundationModels.logFeedback(sessionId, {
 *   sentiment: 'negative',
 *   issues: [{ category: 'incorrect' }]
 * });
 * ```
 */
export type FeedbackSentiment = 'positive' | 'neutral' | 'negative';

/**
 * Categories of issues that can be reported in feedback.
 *
 * - `incorrect`: The response contained factual errors or wrong information
 * - `didNotFollowInstructions`: The model didn't follow the given instructions
 * - `tooVerbose`: The response was unnecessarily long or repetitive
 * - `unhelpful`: The response didn't address the user's needs
 * - `stereotypeOrBias`: The response exhibited stereotypes or bias
 * - `suggestiveOrSexual`: The response contained suggestive or sexual content
 * - `vulgarOrOffensive`: The response contained vulgar or offensive content
 * - `triggeredGuardrailUnexpectedly`: The guardrail was triggered when it shouldn't have been
 */
export type FeedbackIssueCategory =
  | 'incorrect'
  | 'didNotFollowInstructions'
  | 'tooVerbose'
  | 'unhelpful'
  | 'stereotypeOrBias'
  | 'suggestiveOrSexual'
  | 'vulgarOrOffensive'
  | 'triggeredGuardrailUnexpectedly';

/**
 * An issue to report in feedback.
 *
 * @example
 * ```typescript
 * const issue: FeedbackIssue = {
 *   category: 'incorrect',
 *   explanation: 'The capital of France is Paris, not Lyon'
 * };
 * ```
 */
export type FeedbackIssue = {
  /** The category of the issue */
  category: FeedbackIssueCategory;
  /** Optional explanation providing more context about the issue */
  explanation?: string;
};

/**
 * Options for logging feedback about a model response.
 *
 * @example
 * ```typescript
 * await FoundationModels.logFeedback(sessionId, {
 *   sentiment: 'negative',
 *   issues: [
 *     { category: 'incorrect', explanation: 'Wrong date provided' },
 *     { category: 'tooVerbose' }
 *   ],
 *   desiredResponse: 'The event happened on January 1, 2020'
 * });
 * ```
 */
export type FeedbackOptions = {
  /** Overall sentiment about the response */
  sentiment: FeedbackSentiment;
  /** Specific issues with the response (optional) */
  issues?: FeedbackIssue[];
  /** What the response should have been (optional) */
  desiredResponse?: string;
};

/**
 * Result of logging feedback.
 *
 * The feedback attachment is a serialized data blob that can be included
 * in bug reports or sent to Apple for model improvement.
 */
export type FeedbackResult = {
  /** Whether the feedback was successfully logged */
  success: boolean;
  /** Base64-encoded feedback attachment data (can be included in bug reports) */
  feedbackAttachment?: string;
};

/**
 * Device locale information for debugging language support issues.
 */
export type LocaleInfo = {
  /** Current locale identifier (e.g., "ko_KR", "en_US") */
  currentIdentifier: string;
  /** ISO 639 language code (e.g., "ko", "en") */
  languageCode: string;
  /** ISO 3166 region code (e.g., "KR", "US") */
  regionCode: string;
  /** User's preferred languages in order */
  preferredLanguages: string[];
  /** Calendar identifier */
  calendar: string;
};

/**
 * Events emitted by the ExpoFoundationModels module.
 */
export type ExpoFoundationModelsModuleEvents = {
  onToken: (event: TokenEvent) => void;
  onPartialSchema: (event: PartialSchemaEvent) => void;
  onToolCall: (event: ToolCallEvent) => void;
  onAdapterDownload: (event: AdapterDownloadEvent) => void;
};
