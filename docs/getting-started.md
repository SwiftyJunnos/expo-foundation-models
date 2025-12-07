# Getting Started

This guide covers installation, setup, and basic usage of `expo-foundation-models`.

## Installation

### Expo Projects

```bash
npx expo install expo-foundation-models
```

### Bare React Native Projects

```bash
npm install expo-foundation-models
npx pod-install
```

## Requirements

### Foundation Models (Apple Intelligence)

- **iOS 26.0+** (currently in beta)
- **Apple Silicon device** (A17 Pro or later)
- **Apple Intelligence enabled** in Settings > Apple Intelligence & Siri

### CoreML

- **iOS 16.0+**
- Any iOS device

### Development

- **Expo SDK 54+**
- **Xcode 16+** with iOS 26 SDK

## Checking Availability

Always check if Foundation Models is available before use:

```typescript
import { FoundationModels } from 'expo-foundation-models';

// Simple boolean check
if (FoundationModels.isAvailable()) {
  // Foundation Models is ready to use
}

// Detailed availability with reason
const availability = FoundationModels.getAvailability();
console.log(availability);
// {
//   available: false,
//   status: 'unavailable',
//   reason: 'appleIntelligenceNotEnabled'
// }
```

### Availability Reasons

| Reason | Description |
|--------|-------------|
| `deviceNotEligible` | Device doesn't support Apple Intelligence |
| `appleIntelligenceNotEnabled` | User hasn't enabled Apple Intelligence in Settings |
| `modelNotReady` | Model is still downloading |
| `platformNotSupported` | Running on Android or unsupported iOS version |

## Basic Usage

### 1. Create a Session

```typescript
import { FoundationModels } from 'expo-foundation-models';

// Basic session
const sessionId = await FoundationModels.createSession();

// With system instructions
const sessionId = await FoundationModels.createSession(
  'You are a helpful assistant that speaks concisely.'
);

// With full configuration
const sessionId = await FoundationModels.createSession({
  instructions: 'You are a helpful assistant.',
  guardrails: 'default',
  useCase: 'general',
});
```

### 2. Generate a Response

```typescript
const response = await FoundationModels.respond(
  sessionId,
  'What is the capital of France?'
);
console.log(response); // "The capital of France is Paris."
```

### 3. Stream a Response

```typescript
let fullResponse = '';

await FoundationModels.streamResponse(
  sessionId,
  'Tell me a short story.',
  (token) => {
    fullResponse += token;
    console.log(token); // Each token as it arrives
  }
);

console.log(fullResponse); // Complete response
```

### 4. Close the Session

```typescript
await FoundationModels.closeSession(sessionId);
```

## Complete Example

```typescript
import { FoundationModels, FoundationModelsError } from 'expo-foundation-models';

async function chat() {
  // Check availability
  const { available, reason } = FoundationModels.getAvailability();
  
  if (!available) {
    console.log(`Foundation Models unavailable: ${reason}`);
    return;
  }

  let sessionId: string | null = null;

  try {
    // Create session
    sessionId = await FoundationModels.createSession(
      'You are a friendly assistant.'
    );

    // Generate response
    const response = await FoundationModels.respond(
      sessionId,
      'Hello! What can you help me with?'
    );
    
    console.log('Assistant:', response);

    // Continue conversation
    const followUp = await FoundationModels.respond(
      sessionId,
      'Tell me a fun fact.'
    );
    
    console.log('Assistant:', followUp);

  } catch (error) {
    if (error instanceof FoundationModelsError) {
      console.error(`Error (${error.type}):`, error.message);
    } else {
      console.error('Unexpected error:', error);
    }
  } finally {
    // Always clean up
    if (sessionId) {
      await FoundationModels.closeSession(sessionId);
    }
  }
}
```

## Next Steps

- [Foundation Models](./foundation-models.md) - Learn about generation options and streaming
- [Structured Output](./structured-output.md) - Generate JSON with schemas
- [Tool Calling](./tool-calling.md) - Let the model call your functions
- [Error Handling](./error-handling.md) - Handle errors gracefully
