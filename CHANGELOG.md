# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
