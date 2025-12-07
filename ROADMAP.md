# expo-foundation-models Roadmap

This document outlines the implementation status and roadmap for the `expo-foundation-models` Expo module, which provides access to Apple's Foundation Models framework (iOS 26+) and CoreML.

## Current Status (v0.1.0)

### ✅ Implemented Features

#### CoreML
- [x] Load/unload CoreML models from app bundle
- [x] Run predictions with dictionary input/output
- [x] Check if model is loaded
- [x] Get list of loaded models

#### Foundation Models (Basic)
- [x] Check availability (`isAvailable`)
- [x] Create/close sessions with optional instructions
- [x] Text generation (`respond`)
- [x] Streaming responses with token events (`streamResponse`, `onToken`)

---

## Phase 1: Core API Improvements (High Priority)

### 1.1 Detailed Availability Information
**Status:** ✅ Completed

Provide detailed reasons why Foundation Models may not be available.

```typescript
// Current
FoundationModels.isAvailable(): boolean

// Target
FoundationModels.getAvailability(): {
  available: boolean;
  reason?: 'deviceNotEligible' | 'appleIntelligenceNotEnabled' | 'modelNotReady' | 'unknown';
}
```

**Swift Implementation:**
- Use `SystemLanguageModel.default.availability` switch cases
- Return structured availability info with specific unavailability reasons

---

### 1.2 GenerationOptions Support
**Status:** ✅ Completed

Generation options are now fully applied to the model.

```typescript
type SamplingMode =
  | { type: 'greedy' }
  | { type: 'topK'; k: number; seed?: number }
  | { type: 'topP'; probabilityThreshold: number; seed?: number };

type GenerationOptions = {
  temperature?: number;           // 0.0 - 2.0, controls randomness
  sampling?: SamplingMode;        // Token sampling strategy
  maximumResponseTokens?: number; // Max output tokens
};
```

---

### 1.3 Error Handling Improvements
**Status:** ✅ Completed

Structured error types matching Apple's error cases are now implemented.

```typescript
type GenerationErrorType = 
  | 'guardrailViolation'
  | 'refusal'
  | 'notAvailable'
  | 'sessionNotFound'
  | 'generationFailed'
  | 'streamingFailed'
  | 'unsupportedLanguage'
  | 'unknown';

class FoundationModelsError extends Error {
  type: GenerationErrorType;
  refusalExplanation?: string;
  context?: string;
  
  isGuardrailViolation(): boolean;
  isRefusal(): boolean;
}
```

---

## Phase 2: Structured Output / Guided Generation (High Priority)

### 2.1 JSON Schema-based Generation
**Status:** 🔴 Not Started

Generate structured data conforming to a JSON schema.

```typescript
// Define schema
const PersonSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'integer' },
    hobbies: { 
      type: 'array', 
      items: { type: 'string' } 
    }
  },
  required: ['name', 'age']
};

// Generate structured output
const person = await FoundationModels.respondWithSchema(
  sessionId,
  "Generate a person who loves hiking",
  PersonSchema
);
// Returns: { name: "Alex", age: 28, hobbies: ["hiking", "photography"] }
```

**Implementation Approach:**
- Use `DynamicGenerationSchema` on Swift side
- Accept JSON Schema from TypeScript
- Convert to Apple's schema format
- Return parsed JSON object

---

### 2.2 Enum/Choice Constraints
**Status:** 🔴 Not Started

Constrain generation to specific choices.

```typescript
const result = await FoundationModels.respondWithChoices(
  sessionId,
  "What's the sentiment of this text: 'I love this!'",
  ['positive', 'negative', 'neutral']
);
// Returns: "positive"
```

---

## Phase 3: Tool Calling (High Priority)

### 3.1 Tool Registration and Execution
**Status:** 🔴 Not Started

Allow the model to call tools/functions defined in JavaScript.

```typescript
// Define tools
const weatherTool: Tool = {
  name: 'getWeather',
  description: 'Get current weather for a city',
  parameters: {
    type: 'object',
    properties: {
      city: { type: 'string', description: 'City name' }
    },
    required: ['city']
  },
  handler: async (args) => {
    // Fetch weather data
    return { temperature: 72, condition: 'sunny' };
  }
};

// Create session with tools
const sessionId = await FoundationModels.createSession({
  instructions: "Help users with weather information",
  tools: [weatherTool]
});

// Model can now call tools automatically
const response = await FoundationModels.respond(
  sessionId,
  "What's the weather in Tokyo?"
);
```

**Implementation Challenges:**
- Need bidirectional communication for tool calls
- Swift calls back to JS when tool is invoked
- JS executes handler and returns result to Swift
- Swift continues generation with tool result

**Architecture Options:**
1. Event-based: Emit `onToolCall` event, wait for `submitToolResult`
2. Callback-based: Pass tool handlers that get invoked

---

## Phase 4: Session & Transcript Management (Medium Priority)

### 4.1 Transcript Access
**Status:** 🔴 Not Started

Access conversation history within a session.

```typescript
type TranscriptEntry = 
  | { type: 'instructions'; content: string }
  | { type: 'prompt'; content: string }
  | { type: 'response'; content: string }
  | { type: 'toolCall'; name: string; arguments: Record<string, unknown> }
  | { type: 'toolOutput'; content: string };

const transcript = await FoundationModels.getTranscript(sessionId);
// Returns: TranscriptEntry[]
```

---

### 4.2 Session Prewarm
**Status:** 🔴 Not Started

Reduce latency by preloading resources.

```typescript
await FoundationModels.prewarm(sessionId, {
  promptPrefix: "You are a helpful assistant..."
});
```

---

### 4.3 Session with Initial Transcript
**Status:** 🔴 Not Started

Resume sessions with existing conversation history.

```typescript
const sessionId = await FoundationModels.createSession({
  transcriptEntries: [
    { type: 'prompt', content: 'Hello!' },
    { type: 'response', content: 'Hi! How can I help?' }
  ]
});
```

---

## Phase 5: Advanced Configuration (Medium Priority)

### 5.1 Guardrails Configuration
**Status:** 🔴 Not Started

Configure safety guardrails for content generation.

```typescript
type GuardrailsMode = 'default' | 'permissiveContentTransformations';

const sessionId = await FoundationModels.createSession({
  guardrails: 'permissiveContentTransformations'
});
```

**Use Cases:**
- `default`: Blocks unsafe content (recommended for most apps)
- `permissiveContentTransformations`: Allows processing sensitive input for transformation tasks (e.g., summarizing articles with mature content)

---

### 5.2 Model Selection
**Status:** 🔴 Not Started

Support different model configurations.

```typescript
const sessionId = await FoundationModels.createSession({
  model: {
    useCase: 'general' // Future: could support other use cases
  }
});
```

---

## Phase 6: Adapters / Fine-tuned Models (Low Priority)

### 6.1 Load Custom Adapters
**Status:** 🔴 Not Started

Load fine-tuned model adapters.

```typescript
// Load adapter from Background Assets
const adapter = await FoundationModels.loadAdapter('myCustomAdapter');

// Create session with adapted model
const sessionId = await FoundationModels.createSession({
  adapter: adapter.id
});
```

**Requirements:**
- Integration with Background Assets framework
- Adapter compatibility checking
- Download progress tracking
- Adapter compilation support

---

### 6.2 Local Adapter Loading
**Status:** 🔴 Not Started

Load adapters from local `.fmadapter` files.

```typescript
const adapter = await FoundationModels.loadAdapterFromFile(
  '/path/to/my_adapter.fmadapter'
);
```

---

## Phase 7: Feedback & Analytics (Low Priority)

### 7.1 Response Feedback
**Status:** 🔴 Not Started

Log feedback for model responses.

```typescript
await FoundationModels.logFeedback(sessionId, {
  sentiment: 'negative',
  issues: [
    { category: 'incorrect', explanation: 'Outdated information' }
  ],
  desiredOutput: 'The correct answer is...'
});
```

---

## Implementation Priority Matrix

| Phase | Feature | Priority | Complexity | Value |
|-------|---------|----------|------------|-------|
| 1.1 | Detailed Availability | 🔴 High | Low | High |
| 1.2 | GenerationOptions | 🔴 High | Low | Medium |
| 1.3 | Error Handling | 🔴 High | Medium | High |
| 2.1 | JSON Schema Generation | 🔴 High | High | Very High |
| 2.2 | Enum Constraints | 🔴 High | Medium | High |
| 3.1 | Tool Calling | 🔴 High | Very High | Very High |
| 4.1 | Transcript Access | 🟡 Medium | Low | Medium |
| 4.2 | Session Prewarm | 🟡 Medium | Low | Medium |
| 4.3 | Initial Transcript | 🟡 Medium | Medium | Medium |
| 5.1 | Guardrails Config | 🟡 Medium | Low | Medium |
| 5.2 | Model Selection | 🟡 Medium | Low | Low |
| 6.1 | Adapter Loading | 🟢 Low | High | Low |
| 6.2 | Local Adapters | 🟢 Low | Medium | Low |
| 7.1 | Feedback Logging | 🟢 Low | Medium | Low |

---

## Technical Notes

### iOS Version Requirements
- Foundation Models: iOS 26.0+ (beta)
- CoreML: iOS 16.0+

### Known Limitations
- Foundation Models is iOS-only (no Android equivalent)
- Requires Apple Intelligence to be enabled in device settings
- Model availability depends on device capability (A17+ chip)
- Some features may change as iOS 26 is still in beta

### Testing Considerations
- Need iOS 26 beta device or simulator for testing
- Apple Intelligence must be manually enabled
- Model download may be required on first use

---

## Contributing

Contributions are welcome! Please check the issues for tasks marked as "help wanted" or propose new features aligned with this roadmap.

## Version History

- **v0.1.0** - Initial implementation with basic text generation and streaming
- **v0.2.0** - (Planned) Phase 1 completion
- **v0.3.0** - (Planned) Structured output support
- **v1.0.0** - (Planned) Full feature parity with Foundation Models framework
