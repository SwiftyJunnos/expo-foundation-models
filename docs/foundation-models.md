# Foundation Models

This guide covers text generation, streaming, and generation options.

## Sessions

A session maintains conversation context. Create one before generating responses.

### Creating Sessions

```typescript
import { FoundationModels } from 'expo-foundation-models';

// Basic session
const sessionId = await FoundationModels.createSession();

// With instructions
const sessionId = await FoundationModels.createSession(
  'You are a helpful coding assistant.'
);

// With full configuration
const sessionId = await FoundationModels.createSession({
  instructions: 'You are a creative writer.',
  guardrails: 'default',
  useCase: 'general',
});
```

### Session Options

| Option | Type | Description | Availability |
|--------|------|-------------|--------------|
| `instructions` | `string` | System instructions for the model | iOS 26.0+ |
| `guardrails` | `'default' \| 'permissiveContentTransformations'` | Safety mode | iOS 26.0+ |
| `useCase` | `'general' \| 'contentTagging'` | Model optimization | iOS 26.0+ |
| `adapterId` | `string` | Custom adapter ID | iOS 26.0+ |
| `model` | `{ type: 'system' } \| { type: 'privateCloudCompute' }` | Model backing the session | `{ type: 'privateCloudCompute' }`: iOS 27.0+ |

### Guardrails Modes

- **`default`**: Standard safety filtering. Blocks unsafe content.
- **`permissiveContentTransformations`**: Allows processing sensitive source material for transformation tasks (e.g., summarizing articles with mature content).

### Use Cases

- **`general`**: General-purpose text generation (default)
- **`contentTagging`**: Optimized for categorization and tagging

## Model Selection

### Private Cloud Compute (iOS 27.0+)

By default every session runs fully on device (`SystemLanguageModel`). On iOS 27+ you can
back a session with Apple's **Private Cloud Compute** model for larger workloads while
preserving the same privacy guarantees:

```typescript
const features = await FoundationModels.getFeatures();

if (!features.features.privateCloudCompute) {
  // Stay on the on-device model (iOS 26 compatible default)
  const sessionId = await FoundationModels.createSession({
    instructions: 'You are a helpful assistant.',
  });
} else {
  const sessionId = await FoundationModels.createSession({
    instructions: 'You are a helpful assistant.',
    model: { type: 'privateCloudCompute' }, // PrivateCloudComputeLanguageModel
  });
}
```

- **Availability:** iOS 27.0+. The `privateCloudCompute` feature flag reports actual
  runtime usability: it is `true` only when the OS is iOS 27+ **and** Apple's
  `PrivateCloudComputeLanguageModel` is available for the user's Apple Intelligence
  account/model. On iOS 26 or earlier the request rejects with error code
  `featureUnavailable`.
- Explicitly pass `{ type: 'system' }` (or omit `model`) for the standard on-device model.

### Model Variant Info

```typescript
// Returns { displayName?: string } | null — currently null on ALL OS versions
const variant = await FoundationModels.getModelVariant();
```

> **Note:** Apple's documentation lists a `SystemLanguageModel.variant` API for iOS 27,
> but the shipped iOS 27.0 SDK does not include that symbol. `getModelVariant()` is kept
> behind the iOS 27 availability guard and returns `null` until Apple provides a
> replacement; the `modelVariant` feature flag therefore reports `false`.

## Token Counting & Context Size

Query token usage before sending prompts to stay within the context window.

- **Availability:** iOS 26.4+. `getContextSize()` returns `null` below iOS 26.4.

```typescript
const features = await FoundationModels.getFeatures();
if (features.features.tokenCounting) {
  const tokens = await FoundationModels.getTokenCount('Summarize this article...');
  const contextSize = await FoundationModels.getContextSize(); // number | null

  if (contextSize != null && tokens >= contextSize * 0.8) {
    console.warn('Prompt is close to the context limit');
  }
}
```

## Text Generation

### Basic Generation

```typescript
const response = await FoundationModels.respond(sessionId, 'Hello!');
console.log(response);
```

### With Generation Options

```typescript
const response = await FoundationModels.respond(
  sessionId,
  'Write a creative poem about the ocean.',
  {
    temperature: 1.5,
    sampling: { type: 'topP', probabilityThreshold: 0.95 },
    maximumResponseTokens: 500,
  }
);
```

### Generation Options

| Option | Type | Description |
|--------|------|-------------|
| `temperature` | `number` | Randomness (0.0-2.0). Higher = more creative |
| `sampling` | `SamplingMode` | Token selection strategy |
| `maximumResponseTokens` | `number` | Max tokens to generate |

### Sampling Modes

```typescript
// Greedy - Always pick most likely token (deterministic)
{ type: 'greedy' }

// Top-K - Sample from top K tokens
{ type: 'topK', k: 40, seed: 12345 }

// Top-P (Nucleus) - Sample until probability threshold
{ type: 'topP', probabilityThreshold: 0.9, seed: 12345 }
```

### Temperature Guide

| Temperature | Behavior | Use Case |
|-------------|----------|----------|
| 0.0 | Deterministic | Facts, code |
| 0.7 | Balanced | General chat |
| 1.0 | Default | Creative writing |
| 1.5+ | Very creative | Brainstorming |

## Streaming

Stream responses token-by-token for real-time display.

### Basic Streaming

```typescript
const response = await FoundationModels.streamResponse(
  sessionId,
  'Tell me a story.',
  (token) => {
    process.stdout.write(token);
  }
);
```

### React Native Example

```typescript
const [text, setText] = useState('');
const [isStreaming, setIsStreaming] = useState(false);

const handleStream = async () => {
  setIsStreaming(true);
  setText('');
  
  try {
    await FoundationModels.streamResponse(
      sessionId,
      prompt,
      (token) => setText((prev) => prev + token)
    );
  } finally {
    setIsStreaming(false);
  }
};
```

### Streaming with Options

```typescript
await FoundationModels.streamResponse(
  sessionId,
  'Write a haiku.',
  (token) => console.log(token),
  {
    temperature: 1.2,
    maximumResponseTokens: 100,
  }
);
```

## Conversation Context

Sessions maintain conversation history automatically.

```typescript
const sessionId = await FoundationModels.createSession(
  'You are a math tutor.'
);

// First message
await FoundationModels.respond(sessionId, 'What is 2 + 2?');
// "2 + 2 equals 4."

// Follow-up uses context
await FoundationModels.respond(sessionId, 'And if I add 3 more?');
// "4 + 3 equals 7."

// Another follow-up
await FoundationModels.respond(sessionId, 'What was my first question?');
// "Your first question was 'What is 2 + 2?'"
```

## Closing Sessions

Always close sessions when done to free resources.

```typescript
await FoundationModels.closeSession(sessionId);
```

### Using try/finally

```typescript
let sessionId: string | null = null;

try {
  sessionId = await FoundationModels.createSession();
  // Use session...
} finally {
  if (sessionId) {
    await FoundationModels.closeSession(sessionId);
  }
}
```

## Example: Chat Interface

```typescript
import { useState, useCallback } from 'react';
import { FoundationModels } from 'expo-foundation-models';

function useChat() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);

  const startChat = useCallback(async (instructions: string) => {
    const id = await FoundationModels.createSession(instructions);
    setSessionId(id);
    setMessages([]);
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!sessionId) return;
    
    setMessages((prev) => [...prev, { role: 'user', content }]);
    setIsLoading(true);

    try {
      let response = '';
      await FoundationModels.streamResponse(
        sessionId,
        content,
        (token) => {
          response += token;
          setMessages((prev) => {
            const updated = [...prev];
            const lastIndex = updated.length - 1;
            if (updated[lastIndex]?.role === 'assistant') {
              updated[lastIndex].content = response;
            } else {
              updated.push({ role: 'assistant', content: response });
            }
            return updated;
          });
        }
      );
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  const endChat = useCallback(async () => {
    if (sessionId) {
      await FoundationModels.closeSession(sessionId);
      setSessionId(null);
    }
  }, [sessionId]);

  return { messages, isLoading, startChat, sendMessage, endChat };
}
```

## Next Steps

- [Structured Output](./structured-output.md) - Generate JSON with schemas
- [Tool Calling](./tool-calling.md) - Let the model call functions
- [Session Management](./session-management.md) - Advanced session features
