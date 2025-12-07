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
| **Adapters** | Load fine-tuned models |
| **CoreML** | Run any CoreML model |

### Platform Support

| Feature | iOS | Android |
|---------|-----|---------|
| Foundation Models | iOS 26.0+ | Not supported |
| CoreML | iOS 16.0+ | Not supported |

> **Note:** Foundation Models requires an Apple Silicon device with Apple Intelligence enabled in Settings.

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

## Documentation

| Guide | Description |
|-------|-------------|
| [Getting Started](./docs/getting-started.md) | Installation, setup, and basic usage |
| [Foundation Models](./docs/foundation-models.md) | Text generation, streaming, and options |
| [Structured Output](./docs/structured-output.md) | JSON Schema generation and choices |
| [Tool Calling](./docs/tool-calling.md) | Function calling and tool execution |
| [Session Management](./docs/session-management.md) | Transcripts, prewarm, and history |
| [Adapters](./docs/adapters.md) | Loading fine-tuned models |
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
- **Apple Intelligence** enabled in device Settings
- Device with Apple Silicon (A17+ for Foundation Models)

## License

MIT

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## Links

- [Changelog](./CHANGELOG.md)
- [Roadmap](./ROADMAP.md)
- [GitHub Issues](https://github.com/SwiftyJunnos/expo-foundation-models/issues)
