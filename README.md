# expo-foundation-models

Expo module for Apple's **Foundation Models** (on-device LLM with Apple Intelligence) and **CoreML** integration.

[![npm version](https://img.shields.io/npm/v/expo-foundation-models.svg)](https://www.npmjs.com/package/expo-foundation-models)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

`expo-foundation-models` provides React Native/Expo bindings for Apple's on-device language model, enabling private, fast AI text generation without sending data to external servers. It also includes CoreML support for running custom machine learning models.

### Key Features

| Feature | Description |
|---------|-------------|
| **On-device LLM** | Private text generation using Apple Intelligence |
| **Structured Output** | Generate JSON conforming to schemas |
| **Tool Calling** | Let the model call your functions |
| **Streaming** | Token-by-token response streaming |
| **Session Management** | Conversation history, prewarm, resume |
| **Adapters** | Load and use fine-tuned models |
| **CoreML** | Run any CoreML model |

### Platform Support

| Capability | iOS | Android |
|------------|-----|---------|
| CoreML | iOS 16.0+ | Not supported |
| Foundation Models (base) | iOS 26.0+ | Not supported |
| Token counting (`getTokenCount`, `getContextSize`) | iOS 26.4+ | Not supported |
| Private Cloud Compute sessions (`model.type: 'privateCloudCompute'`) | iOS 27.0+ | Not supported |
| Multimodal image attachments | iOS 27.0+ | Not supported |
| Context options (`contextOptions`) | iOS 27.0+ | Not supported |
| Tool calling mode (`toolCallingMode`) | iOS 27.0+ | Not supported |
| Model variant info (`getModelVariant`) | Reserved (returns `null` — symbol absent from iOS 27 SDK) | Not supported |

> **Note:** Foundation Models requires an Apple Silicon device with Apple Intelligence enabled in Settings.

> **iOS 26 / 27 Notice:** Foundation Models APIs evolve quickly across OS releases. This
> library keeps every iOS 26 fallback in place and switches to native implementations
> automatically when running on iOS 27+:
> - **Structured Output**: On iOS 26 the JSON Schema is embedded in the prompt and the response is parsed. On iOS 27+ the schema is converted natively (`DynamicGenerationSchema` → `GenerationSchema`); same wire format, better reliability.
> - **Tool Calling**: Tool calls use a JavaScript-driven prompt flow on every supported OS version: the model returns a JSON tool call, your code executes the tool, and `submitToolResult` continues the conversation with the result.
> - **New capabilities** (Private Cloud Compute, image attachments, context options, tool calling mode) require iOS 27+. Detect them at runtime with `getFeatures()`. The `modelVariant` flag stays `false`: Apple documented a model-variant API for iOS 27 but the final SDK does not ship it, so `getModelVariant()` currently returns `null` on every OS version.
>
> See [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) for details.

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

## Feature Detection

Use `getFeatures()` to discover which optional capabilities the current device supports,
and gate new-API usage behind the flags. All flags are `false` on older OS versions.
On iOS 27+ a flag can still be `false`: each flag reports **actual runtime usability**,
not just OS presence. `privateCloudCompute` additionally requires an available
Private Cloud Compute model for the user's Apple Intelligence account/model, and
`modelVariant` stays `false` because the symbol is absent from the shipped iOS 27 SDK.
Always branch on the returned booleans — JavaScript cannot re-derive them.

```typescript
import { FoundationModels } from 'expo-foundation-models';

const features = await FoundationModels.getFeatures();
console.log(await FoundationModels.getFeatures());
// {
//   osVersion: '27.0',
//   features: {
//     privateCloudCompute: true, // iOS 27+ AND a PCC model is available for this Apple Intelligence account
//     imageAttachments: true,
//     contextOptions: true,
//     toolCallingMode: true,
//     tokenCounting: true,   // iOS 26.4+
//     modelVariant: false,   // reserved — symbol absent from the shipped iOS 27 SDK
//   }
// }

if (features.features.privateCloudCompute) {
  // Private Cloud Compute session (iOS 27+)
  const sessionId = await FoundationModels.createSession({
    instructions: 'You are a helpful assistant.',
    model: { type: 'privateCloudCompute' },
  });
}

if (features.features.imageAttachments) {
  // Multimodal prompt (iOS 27+) — string prompts still work everywhere
  const sessionId = await FoundationModels.createSession();
  const caption = await FoundationModels.respond(sessionId, {
    text: 'Describe this photo.',
    images: [{ uri: 'file:///tmp/photo.jpg' }],
  });
}

if (features.features.contextOptions) {
  // Reasoning effort control (iOS 27+)
  const answer = await FoundationModels.respond(sessionId, 'Explain RSA.', {
    contextOptions: { reasoningLevel: 'deep', includeSchemaInPrompt: false },
  });
}

if (features.features.toolCallingMode) {
  // Force or forbid tool usage (iOS 27+)
  const forced = await FoundationModels.respondWithTools(sessionId, 'Weather in Tokyo?', {
    toolCallingMode: 'required',
  });
}

if (features.features.tokenCounting) {
  const tokens = await FoundationModels.getTokenCount('Hello, world!'); // iOS 26.4+
  const size = await FoundationModels.getContextSize();                 // number | null
  const variant = await FoundationModels.getModelVariant();            // reserved — currently null on every OS version
}
```
>
> With `toolCallingMode: 'required'` the request fails with a normalized generation
> error if the model does not produce a tool call; `'disallowed'` omits tool
> definitions entirely and always returns plain text.

> **PCC session configuration:** PCC sessions support `instructions`, prompt-based
> `tools`, default (or omitted) guardrails, and the `general` (or omitted) use case.
> `useCase: 'contentTagging'`, `guardrails: 'permissiveContentTransformations'`,
> and `adapterId` reject with the `featureUnavailable` error code instead of being
> silently ignored. See [docs/foundation-models.md](./docs/foundation-models.md).

On devices below the minimum OS for a capability, calling the corresponding method
rejects with error code `featureUnavailable` instead of crashing — always check
the flag first.

## Documentation

| Guide | Description |
|-------|-------------|
| [Getting Started](./docs/getting-started.md) | Installation, setup, and basic usage |
| [Foundation Models](./docs/foundation-models.md) | Text generation, streaming, and options |
| [Structured Output](./docs/structured-output.md) | JSON Schema generation and choices |
| [Tool Calling](./docs/tool-calling.md) | Function calling and tool execution |
| [Session Management](./docs/session-management.md) | Transcripts, prewarm, and history |
| [Adapters](./docs/adapters.md) | Training and loading fine-tuned models |
| [Feedback](./docs/feedback.md) | Response quality logging |
| [CoreML](./docs/coreml.md) | Custom ML model integration |
| [Error Handling](./docs/error-handling.md) | Error types and handling patterns |

## Example

Check out the [example app](./example) for a complete demo showcasing all features.

```bash
cd example
npx expo run:ios
```

## Requirements

- **Expo SDK 54+**
- **iOS 26.0+** for Foundation Models
- **iOS 16.0+** for CoreML only
- **iOS 26.4+** for token counting (`getTokenCount` / `getContextSize`)
- **iOS 27.0+** for Private Cloud Compute, image attachments, context options, and tool calling mode (`getModelVariant()` is a reserved API that returns `null` on all versions)
- **Apple Intelligence** enabled in device Settings
- Device with Apple Silicon (A17+ for Foundation Models)

## Adapter Training

Want to create custom adapters for specialized tasks? Apple provides a Python toolkit for training adapters using LoRA (Low-Rank Adaptation).

| Task | Tool |
|------|------|
| **Train adapters** | [Apple's Python Toolkit](https://developer.apple.com/apple-intelligence/foundation-models-adapter/) |
| **Use adapters** | This package |

### Training Requirements

- Mac with Apple Silicon + 32GB RAM, or Linux GPU
- Python 3.11+
- 100-5,000+ training samples (prompt/response pairs)

### Quick Training Overview

```bash
# 1. Download toolkit from Apple Developer
# 2. Set up environment
conda create -n adapter-training python=3.11
pip install -r requirements.txt

# 3. Train adapter
python -m examples.train_adapter \
  --train-data train.jsonl \
  --eval-data valid.jsonl \
  --epochs 5

# 4. Export to .fmadapter
python -m export.export_fmadapter \
  --adapter-name my_adapter \
  --checkpoint checkpoints/adapter-final.pt \
  --output-dir exports/
```

Then load in your app:

```typescript
const adapter = await FoundationModels.loadAdapterFromFile('/path/to/my_adapter.fmadapter');
const sessionId = await FoundationModels.createSession({
  adapterId: adapter.id,
  instructions: 'You are a specialized assistant.',
});
```

See [Adapters Documentation](./docs/adapters.md) for complete details.

## License

MIT

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## Links

- [Changelog](./CHANGELOG.md)
- [Roadmap](./ROADMAP.md)
- [GitHub Issues](https://github.com/SwiftyJunnos/expo-foundation-models/issues)
