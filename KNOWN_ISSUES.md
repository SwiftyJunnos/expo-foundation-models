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

## Issue #2: Tool Result Submission API Changed

**Status:** Stubbed (not functional)  
**Affected APIs:** `submitToolResult()`  
**iOS Version:** iOS 26 beta (as of December 2024)

### Problem

The tool result submission API has changed in recent betas. The previous pattern of submitting tool results back to the session no longer works as expected.

### Current State

- Tool definitions and tool call requests work
- Submitting results back to continue the conversation is stubbed
- The function returns a placeholder response

### Code References

- Swift implementation: `ios/ExpoFoundationModelsModule.swift` (search for `submitToolResult`)

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
