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
- **Xcode 27 with the iOS 27 SDK** to compile the native module. Runtime availability
  checks retain iOS 26 support; they do not make the source compile with older SDKs.
- **UIKit scene lifecycle** in the host app. Apps built with the iOS 27 SDK fail
  to launch on iOS 27 without it. See Apple's
  [scene lifecycle migration guide](https://developer.apple.com/documentation/uikit/transitioning-to-the-uikit-scene-based-life-cycle).

## TestFlight device testing

The `example` app exercises this repository's native module directly. Its iOS
deployment target is 16.0 so Expo autolinking includes the module. Keep
`expo.autolinking.nativeModulesDir` set to `..`; a `file:..` dependency can create
recursive package copies when Bun installs the parent project.
The example's `with-ios-scene-lifecycle` config plugin creates a scene-owned
window, starts React Native when the scene connects, and forwards lifecycle and
link events to the existing Expo app delegate. Keep this plugin enabled when
generating the native project; adding only a scene manifest is not sufficient.

From the repository root:

```bash
bun install --no-save
bun run build
cd example
bun install --frozen-lockfile
bunx expo prebuild --platform ios --clean
bun run build:testflight --output /tmp/foundation-models-test.ipa
bun run submit:testflight --path /tmp/foundation-models-test.ipa
```

The build runs locally with the selected Xcode and uses EAS-managed signing
credentials. The submission goes to App Store Connect, not public App Store
release. First-time setup requires an Apple Developer account and
`bunx eas-cli credentials --platform ios`. Enter passwords and verification codes
only in the terminal. EAS manages build numbers remotely.

After Apple processes the build, complete any export-compliance questions and
install it through the internal TestFlight group. Record the app build number,
device model, iOS version, feature flags, and exact error for each check:

| Screen | Device checks |
| --- | --- |
| Startup | Cold launch the Release app, background and reopen it, then terminate and relaunch; no Metro server should be required |
| Basic | Create a session, generate text, stream a response, close the session |
| Structured | Generate structured data and classify using constrained choices |
| Tools | Receive a tool call, execute it, submit its result, inspect the follow-up |
| Session | Read the transcript, prewarm, and resume conversation history |
| iOS 27 | Detect capabilities; check token counting on iOS 26.4+ and image prompts, reasoning options, and required tool calls on iOS 27 |

PCC success requires Apple's managed
[Private Cloud Compute entitlement](https://developer.apple.com/private-cloud-compute/).
Without approval, record PCC as unavailable, not successfully tested.
Unsupported feature controls and errors should also be checked on older devices.
A successful build or TestFlight upload does not establish functional correctness
on a real device.

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
