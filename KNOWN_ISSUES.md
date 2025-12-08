# Known Issues and Workarounds

This document tracks known issues with the iOS 26 beta Foundation Models API and the workarounds implemented in this library.

## Issue #1: DynamicGenerationSchema Not Supported at Runtime

**Status:** Workaround implemented  
**Affected APIs:** `respondWithSchema()`, `respondWithChoices()`, `streamWithSchema()`  
**iOS Version:** iOS 26 beta (as of December 2024)

### Problem

Apple's `DynamicGenerationSchema` API does not support runtime schema construction in the current iOS 26 beta. The intended usage pattern was:

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

### Workaround

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

### Limitations

- **Reliability:** The model might not always produce valid JSON
- **No native enforcement:** Invalid output is possible despite instructions
- **Token usage:** Slightly higher due to schema in prompt
- **Streaming:** Partial JSON parsing may fail for incomplete responses

### Code References

- Swift implementation: `ios/ExpoFoundationModelsModule.swift:637-690`
- JSON parsing helpers: `ios/ExpoFoundationModelsModule.swift:759-870`

### Future

This workaround will be replaced with native `DynamicGenerationSchema` support when Apple stabilizes the API. Monitor Apple's Foundation Models documentation for updates.

---

## Issue #2: Tool Calling API Requires Compile-Time Types

**Status:** Workaround implemented  
**Affected APIs:** `createSessionWithTools()`, `respondWithTools()`, `submitToolResult()`  
**iOS Version:** iOS 26 beta (as of December 2024)

### Problem

The native Foundation Models Tool API requires compile-time `@Generable` argument types. These Swift types must be defined at compile time, making it impossible to create dynamic tool definitions from JavaScript.

### Workaround

We use a **prompt-based approach**:

1. Tool definitions are stored separately when creating a session
2. When responding, tool definitions are included in the prompt
3. The model is instructed to respond with a JSON tool call if needed
4. The response is parsed to detect tool calls
5. Tool results are submitted by continuing the conversation with the result

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

### Limitations

- Model may not always format tool calls correctly
- No native tool call validation
- Slightly higher token usage due to tool definitions in prompt

### Code References

- Session creation: `ios/ExpoFoundationModelsModule.swift:951-991`
- Prompt building: `ios/ExpoFoundationModelsModule.swift` (search for `buildToolsPrompt`)
- Response parsing: `ios/ExpoFoundationModelsModule.swift` (search for `parseToolCallResponse`)

---

## Issue #3: Transcript API Compatibility

**Status:** Workaround implemented  
**Affected APIs:** `getTranscript()`, `createSessionWithTranscript()`  
**iOS Version:** iOS 26 beta (as of December 2024)

### Problem

The `Transcript` type and session initialization with existing transcripts have changed.

### Workaround

- Transcript extraction uses reflection to access internal properties
- `createSessionWithTranscript` is stubbed (creates new session without history)

### Code References

- Swift implementation: `ios/ExpoFoundationModelsModule.swift` (search for `Transcript`)

---

## Reporting Issues

If you encounter additional issues or have suggestions for workarounds:

1. Check this document and existing GitHub issues first
2. Open a new issue at: https://github.com/mcp-foundation/expo-foundation-models/issues
3. Include iOS version, Xcode version, and steps to reproduce

## Updates

This document is updated as the iOS 26 beta evolves. Last updated: December 2024
