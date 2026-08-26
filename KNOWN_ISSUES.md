# Known Issues and Workarounds

This document tracks known issues with Apple's Foundation Models API and the
workarounds implemented in this library. Items marked **Resolved on iOS 27** still use
their iOS 26 fallback on older devices — the library selects the path automatically at
runtime and both paths share the same TypeScript wire format.

## Issue #1: DynamicGenerationSchema Not Supported at Runtime

**Status:** Resolved on iOS 27.0+ · fallback retained for iOS 26  
**Affected APIs:** `respondWithSchema()`, `respondWithChoices()`, `streamWithSchema()`  
**iOS Version:** iOS 26.x (fallback path)

### Problem

On iOS 26, Apple's `DynamicGenerationSchema` API does not support runtime schema
construction. The intended usage pattern was:

```swift
// This doesn't work in current beta
let schema = DynamicGenerationSchema(
    name: "Person",
    properties: [
        "name": .string,
        "age": .integer
    ]
)
```

### Fallback (iOS 26)

We use a **prompt-based approach**:

1. The JSON schema is serialized and included in the prompt
2. The model is instructed to output valid JSON matching the schema
3. The response is parsed and validated using `JSONSerialization`

```swift
let structuredPrompt = """
\(prompt)

You MUST respond with a valid JSON object that conforms to this JSON Schema:
```json
\(schemaString)
```

IMPORTANT:
- Output ONLY the JSON object, no markdown code blocks, no explanation
- Ensure all required fields are present
"""
```

### What Changed on iOS 27

Under `#available(iOS 27.0, *)`, schemas are converted **natively**:
JSON Schema → `DynamicGenerationSchema` → `GenerationSchema`. Output is enforced by the
framework instead of prompt instructions; the same wire format is preserved.

### Root Schemas and Image Attachments

- **Non-object roots:** Schemas whose root is an array, string, number, boolean, or null
  are supported on both paths — the generated value is returned directly (native
  conversion via `anyFromGeneratedContent` on iOS 27+, JSON parsing of the response text
  on the iOS 26 fallback). There is no post-generation failure for non-object roots.
- **Image attachments:** When a structured-output prompt carries images, they are always
  forwarded to the model through a native `Prompt` with `Attachment`s — including on the
  fallback path. On iOS 26 or earlier, image attachments reject explicitly with
  `featureUnavailable`; images are never silently dropped.

### Remaining Limitations (iOS 26 fallback only)

- **Reliability:** The model might not always produce valid JSON
- **No native enforcement:** Invalid output is possible despite instructions
- **Token usage:** Slightly higher due to schema in prompt
- **Streaming:** Partial JSON parsing may fail for incomplete responses

---

## Issue #2: Tool Calling API Requires Compile-Time Types

**Status:** Workaround on all supported OS versions · unified JavaScript-driven flow  
**Affected APIs:** `createSessionWithTools()`, `respondWithTools()`, `submitToolResult()`  
**iOS Version:** iOS 26.x and iOS 27.0+

### Problem

On iOS 26, the native Foundation Models Tool API requires compile-time `@Generable`
argument types. These Swift types must be defined at compile time, making it impossible
to create dynamic tool definitions from JavaScript.

### Approach (All OS Versions)

We use a **prompt-based approach**:

1. Tool definitions are stored separately when creating a session
2. When responding, tool definitions are included in the prompt
3. The model is instructed to respond with a JSON tool call if needed
4. The response is parsed to detect tool calls
5. The app executes the tool handler in JavaScript and submits the result with
   `submitToolResult`, which continues generation with that result

```swift
let structuredPrompt = """
You have access to the following tools:

Tool: getWeather
Description: Get current weather for a city
Parameters:
  - city (string): City name
  - unit (string): Temperature unit

User request: \(prompt)

If you need to use a tool, respond with ONLY:
{"tool_call": {"name": "toolName", "arguments": {...}}}
"""
```

### Behavior on iOS 27

The tool-calling flow is identical on iOS 27+: the model still returns a JSON tool call,
JavaScript executes it, and `submitToolResult` continues the conversation. Native tool
code never fabricates or short-circuits results. The only iOS 27-specific addition is the
`toolCallingMode` (`'allowed' | 'required' | 'disallowed'`) generation option, which
rejects with `featureUnavailable` on iOS 26 or earlier.

### Remaining Limitations (All OS Versions)

- Model may not always format tool calls correctly
- No native tool call validation
- Slightly higher token usage due to tool definitions in prompt

---

## Issue #3: Transcript API Compatibility

**Status:** Partially resolved · workaround retained  
**Affected APIs:** `getTranscript()`, `createSessionWithTranscript()`  
**iOS Version:** all versions

### Problem

The `Transcript` type and session initialization with existing transcripts have changed
across OS releases. On iOS 27, `Transcript.StructuredSegment.source` was renamed to
`.schemaName` (and `init(id:source:content:)` → `init(id:schemaName:content:)`), which is
a compile-time break handled inside availability-guarded native code.

### Workaround

- Transcript extraction uses reflection to access internal properties
- `createSessionWithTranscript` is stubbed (creates new session without history)
- Structured-segment decoding handles both field names depending on OS version

---

## Out of Scope

The following iOS 27 APIs are intentionally **not supported** by this library:

| Feature | Reason |
|---------|--------|
| Custom `LanguageModel` / `LanguageModelExecutor` implementations | Swift-only protocols; meaningless across the React Native bridge |
| `DynamicProfile` / `DynamicInstructions` sessions | Swift-only dynamic instruction/profile construction; no bridge representation |
| `transcriptErrorHandlingPolicy` | Policy object is Swift-native; errors are already normalized to stable string codes at the bridge boundary |
| Vision OCRTool / BarcodeReaderTool wrappers | Vision-framework tools outside the Foundation Models surface this module targets |

## Issue #4: iOS 27 SDK Gaps vs. Documented API

**Status:** Known limitation of the shipped iOS 27.0 SDK

- **Model variant:** Apple's documentation lists `SystemLanguageModel.variant` for
  iOS 27, but the final SDK does not include the symbol (verified against the
  swiftinterface). `getModelVariant()` is kept behind the iOS 27 guard and returns
  `null` on every OS version; the `modelVariant` feature flag reports `false`.
- **Adapters on iOS 27+:** `SystemLanguageModel(adapter:)` was obsoleted in the iOS 27
  SDK with no replacement. On iOS 27+ a session created with `adapterId` silently falls
  back to the default system model; on iOS ≤26 adapter sessions behave as before.
  Adapter loading/compilation APIs remain functional.

---

## Error Code Normalization

`LanguageModelSession.GenerationError` was obsoleted in the iOS 27 SDK (replaced by
`LanguageModelError`, `SystemLanguageModel.Error`, and `LanguageModelSession.Error`).
The library maps every failure to one stable string code exposed as
`FoundationModelsErrorCode` (`contextSizeExceeded`, `rateLimited`, `refusal`,
`guardrailViolation`, …) so behavior is identical on iOS 26 and 27 devices. Old-to-new
mapping: `exceededContextWindowSize` → `contextSizeExceeded`,
`unsupportedGuide` → `unsupportedGenerationGuide`.

---

## Reporting Issues

If you encounter additional issues or have suggestions for workarounds:

1. Check this document and existing GitHub issues first
2. Open a new issue at: https://github.com/mcp-foundation/expo-foundation-models/issues
3. Include iOS version, Xcode version, and steps to reproduce

## Updates

This document tracks the evolving Foundation Models API across iOS 26/27 releases.
Last updated: August 2026
