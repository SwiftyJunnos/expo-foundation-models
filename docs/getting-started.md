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

- **iOS 26.0+** for the base API (text generation, streaming, structured output, tool calling)
- **iOS 26.4+** for token counting (`getTokenCount`, `getContextSize`)
- **iOS 27.0+** for Private Cloud Compute sessions, multimodal image attachments,
  context options (`contextOptions`), and tool calling mode (`toolCallingMode`)
  (`getModelVariant()` exists but always returns `null` — the underlying symbol was
  not shipped in the final iOS 27 SDK)
- **Apple Silicon device** (A17 Pro or later)
- **Apple Intelligence enabled** in Settings > Apple Intelligence & Siri

### CoreML

- **iOS 16.0+**
- Any iOS device

### Development

- **Expo SDK 54+**
- **Xcode with the iOS 26 SDK or newer** (iOS 27 SDK required to build the iOS 27 paths)

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

### Feature Detection

Beyond availability, use `getFeatures()` to check which optional capabilities are
usable on the current device before using them. Flags reflect **actual runtime
usability**, not just OS presence: on iOS 27+ a flag can still be `false` —
`privateCloudCompute` also requires an available Private Cloud Compute model for
the user's Apple Intelligence account, and `modelVariant` stays `false` because
the symbol is absent from the shipped iOS 27 SDK.

```typescript
const features = await FoundationModels.getFeatures();
// {
//   osVersion: '27.0',
//   features: {
//     privateCloudCompute: true,   // iOS 27+ AND PCC model available for this account
//     imageAttachments: true,      // iOS 27+
//     contextOptions: true,        // iOS 27+
//     toolCallingMode: true,       // iOS 27+
//     tokenCounting: true,         // iOS 26.4+
//     modelVariant: false,        // reserved — symbol absent from iOS 27 SDK
//   }
// }

if (!features.features.privateCloudCompute) {
  // Fall back to on-device model sessions — always supported on iOS 26+
}
```

All flags are `false` below the minimum OS for that capability, and may also be
`false` above it when the underlying model is not usable at runtime (see above).
Calling a capability gated method without checking still fails safely: it rejects
with error code `featureUnavailable` rather than crashing.

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
