# expo-foundation-models

Expo bindings for Apple's **Foundation Models** API and **Core ML**.

[![npm version](https://img.shields.io/npm/v/expo-foundation-models.svg)](https://www.npmjs.com/package/expo-foundation-models)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

`expo-foundation-models` runs Apple's on-device language model from React Native and Expo apps. Prompts and responses stay on the device. The package also runs custom Core ML models.

### Features

| Feature | Description |
|---------|-------------|
| On-device LLM | Generate text with Apple Intelligence without sending prompts to an external server |
| Structured output | Generate JSON that matches a schema |
| Tool calling | Allow the model to call JavaScript functions |
| Streaming | Receive responses as they are generated |
| Session management | Keep conversation history, prewarm a session, or resume one |
| Adapters | Load fine-tuned models |
| Core ML | Run custom Core ML models |

### Platform support

| Capability | iOS | Android |
|------------|-----|---------|
| Core ML | iOS 16.0+ | Not supported |
| Foundation Models | iOS 26.0+ | Not supported |
| Token counting (`getTokenCount`, `getContextSize`) | iOS 26.4+ | Not supported |
| Private Cloud Compute sessions (`model.type: 'privateCloudCompute'`) | iOS 27.0+ | Not supported |
| Image attachments | iOS 27.0+ | Not supported |
| Context options (`contextOptions`) | iOS 27.0+ | Not supported |
| Tool calling mode (`toolCallingMode`) | iOS 27.0+ | Not supported |
| Model variant info (`getModelVariant`) | Reserved. The iOS 27 SDK does not include the symbol, so this returns `null`. | Not supported |

> Foundation Models requires an Apple Silicon device (A17 Pro or later) with Apple Intelligence enabled in Settings. Capabilities past the base API track OS versions; check them at runtime with [`getFeatures()`](#feature-detection), and see [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) for the known iOS 26/27 differences.

## Installation

Requires Expo SDK 54+.

```bash
npx expo install expo-foundation-models
```

For bare React Native projects:
```bash
npm install expo-foundation-models
npx pod-install
```

## Quick start

```typescript
import { FoundationModels } from 'expo-foundation-models';

// Check whether Foundation Models is available.
if (FoundationModels.isAvailable()) {
  const sessionId = await FoundationModels.createSession('You are a helpful assistant.');

  const response = await FoundationModels.respond(sessionId, 'Hello!');
  console.log(response);

  await FoundationModels.closeSession(sessionId);
}
```

## Feature detection

Call `getFeatures()` before using an optional capability, and branch on the returned booleans. Each flag reports whether the capability actually works on this device, not just whether the OS version should contain it: on iOS 27+, `privateCloudCompute` can still be `false` when no Private Cloud Compute model is available for the user's account. Calling a method below its minimum OS version rejects with `featureUnavailable` instead of crashing.

```typescript
const features = await FoundationModels.getFeatures();

if (features.features.imageAttachments) {
  // iOS 27+: send an image alongside the prompt.
  const sessionId = await FoundationModels.createSession();
  const caption = await FoundationModels.respond(sessionId, {
    text: 'Describe this photo.',
    images: [{ uri: 'file:///tmp/photo.jpg' }],
  });
}
```

The full flag list and per-capability examples are in [docs/getting-started.md](./docs/getting-started.md) and [docs/foundation-models.md](./docs/foundation-models.md).

## Documentation

| Guide | Description |
|-------|-------------|
| [Getting started](./docs/getting-started.md) | Install and configure the package |
| [Foundation Models](./docs/foundation-models.md) | Generate and stream text |
| [Structured output](./docs/structured-output.md) | Generate values from JSON Schema |
| [Tool calling](./docs/tool-calling.md) | Define and run tools |
| [Session management](./docs/session-management.md) | Manage transcripts, prewarming, and history |
| [Adapters](./docs/adapters.md) | Train and load fine-tuned models, including the full LoRA training workflow |
| [Feedback](./docs/feedback.md) | Record response quality |
| [Core ML](./docs/coreml.md) | Run custom Core ML models |
| [Error handling](./docs/error-handling.md) | Handle package errors |

A demo of every API lives in the [example app](./example): `cd example && npx expo run:ios`.

## License

MIT

## Links

- [Changelog](./CHANGELOG.md)
- [Roadmap](./ROADMAP.md)
- [GitHub Issues](https://github.com/SwiftyJunnos/expo-foundation-models/issues)
