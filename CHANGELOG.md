# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

#### iOS 27 Support
- `FoundationModels.getFeatures()` - Runtime feature detection returning
  `{ osVersion, features: { privateCloudCompute, imageAttachments, contextOptions, toolCallingMode, tokenCounting, modelVariant } }`
  (`getAvailability()` gains the same additive fields)
- Private Cloud Compute sessions via `createSession` option
  `model: { type: 'privateCloudCompute' }` (iOS 27.0+; rejects with `featureUnavailable` on iOS 26)
- Multimodal prompts: `respond`/`streamResponse` accept object prompts
  `{ text, images?: Array<{ uri } | { base64 }> }` (iOS 27.0+; string prompts unchanged)
- Context options in generation options:
  `contextOptions: { reasoningLevel?: 'light' | 'moderate' | 'deep', includeSchemaInPrompt?: boolean }`
  (iOS 27.0+; passing it on iOS 26 or earlier rejects with `featureUnavailable`)
- Tool calling mode in generation options:
  `toolCallingMode?: 'allowed' | 'required' | 'disallowed'`
  (iOS 27.0+; passing it on iOS 26 or earlier rejects with `featureUnavailable`)
- `FoundationModels.getTokenCount(text)` and `FoundationModels.getContextSize()` (iOS 26.4+;
  `getContextSize()` returns `null` below 26.4)
- `FoundationModels.getModelVariant()` (reserved API; returns `null` on all versions —
  `SystemLanguageModel.variant` is documented for iOS 27 but absent from the shipped SDK)
- Native structured output on iOS 27+: JSON Schema → `DynamicGenerationSchema` → `GenerationSchema`
  (prompt-based fallback retained on iOS 26)
- Tool calling on every supported OS version via the JavaScript-driven prompt flow:
  the model returns a parsed JSON tool call, the app executes the tool, and
  `submitToolResult` continues generation with the result
- Example app "iOS 27" tab demonstrating all new capabilities behind `getFeatures()` guards

### Changed

- Normalized error codes: every generation/session/model failure now maps to a single
  stable `FoundationModelsErrorCode` union (`contextSizeExceeded`, `rateLimited`, `refusal`,
  `guardrailViolation`, …) with identical behavior on iOS 26 and iOS 27 devices.
  Replaces the obsoleted `LanguageModelSession.GenerationError` mapping
  (`exceededContextWindowSize` → `contextSizeExceeded`, `unsupportedGuide` → `unsupportedGenerationGuide`)

- Native tool calls no longer fabricate results: `DynamicTool` surfaces the prompt-based
  tool-call request to JavaScript and generation continues only through `submitToolResult`

### Fixed

- Compile compatibility with the iOS 27 SDK where `LanguageModelSession.GenerationError`,
  `Transcript.StructuredSegment.source`, and `ToolCallError` were removed/renamed —
  all references replaced with availability-guarded code paths

## [1.0.0] - 2025-06-07

### Added

#### CoreML Support
- `CoreML.loadModel(modelName)` - Load CoreML models from app bundle
- `CoreML.unloadModel(modelId)` - Unload models to free memory
- `CoreML.predict(modelId, input)` - Run predictions with dictionary input/output
- `CoreML.isModelLoaded(modelId)` - Check if a model is loaded
- `CoreML.getLoadedModels()` - Get list of all loaded model IDs

#### Foundation Models - Basic API
- `FoundationModels.isAvailable()` - Check if Apple Intelligence is available
- `FoundationModels.getAvailability()` - Get detailed availability with reason
- `FoundationModels.createSession(options?)` - Create LLM session with optional instructions
- `FoundationModels.closeSession(sessionId)` - Close a session
- `FoundationModels.respond(sessionId, prompt, options?)` - Generate text response
- `FoundationModels.streamResponse(sessionId, prompt, onToken, options?)` - Stream response token by token

#### Structured Output
- `FoundationModels.respondWithSchema(sessionId, prompt, schema, options?)` - Generate JSON conforming to schema
- `FoundationModels.respondWithChoices(sessionId, prompt, choices, options?)` - Constrain output to specific choices
- `FoundationModels.streamWithSchema(sessionId, prompt, schema, onPartial, options?)` - Stream structured output

#### Tool Calling
- `FoundationModels.createSessionWithTools(options)` - Create session with callable tools
- `FoundationModels.respondWithTools(sessionId, prompt, options?)` - Get response or tool call request
- `FoundationModels.submitToolResult(sessionId, toolResult)` - Submit tool execution result
- `FoundationModels.streamWithTools(sessionId, prompt, callbacks, options?)` - Stream with tool support

#### Session Management
- `FoundationModels.getTranscript(sessionId)` - Get conversation history
- `FoundationModels.prewarm(sessionId, options?)` - Reduce latency with prompt prefix caching
- `FoundationModels.createSessionWithTranscript(entries, instructions?)` - Resume sessions with history

#### Guardrails & Configuration
- `GuardrailsMode` - `'default'` or `'permissiveContentTransformations'`
- `ModelUseCase` - `'general'` or `'contentTagging'`
- Extended session options with guardrails, useCase, tools, and adapterId

#### Adapters (Fine-tuned Models)
- `FoundationModels.loadAdapter(name, options?)` - Load from Background Assets
- `FoundationModels.loadAdapterFromFile(filePath, options?)` - Load from local .fmadapter file
- `FoundationModels.compileAdapter(adapterId)` - Compile for faster inference
- `FoundationModels.unloadAdapter(adapterId)` - Free memory
- `FoundationModels.getAdapterDownloadStatus(name)` - Check download status
- `FoundationModels.isAdapterCompatible(name)` - Check compatibility
- `FoundationModels.removeObsoleteAdapters()` - Clean up old adapters

#### Feedback & Analytics
- `FoundationModels.logFeedback(sessionId, options)` - Log feedback on responses
- Support for sentiment (positive/neutral/negative)
- 8 issue categories with optional explanations
- Returns base64-encoded feedback attachment for bug reports

#### Generation Options
- `temperature` - Control randomness (0.0 - 2.0)
- `sampling` - Token sampling strategy (greedy, topK, topP)
- `maximumResponseTokens` - Limit response length

#### Error Handling
- `FoundationModelsError` class with typed errors
- Error types: guardrailViolation, refusal, notAvailable, sessionNotFound, generationFailed, streamingFailed, unsupportedLanguage
- Helper methods: `isGuardrailViolation()`, `isRefusal()`

### Platform Support
- **iOS**: Full support (requires iOS 26.0+ for Foundation Models, iOS 16.0+ for CoreML)
- **Android**: Stub implementations that throw `PlatformNotSupportedException`

### Testing
- 211 unit tests across 8 test suites
- Full mock coverage for all native module functions

## [0.1.0] - Initial Development

- Initial project setup with Expo module scaffolding
- Basic CoreML integration
- Foundation Models prototype
