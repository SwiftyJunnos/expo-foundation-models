# expo-foundation-models

Expo module for Apple's **Foundation Models** (on-device LLM with Apple Intelligence) and **CoreML** integration.

> **Note:** Foundation Models requires iOS 26.0+ and a device with Apple Intelligence enabled.

## Features

- **On-device LLM** - Private, fast text generation using Apple Intelligence
- **Structured Output** - Generate JSON conforming to schemas
- **Tool Calling** - Let the model call your functions
- **Streaming** - Token-by-token response streaming
- **Session Management** - Conversation history, prewarm, resume sessions
- **Adapters** - Load fine-tuned models
- **CoreML** - Run any CoreML model from your app bundle

## Installation

```bash
npx expo install expo-foundation-models
```

For bare React Native projects:
```bash
npm install expo-foundation-models
npx pod-install
```

## Quick Start

```typescript
import { FoundationModels } from 'expo-foundation-models';

// Check availability
if (FoundationModels.isAvailable()) {
  // Create a session
  const sessionId = await FoundationModels.createSession('You are a helpful assistant.');
  
  // Generate a response
  const response = await FoundationModels.respond(sessionId, 'Hello!');
  console.log(response);
  
  // Clean up
  await FoundationModels.closeSession(sessionId);
}
```

## API Reference

### Availability

```typescript
// Simple check
const available = FoundationModels.isAvailable();

// Detailed availability with reason
const { available, status, reason } = FoundationModels.getAvailability();
// reason: 'deviceNotEligible' | 'appleIntelligenceNotEnabled' | 'modelNotReady' | 'platformNotSupported'
```

### Sessions

```typescript
// Basic session
const sessionId = await FoundationModels.createSession();

// With instructions
const sessionId = await FoundationModels.createSession('You are a helpful assistant.');

// With full configuration
const sessionId = await FoundationModels.createSession({
  instructions: 'You are a helpful assistant.',
  guardrails: 'default', // or 'permissiveContentTransformations'
  useCase: 'general',    // or 'contentTagging'
});

// Close session
await FoundationModels.closeSession(sessionId);
```

### Text Generation

```typescript
// Simple response
const response = await FoundationModels.respond(sessionId, 'What is 2+2?');

// With options
const response = await FoundationModels.respond(sessionId, 'Write a poem', {
  temperature: 1.5,
  sampling: { type: 'topP', probabilityThreshold: 0.9 },
  maximumResponseTokens: 500
});

// Streaming
const response = await FoundationModels.streamResponse(
  sessionId,
  'Tell me a story',
  (token) => process.stdout.write(token)
);
```

### Structured Output

```typescript
// Generate JSON matching a schema
const person = await FoundationModels.respondWithSchema(
  sessionId,
  'Generate a person profile',
  {
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'integer' },
      hobbies: { type: 'array', items: { type: 'string' } }
    },
    required: ['name', 'age']
  }
);
// Returns: { name: "Alex", age: 28, hobbies: ["hiking"] }

// Constrain to choices
const sentiment = await FoundationModels.respondWithChoices(
  sessionId,
  'Classify: "I love this!"',
  ['positive', 'negative', 'neutral']
);
// Returns: "positive"
```

### Tool Calling

```typescript
// Define tools
const sessionId = await FoundationModels.createSessionWithTools({
  instructions: 'Help users with weather information',
  tools: [{
    name: 'getWeather',
    description: 'Get current weather for a city',
    parameters: {
      type: 'object',
      properties: {
        city: { type: 'string', description: 'City name' }
      },
      required: ['city']
    }
  }]
});

// Get response (may be text or tool call)
const response = await FoundationModels.respondWithTools(
  sessionId,
  "What's the weather in Tokyo?"
);

if (response.type === 'toolCall') {
  // Execute your tool
  const weatherData = await fetchWeather(response.toolCall.arguments.city);
  
  // Submit result back
  const finalResponse = await FoundationModels.submitToolResult(sessionId, {
    callId: response.toolCall.id,
    result: weatherData
  });
  console.log(finalResponse.content);
}
```

### Session Management

```typescript
// Get conversation history
const transcript = await FoundationModels.getTranscript(sessionId);
for (const entry of transcript) {
  console.log(`${entry.type}: ${entry.content}`);
}

// Prewarm for faster responses
await FoundationModels.prewarm(sessionId, {
  promptPrefix: 'You are helping with coding tasks:'
});

// Resume a session with history
const sessionId = await FoundationModels.createSessionWithTranscript([
  { type: 'prompt', content: 'What is React?' },
  { type: 'response', content: 'React is a JavaScript library...' }
], 'You are a programming tutor');
```

### Adapters (Fine-tuned Models)

```typescript
// Load adapter from Background Assets
const adapter = await FoundationModels.loadAdapter('myCustomAdapter', {
  compile: true  // Compile for faster inference
});

// Create session with adapter
const sessionId = await FoundationModels.createSession({
  adapterId: adapter.id,
  guardrails: 'default'
});

// Check compatibility
const compatible = await FoundationModels.isAdapterCompatible('myAdapter');

// Clean up obsolete adapters
await FoundationModels.removeObsoleteAdapters();
```

### Feedback

```typescript
// Log feedback on response quality
await FoundationModels.logFeedback(sessionId, {
  sentiment: 'negative',
  issues: [
    { category: 'incorrect', explanation: 'Wrong date provided' },
    { category: 'tooVerbose' }
  ],
  desiredResponse: 'The correct date is January 1, 2020'
});
```

### CoreML

```typescript
import { CoreML } from 'expo-foundation-models';

// Load a model from app bundle
const modelId = await CoreML.loadModel('MyClassifier');

// Run prediction
const result = await CoreML.predict(modelId, {
  inputFeature: [1.0, 2.0, 3.0, 4.0]
});

// Check if loaded
const loaded = CoreML.isModelLoaded(modelId);

// Unload to free memory
await CoreML.unloadModel(modelId);
```

## Error Handling

```typescript
import { FoundationModels, FoundationModelsError } from 'expo-foundation-models';

try {
  const response = await FoundationModels.respond(sessionId, prompt);
} catch (error) {
  if (error instanceof FoundationModelsError) {
    switch (error.type) {
      case 'guardrailViolation':
        console.log('Content blocked by safety filters');
        break;
      case 'refusal':
        console.log('Model refused:', error.refusalExplanation);
        break;
      case 'notAvailable':
        console.log('Foundation Models not available');
        break;
      case 'sessionNotFound':
        console.log('Session expired or invalid');
        break;
    }
  }
}
```

## Platform Support

| Feature | iOS | Android |
|---------|-----|---------|
| Foundation Models | iOS 26.0+ | Not supported |
| CoreML | iOS 16.0+ | Not supported |

On Android, all Foundation Models and CoreML functions will throw `PlatformNotSupportedException`.

## Requirements

- **Expo SDK 54+**
- **iOS 26.0+** for Foundation Models
- **iOS 16.0+** for CoreML only
- **Apple Intelligence** must be enabled in device Settings
- Device with Apple Silicon (A17+ for Foundation Models)

## License

MIT

## Contributing

Contributions are welcome! Please see the [contributing guide](https://github.com/SwiftyJunnos/expo-foundation-models/blob/main/CONTRIBUTING.md).
