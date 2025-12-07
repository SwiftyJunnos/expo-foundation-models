import ExpoModulesCore
@preconcurrency import CoreML

#if canImport(FoundationModels)
@preconcurrency import FoundationModels
#endif

// MARK: - CoreML Manager

/// Errors that can occur during CoreML operations
enum CoreMLManagerError: Error, LocalizedError {
    case modelNotFound(name: String)
    case modelLoadFailed(name: String, underlying: Error?)
    case modelNotLoaded(id: String)
    case predictionFailed(id: String, underlying: Error?)
    case invalidInput(reason: String)

    var errorDescription: String? {
        switch self {
        case .modelNotFound(let name):
            return "Model '\(name)' not found in app bundle"
        case .modelLoadFailed(let name, let underlying):
            if let err = underlying {
                return "Failed to load CoreML model '\(name)': \(err.localizedDescription)"
            }
            return "Failed to load CoreML model '\(name)'"
        case .modelNotLoaded(let id):
            return "Model with ID '\(id)' is not loaded"
        case .predictionFailed(let id, let underlying):
            if let err = underlying {
                return "Prediction failed for model '\(id)': \(err.localizedDescription)"
            }
            return "Prediction failed for model '\(id)'"
        case .invalidInput(let reason):
            return "Invalid input: \(reason)"
        }
    }
}

/// A feature provider that wraps a dictionary for CoreML input
class DictionaryFeatureProvider: NSObject, MLFeatureProvider {
    let dictionary: [String: Any]
    let featureNames: Set<String>

    init(dictionary: [String: Any]) {
        self.dictionary = dictionary
        self.featureNames = Set(dictionary.keys)
        super.init()
    }

    func featureValue(for featureName: String) -> MLFeatureValue? {
        guard let value = dictionary[featureName] else {
            return nil
        }

        // Handle different value types
        if let number = value as? NSNumber {
            return MLFeatureValue(double: number.doubleValue)
        } else if let array = value as? [NSNumber] {
            // Convert to MLMultiArray
            let doubleArray = array.map { $0.doubleValue }
            guard let multiArray = try? MLMultiArray(shape: [NSNumber(value: doubleArray.count)], dataType: .double) else {
                return nil
            }
            for (index, val) in doubleArray.enumerated() {
                multiArray[index] = NSNumber(value: val)
            }
            return MLFeatureValue(multiArray: multiArray)
        } else if let string = value as? String {
            return MLFeatureValue(string: string)
        }

        return nil
    }
}

/// Singleton manager for CoreML model operations
final class CoreMLManager: @unchecked Sendable {
    static let shared = CoreMLManager()

    private var loadedModels: [String: MLModel] = [:]
    private var modelNames: [String: String] = [:]
    private let queue = DispatchQueue(label: "expo.modules.foundationmodels.coreml", attributes: .concurrent)

    private init() {}

    /// Generate a unique model ID
    private func generateModelId(for modelName: String) -> String {
        return "\(modelName)_\(UUID().uuidString.prefix(8))"
    }

    /// Load a CoreML model from the app bundle
    func loadModelAsync(modelName: String) async throws -> String {
        // Find the model URL in the main bundle
        guard let modelURL = Bundle.main.url(forResource: modelName, withExtension: "mlmodelc") else {
            throw CoreMLManagerError.modelNotFound(name: modelName)
        }

        do {
            let config = MLModelConfiguration()
            config.computeUnits = .all

            let model = try await MLModel.load(contentsOf: modelURL, configuration: config)

            let modelId = generateModelId(for: modelName)

            queue.async(flags: .barrier) {
                self.loadedModels[modelId] = model
                self.modelNames[modelId] = modelName
            }

            return modelId
        } catch {
            throw CoreMLManagerError.modelLoadFailed(name: modelName, underlying: error)
        }
    }

    /// Unload a model to free memory
    func unloadModel(modelId: String) throws {
        var found = false
        queue.sync {
            found = loadedModels[modelId] != nil
        }

        guard found else {
            throw CoreMLManagerError.modelNotLoaded(id: modelId)
        }

        queue.async(flags: .barrier) {
            self.loadedModels.removeValue(forKey: modelId)
            self.modelNames.removeValue(forKey: modelId)
        }
    }

    /// Run prediction on a loaded model
    func predictAsync(modelId: String, input: [String: Any]) async throws -> [String: Any] {
        var model: MLModel?
        queue.sync {
            model = loadedModels[modelId]
        }

        guard let mlModel = model else {
            throw CoreMLManagerError.modelNotLoaded(id: modelId)
        }

        let featureProvider = DictionaryFeatureProvider(dictionary: input)

        do {
            let prediction = try mlModel.prediction(from: featureProvider)
            return convertPredictionToDict(prediction)
        } catch {
            throw CoreMLManagerError.predictionFailed(id: modelId, underlying: error)
        }
    }

    /// Convert MLFeatureProvider output to dictionary
    private func convertPredictionToDict(_ prediction: MLFeatureProvider) -> [String: Any] {
        var result: [String: Any] = [:]

        for featureName in prediction.featureNames {
            guard let featureValue = prediction.featureValue(for: featureName) else {
                continue
            }

            switch featureValue.type {
            case .double:
                result[featureName] = featureValue.doubleValue
            case .int64:
                result[featureName] = featureValue.int64Value
            case .string:
                result[featureName] = featureValue.stringValue
            case .multiArray:
                if let multiArray = featureValue.multiArrayValue {
                    result[featureName] = convertMultiArrayToArray(multiArray)
                }
            case .dictionary:
                if let dict = featureValue.dictionaryValue as? [String: NSNumber] {
                    var converted: [String: Double] = [:]
                    for (key, value) in dict {
                        converted[key] = value.doubleValue
                    }
                    result[featureName] = converted
                }
            case .sequence:
                if let sequence = featureValue.sequenceValue {
                    result[featureName] = convertSequenceToArray(sequence)
                }
            case .image:
                result[featureName] = "<image>"
            case .invalid:
                result[featureName] = "<invalid>"
            case .state:
                result[featureName] = "<state>"
            @unknown default:
                result[featureName] = "<unknown>"
            }
        }

        return result
    }

    /// Convert MLMultiArray to Swift array
    private func convertMultiArrayToArray(_ multiArray: MLMultiArray) -> [Double] {
        let count = multiArray.count
        var result: [Double] = []
        result.reserveCapacity(count)

        for i in 0..<count {
            result.append(multiArray[i].doubleValue)
        }

        return result
    }

    /// Convert MLSequence to Swift array
    private func convertSequenceToArray(_ sequence: MLSequence) -> [Any] {
        switch sequence.type {
        case .string:
            return sequence.stringValues
        case .int64:
            return sequence.int64Values.map { $0.intValue }
        @unknown default:
            return []
        }
    }

    /// Check if a model is loaded
    func isModelLoaded(modelId: String) -> Bool {
        var loaded = false
        queue.sync {
            loaded = loadedModels[modelId] != nil
        }
        return loaded
    }

    /// Get list of all loaded model IDs
    func getLoadedModels() -> [String] {
        var models: [String] = []
        queue.sync {
            models = Array(loadedModels.keys)
        }
        return models
    }
}

// MARK: - Foundation Models Manager

/// Error types for Foundation Models operations
enum FMErrorType: String {
    case notAvailable = "notAvailable"
    case sessionNotFound = "sessionNotFound"
    case generationFailed = "generationFailed"
    case streamingFailed = "streamingFailed"
    case guardrailViolation = "guardrailViolation"
    case refusal = "refusal"
    case unsupportedLanguage = "unsupportedLanguage"
    case unknown = "unknown"
}

/// Errors for Foundation Models operations
struct FoundationModelsManagerError: Error, LocalizedError {
    let type: FMErrorType
    let message: String
    let refusalExplanation: String?
    let context: String?

    init(type: FMErrorType, message: String, refusalExplanation: String? = nil, context: String? = nil) {
        self.type = type
        self.message = message
        self.refusalExplanation = refusalExplanation
        self.context = context
    }

    static let notAvailable = FoundationModelsManagerError(
        type: .notAvailable,
        message: "Foundation Models is not available. Requires iOS 26+ with Apple Intelligence enabled in Settings."
    )

    static let sessionNotFound = FoundationModelsManagerError(
        type: .sessionNotFound,
        message: "Session not found"
    )

    static func generationFailed(_ reason: String) -> FoundationModelsManagerError {
        return FoundationModelsManagerError(
            type: .generationFailed,
            message: "Text generation failed: \(reason)"
        )
    }

    static func streamingFailed(_ reason: String) -> FoundationModelsManagerError {
        return FoundationModelsManagerError(
            type: .streamingFailed,
            message: "Streaming failed: \(reason)"
        )
    }

    static func guardrailViolation(_ context: String? = nil) -> FoundationModelsManagerError {
        return FoundationModelsManagerError(
            type: .guardrailViolation,
            message: "Content was blocked by safety guardrails",
            context: context
        )
    }

    static func refusal(explanation: String?, context: String? = nil) -> FoundationModelsManagerError {
        return FoundationModelsManagerError(
            type: .refusal,
            message: "The model refused to generate a response",
            refusalExplanation: explanation,
            context: context
        )
    }

    static func unsupportedLanguage(_ language: String) -> FoundationModelsManagerError {
        return FoundationModelsManagerError(
            type: .unsupportedLanguage,
            message: "Unsupported language or locale: \(language)"
        )
    }

    var errorDescription: String? { message }

    /// Convert to dictionary for JavaScript
    func toDict() -> [String: Any] {
        var dict: [String: Any] = [
            "type": type.rawValue,
            "message": message
        ]
        if let explanation = refusalExplanation {
            dict["refusalExplanation"] = explanation
        }
        if let ctx = context {
            dict["context"] = ctx
        }
        return dict
    }
}

/// Sampling mode configuration
enum FMSamplingMode {
    case greedy
    case topK(k: Int, seed: UInt64?)
    case topP(threshold: Double, seed: UInt64?)

    static func from(dictionary: [String: Any]?) -> FMSamplingMode? {
        guard let dict = dictionary,
              let type = dict["type"] as? String else {
            return nil
        }

        switch type {
        case "greedy":
            return .greedy
        case "topK":
            guard let k = dict["k"] as? Int else { return nil }
            let seed = dict["seed"] as? UInt64
            return .topK(k: k, seed: seed)
        case "topP":
            guard let threshold = dict["probabilityThreshold"] as? Double else { return nil }
            let seed = dict["seed"] as? UInt64
            return .topP(threshold: threshold, seed: seed)
        default:
            return nil
        }
    }
}

/// Generation options for Foundation Models
struct FMGenerationOptions {
    var temperature: Double?
    var sampling: FMSamplingMode?
    var maximumResponseTokens: Int?

    static func from(dictionary: [String: Any]?) -> FMGenerationOptions {
        var options = FMGenerationOptions()
        if let dict = dictionary {
            options.temperature = dict["temperature"] as? Double
            options.maximumResponseTokens = dict["maximumResponseTokens"] as? Int
            options.sampling = FMSamplingMode.from(dictionary: dict["sampling"] as? [String: Any])
        }
        return options
    }

    #if canImport(FoundationModels)
    @available(iOS 26.0, macOS 26.0, *)
    func toNativeOptions() -> GenerationOptions {
        var samplingMode: GenerationOptions.SamplingMode?

        if let sampling = self.sampling {
            switch sampling {
            case .greedy:
                samplingMode = .greedy
            case .topK(let k, let seed):
                samplingMode = .random(top: k, seed: seed)
            case .topP(let threshold, let seed):
                samplingMode = .random(probabilityThreshold: threshold, seed: seed)
            }
        }

        return GenerationOptions(
            sampling: samplingMode,
            temperature: temperature,
            maximumResponseTokens: maximumResponseTokens
        )
    }
    #endif
}

/// Manager for Apple's Foundation Models framework
final class FoundationModelsManager: @unchecked Sendable {
    static let shared = FoundationModelsManager()

    // Store sessions as Any to avoid @available on stored property
    private var sessions: [String: Any] = [:]
    // Store loaded adapters
    private var adapters: [String: Any] = [:]
    private let queue = DispatchQueue(label: "expo.modules.foundationmodels.fm", attributes: .concurrent)

    private init() {}

    // MARK: - Helper Methods

    #if canImport(FoundationModels)
    /// Get a session by ID, throwing if not found
    @available(iOS 26.0, macOS 26.0, *)
    private func getSession(_ sessionId: String) throws -> LanguageModelSession {
        var session: LanguageModelSession?
        queue.sync {
            session = sessions[sessionId] as? LanguageModelSession
        }
        guard let session = session else {
            throw FoundationModelsManagerError.sessionNotFound
        }
        return session
    }

    /// Get an adapter by ID, throwing if not found
    @available(iOS 26.0, macOS 26.0, *)
    private func getAdapter(_ adapterId: String) throws -> SystemLanguageModel.Adapter {
        var adapter: SystemLanguageModel.Adapter?
        queue.sync {
            adapter = adapters[adapterId] as? SystemLanguageModel.Adapter
        }
        guard let adapter = adapter else {
            throw FoundationModelsManagerError(
                type: .generationFailed,
                message: "Adapter not found: \(adapterId)"
            )
        }
        return adapter
    }
    #endif

    /// Check if Foundation Models is available
    func isAvailable() -> Bool {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *) {
            return SystemLanguageModel.default.isAvailable
        }
        #endif
        return false
    }

    /// Get detailed availability information
    func getAvailability() -> [String: Any] {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *) {
            let model = SystemLanguageModel.default
            switch model.availability {
            case .available:
                return [
                    "available": true,
                    "status": "available"
                ]
            case .unavailable(.deviceNotEligible):
                return [
                    "available": false,
                    "status": "unavailable",
                    "reason": "deviceNotEligible"
                ]
            case .unavailable(.appleIntelligenceNotEnabled):
                return [
                    "available": false,
                    "status": "unavailable",
                    "reason": "appleIntelligenceNotEnabled"
                ]
            case .unavailable(.modelNotReady):
                return [
                    "available": false,
                    "status": "unavailable",
                    "reason": "modelNotReady"
                ]
            case .unavailable(let reason):
                return [
                    "available": false,
                    "status": "unavailable",
                    "reason": "unknown",
                    "message": String(describing: reason)
                ]
            }
        }
        #endif
        return [
            "available": false,
            "status": "unavailable",
            "reason": "platformNotSupported"
        ]
    }

    /// Create a new session
    func createSessionAsync(instructions: String?) async throws -> String {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *) {
            let sessionId = UUID().uuidString

            let session: LanguageModelSession
            if let instructions = instructions, !instructions.isEmpty {
                session = LanguageModelSession(
                    model: SystemLanguageModel.default,
                    instructions: instructions
                )
            } else {
                session = LanguageModelSession()
            }

            queue.async(flags: .barrier) {
                self.sessions[sessionId] = session
            }

            return sessionId
        }
        #endif
        throw FoundationModelsManagerError.notAvailable
    }

    /// Close a session
    func closeSession(sessionId: String) throws {
        var found = false
        queue.sync {
            found = sessions[sessionId] != nil
        }

        guard found else {
            throw FoundationModelsManagerError.sessionNotFound
        }

        queue.async(flags: .barrier) {
            self.sessions.removeValue(forKey: sessionId)
        }
    }

    /// Generate a response
    func respondAsync(sessionId: String, prompt: String, options: FMGenerationOptions) async throws -> String {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *) {
            let session = try getSession(sessionId)

            do {
                let nativeOptions = options.toNativeOptions()
                let response = try await session.respond(to: prompt, options: nativeOptions)
                return response.content
            } catch let error as LanguageModelSession.GenerationError {
                throw mapGenerationError(error)
            } catch {
                throw FoundationModelsManagerError.generationFailed(error.localizedDescription)
            }
        }
        #endif
        throw FoundationModelsManagerError.notAvailable
    }

    /// Stream a response with token callback
    func streamResponseAsync(
        sessionId: String,
        prompt: String,
        options: FMGenerationOptions,
        onToken: @escaping (String) -> Void
    ) async throws -> String {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *) {
            let session = try getSession(sessionId)

            do {
                var fullResponse = ""
                let nativeOptions = options.toNativeOptions()
                let stream = session.streamResponse(to: prompt, options: nativeOptions)

                for try await partialResponse in stream {
                    let newContent = partialResponse.content
                    if newContent.count > fullResponse.count {
                        let newToken = String(newContent.dropFirst(fullResponse.count))
                        fullResponse = newContent
                        onToken(newToken)
                    }
                }

                return fullResponse
            } catch let error as LanguageModelSession.GenerationError {
                throw mapGenerationError(error)
            } catch {
                throw FoundationModelsManagerError.streamingFailed(error.localizedDescription)
            }
        }
        #endif
        throw FoundationModelsManagerError.notAvailable
    }

    /// Map native GenerationError to our error type
    #if canImport(FoundationModels)
    @available(iOS 26.0, macOS 26.0, *)
    private func mapGenerationError(_ error: LanguageModelSession.GenerationError) -> FoundationModelsManagerError {
        switch error {
        case .guardrailViolation(let context):
            return .guardrailViolation(context.debugDescription)
        case .refusal(_, let context):
            // Note: Getting explanation is async, so we can't easily include it here
            // The explanation would need to be fetched separately if needed
            return .refusal(explanation: nil, context: context.debugDescription)
        case .unsupportedLanguageOrLocale(let context):
            return .unsupportedLanguage(context.debugDescription)
        case .exceededContextWindowSize(let context):
            return FoundationModelsManagerError(
                type: .generationFailed,
                message: "Exceeded context window size",
                context: context.debugDescription
            )
        @unknown default:
            return FoundationModelsManagerError(
                type: .unknown,
                message: error.localizedDescription
            )
        }
    }
    #endif

    /// Generate structured output using a JSON schema
    func respondWithSchemaAsync(
        sessionId: String,
        prompt: String,
        schema: [String: Any],
        options: FMGenerationOptions
    ) async throws -> [String: Any] {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *) {
            let session = try getSession(sessionId)

            do {
                // Convert JSON Schema dictionary to DynamicGenerationSchema
                let dynamicSchema = try buildDynamicSchema(from: schema)
                let generationSchema = try GenerationSchema(root: dynamicSchema, dependencies: [])
                let nativeOptions = options.toNativeOptions()

                let response = try await session.respond(
                    to: prompt,
                    schema: generationSchema,
                    options: nativeOptions
                )

                // Decode the generated content to a dictionary
                return try decodeGeneratedContent(response.content)
            } catch let error as LanguageModelSession.GenerationError {
                throw mapGenerationError(error)
            } catch let error as FoundationModelsManagerError {
                throw error
            } catch {
                throw FoundationModelsManagerError.generationFailed(error.localizedDescription)
            }
        }
        #endif
        throw FoundationModelsManagerError.notAvailable
    }

    /// Generate a response constrained to specific choices
    func respondWithChoicesAsync(
        sessionId: String,
        prompt: String,
        choices: [String],
        options: FMGenerationOptions
    ) async throws -> String {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *) {
            let session = try getSession(sessionId)

            do {
                // Create an enum schema with the choices
                let enumSchema = DynamicGenerationSchema(
                    name: "Choice",
                    anyOf: choices
                )
                let generationSchema = try GenerationSchema(root: enumSchema, dependencies: [])
                let nativeOptions = options.toNativeOptions()

                let response = try await session.respond(
                    to: prompt,
                    schema: generationSchema,
                    options: nativeOptions
                )

                // The response should be one of the choices
                return try decodeGeneratedString(response.content)
            } catch let error as LanguageModelSession.GenerationError {
                throw mapGenerationError(error)
            } catch let error as FoundationModelsManagerError {
                throw error
            } catch {
                throw FoundationModelsManagerError.generationFailed(error.localizedDescription)
            }
        }
        #endif
        throw FoundationModelsManagerError.notAvailable
    }

    /// Stream structured output with partial updates
    func streamWithSchemaAsync(
        sessionId: String,
        prompt: String,
        schema: [String: Any],
        options: FMGenerationOptions,
        onPartial: @escaping ([String: Any]) -> Void
    ) async throws -> [String: Any] {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *) {
            let session = try getSession(sessionId)

            do {
                let dynamicSchema = try buildDynamicSchema(from: schema)
                let generationSchema = try GenerationSchema(root: dynamicSchema, dependencies: [])
                let nativeOptions = options.toNativeOptions()

                let stream = session.streamResponse(
                    to: prompt,
                    schema: generationSchema,
                    options: nativeOptions
                )

                var finalResult: [String: Any] = [:]

                for try await partialResponse in stream {
                    if let partial = try? decodeGeneratedContent(partialResponse.content) {
                        finalResult = partial
                        onPartial(partial)
                    }
                }

                return finalResult
            } catch let error as LanguageModelSession.GenerationError {
                throw mapGenerationError(error)
            } catch let error as FoundationModelsManagerError {
                throw error
            } catch {
                throw FoundationModelsManagerError.streamingFailed(error.localizedDescription)
            }
        }
        #endif
        throw FoundationModelsManagerError.notAvailable
    }

    // MARK: - Schema Helpers
    // Note: The DynamicGenerationSchema and GeneratedContent APIs are in beta and may change.
    // These helper functions provide stubs that can be updated when the API stabilizes.

    #if canImport(FoundationModels)
    @available(iOS 26.0, macOS 26.0, *)
    private func buildDynamicSchema(from dict: [String: Any]) throws -> DynamicGenerationSchema {
        // Note: The DynamicGenerationSchema API has changed in recent betas.
        // For now, we throw an error indicating this feature needs API updates.
        // When the API stabilizes, this can be properly implemented.
        throw FoundationModelsManagerError.generationFailed(
            "Structured output with dynamic schemas is not yet supported in this beta version. " +
            "Please use plain text responses with respond() or use compile-time Generable types."
        )
    }

    @available(iOS 26.0, macOS 26.0, *)
    private func decodeGeneratedContent(_ content: GeneratedContent) throws -> [String: Any] {
        // Try to serialize through string representation
        let jsonString = content.debugDescription
        if let data = jsonString.data(using: .utf8),
           let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            return dict
        }
        throw FoundationModelsManagerError.generationFailed("Failed to decode generated content")
    }

    @available(iOS 26.0, macOS 26.0, *)
    private func decodeGeneratedString(_ content: GeneratedContent) throws -> String {
        // Fallback to debug description
        return content.debugDescription.trimmingCharacters(in: CharacterSet(charactersIn: "\""))
    }
    #endif

    // MARK: - Tool Calling

    /// Create a session with tools
    func createSessionWithToolsAsync(options: [String: Any]) async throws -> String {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *) {
            let sessionId = UUID().uuidString

            guard let toolDicts = options["tools"] as? [[String: Any]], !toolDicts.isEmpty else {
                throw FoundationModelsManagerError.generationFailed("At least one tool must be provided")
            }

            // Convert tool dictionaries to native Tool types
            var tools: [any Tool] = []
            for toolDict in toolDicts {
                let tool = try buildDynamicTool(from: toolDict)
                tools.append(tool)
            }

            let instructions = options["instructions"] as? String

            let session: LanguageModelSession
            if let instructions = instructions, !instructions.isEmpty {
                session = LanguageModelSession(
                    model: SystemLanguageModel.default,
                    tools: tools,
                    instructions: instructions
                )
            } else {
                session = LanguageModelSession(
                    model: SystemLanguageModel.default,
                    tools: tools
                )
            }

            queue.async(flags: .barrier) {
                self.sessions[sessionId] = session
            }

            return sessionId
        }
        #endif
        throw FoundationModelsManagerError.notAvailable
    }

    /// Send a prompt and get response (text or tool call)
    func respondWithToolsAsync(
        sessionId: String,
        prompt: String,
        options: FMGenerationOptions
    ) async throws -> [String: Any] {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *) {
            let session = try getSession(sessionId)

            do {
                let nativeOptions = options.toNativeOptions()
                let response = try await session.respond(to: prompt, options: nativeOptions)

                // Check if the response contains a tool call by examining transcript
                if let toolCallInfo = extractLastToolCall(from: session.transcript) {
                    return [
                        "type": "toolCall",
                        "toolCall": toolCallInfo
                    ]
                }

                return [
                    "type": "text",
                    "content": response.content
                ]
            } catch let error as LanguageModelSession.GenerationError {
                throw mapGenerationError(error)
            } catch {
                throw FoundationModelsManagerError.generationFailed(error.localizedDescription)
            }
        }
        #endif
        throw FoundationModelsManagerError.notAvailable
    }

    /// Submit tool result back to the model
    /// Note: Tool calling API is in beta and may have changed.
    func submitToolResultAsync(
        sessionId: String,
        toolResult: [String: Any]
    ) async throws -> [String: Any] {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *) {
            // Tool calling with submit/respond pattern may not be available in current API.
            // This feature requires the session.respond(to: ToolOutput) pattern which
            // may have changed in recent betas.
            throw FoundationModelsManagerError.generationFailed(
                "Tool result submission is not yet supported in this beta version. " +
                "The tool calling API is evolving - please check for updates."
            )
        }
        #endif
        throw FoundationModelsManagerError.notAvailable
    }

    /// Stream response with tool support
    func streamWithToolsAsync(
        sessionId: String,
        prompt: String,
        options: FMGenerationOptions,
        onToken: @escaping (String) -> Void,
        onToolCall: @escaping ([String: Any]) -> Void
    ) async throws -> [String: Any] {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *) {
            let session = try getSession(sessionId)

            do {
                var fullResponse = ""
                let nativeOptions = options.toNativeOptions()
                let stream = session.streamResponse(to: prompt, options: nativeOptions)

                for try await partialResponse in stream {
                    let newContent = partialResponse.content
                    if newContent.count > fullResponse.count {
                        let newToken = String(newContent.dropFirst(fullResponse.count))
                        fullResponse = newContent
                        onToken(newToken)
                    }
                }

                // Check for tool call after streaming
                if let toolCallInfo = extractLastToolCall(from: session.transcript) {
                    onToolCall(toolCallInfo)
                    return [
                        "type": "toolCall",
                        "toolCall": toolCallInfo
                    ]
                }

                return [
                    "type": "text",
                    "content": fullResponse
                ]
            } catch let error as LanguageModelSession.GenerationError {
                throw mapGenerationError(error)
            } catch {
                throw FoundationModelsManagerError.streamingFailed(error.localizedDescription)
            }
        }
        #endif
        throw FoundationModelsManagerError.notAvailable
    }

    /// Helper to extract tool call information from transcript
    #if canImport(FoundationModels)
    @available(iOS 26.0, macOS 26.0, *)
    private func extractLastToolCall(from transcript: Transcript) -> [String: Any]? {
        // Iterate through transcript entries to find tool calls
        // The API may use different case names - we need to handle this dynamically
        for entry in transcript.reversed() {
            // Use Mirror to inspect the entry type dynamically
            let mirror = Mirror(reflecting: entry)
            if let label = mirror.children.first?.label, label.lowercased().contains("tool") {
                // Try to extract tool call information
                if let child = mirror.children.first?.value {
                    let childMirror = Mirror(reflecting: child)
                    var toolInfo: [String: Any] = [:]
                    for property in childMirror.children {
                        if let label = property.label {
                            if label == "id" || label == "callID" || label == "toolCallID" {
                                if let uuid = property.value as? UUID {
                                    toolInfo["id"] = uuid.uuidString
                                }
                            } else if label == "name" {
                                toolInfo["name"] = property.value
                            } else if label == "arguments" {
                                toolInfo["arguments"] = property.value
                            }
                        }
                    }
                    if !toolInfo.isEmpty {
                        return toolInfo
                    }
                }
            }
        }
        return nil
    }
    #endif

    // MARK: - Tool Building Helpers

    #if canImport(FoundationModels)
    @available(iOS 26.0, macOS 26.0, *)
    private func buildDynamicTool(from dict: [String: Any]) throws -> any Tool {
        guard let name = dict["name"] as? String else {
            throw FoundationModelsManagerError.generationFailed("Tool must have a 'name'")
        }
        guard let description = dict["description"] as? String else {
            throw FoundationModelsManagerError.generationFailed("Tool must have a 'description'")
        }

        let parameters = dict["parameters"] as? [String: Any]
        return DynamicTool(name: name, description: description, parameters: parameters)
    }
    #endif

    // MARK: - Session Management

    /// Get the transcript (conversation history) for a session
    func getTranscriptAsync(sessionId: String) async throws -> [[String: Any]] {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *) {
            let session = try getSession(sessionId)

            var entries: [[String: Any]] = []

            for entry in session.transcript {
                // Use Mirror to dynamically extract entry information
                let entryInfo = extractTranscriptEntryInfo(entry)
                if !entryInfo.isEmpty {
                    entries.append(entryInfo)
                }
            }

            return entries
        }
        #endif
        throw FoundationModelsManagerError.notAvailable
    }

    /// Helper to extract transcript entry information using reflection
    #if canImport(FoundationModels)
    @available(iOS 26.0, macOS 26.0, *)
    private func extractTranscriptEntryInfo(_ entry: Transcript.Entry) -> [String: Any] {
        let mirror = Mirror(reflecting: entry)

        // Determine the entry type from the enum case
        guard let child = mirror.children.first else {
            return [:]
        }

        let typeName = child.label ?? "unknown"
        var info: [String: Any] = ["type": typeName]

        // Extract properties from the associated value
        let valueMirror = Mirror(reflecting: child.value)
        for property in valueMirror.children {
            if let label = property.label {
                // Handle common property names
                switch label {
                case "content", "text":
                    info["content"] = String(describing: property.value)
                case "id", "callID", "toolCallID":
                    if let uuid = property.value as? UUID {
                        info["callId"] = uuid.uuidString
                    }
                case "name":
                    info["name"] = property.value
                case "arguments":
                    info["arguments"] = property.value
                default:
                    // Include other properties as-is
                    info[label] = String(describing: property.value)
                }
            }
        }

        return info
    }
    #endif

    /// Prewarm a session to reduce latency
    func prewarmAsync(sessionId: String, options: [String: Any]?) async throws {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *) {
            let session = try getSession(sessionId)

            // Prewarm the session
            // Note: The prewarm API may have changed - using the simplest form
            session.prewarm()
        }
        #else
        throw FoundationModelsManagerError.notAvailable
        #endif
    }

    /// Create a session with initial transcript entries
    /// Note: The current API may not support creating sessions with pre-existing transcripts directly.
    /// This implementation creates a new session and notes that transcript restoration may be limited.
    func createSessionWithTranscriptAsync(options: [String: Any]) async throws -> String {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *) {
            let sessionId = UUID().uuidString

            // Note: The current Foundation Models API may not support creating sessions with
            // pre-existing transcripts. This creates a new session with instructions.
            // The transcript entries parameter is preserved for future API compatibility.
            let instructions = options["instructions"] as? String

            // Create session (transcript restoration not currently supported by the API)
            let session: LanguageModelSession
            if let instructions = instructions, !instructions.isEmpty {
                session = LanguageModelSession(
                    model: SystemLanguageModel.default,
                    instructions: instructions
                )
            } else {
                session = LanguageModelSession()
            }

            queue.async(flags: .barrier) {
                self.sessions[sessionId] = session
            }

            return sessionId
        }
        #endif
        throw FoundationModelsManagerError.notAvailable
    }

    // MARK: - Advanced Configuration

    /// Create a session with extended configuration (guardrails, useCase, tools, adapter)
    func createSessionWithConfigAsync(options: [String: Any]) async throws -> String {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *) {
            let sessionId = UUID().uuidString

            // Parse guardrails
            var guardrails: SystemLanguageModel.Guardrails = .default
            if let guardrailsString = options["guardrails"] as? String {
                switch guardrailsString {
                case "default":
                    guardrails = .default
                case "permissiveContentTransformations":
                    guardrails = .permissiveContentTransformations
                default:
                    guardrails = .default
                }
            }

            // Parse useCase
            var useCase: SystemLanguageModel.UseCase = .general
            if let useCaseString = options["useCase"] as? String {
                switch useCaseString {
                case "general":
                    useCase = .general
                case "contentTagging":
                    useCase = .contentTagging
                default:
                    useCase = .general
                }
            }

            // Create the model - with adapter if provided, otherwise with useCase/guardrails
            let model: SystemLanguageModel
            if let adapterId = options["adapterId"] as? String {
                let loadedAdapter = try getAdapter(adapterId)
                model = SystemLanguageModel(adapter: loadedAdapter, guardrails: guardrails)
            } else {
                model = SystemLanguageModel(useCase: useCase, guardrails: guardrails)
            }

            // Parse tools if provided
            var tools: [any Tool] = []
            if let toolDicts = options["tools"] as? [[String: Any]], !toolDicts.isEmpty {
                for toolDict in toolDicts {
                    let tool = try buildDynamicTool(from: toolDict)
                    tools.append(tool)
                }
            }

            let instructions = options["instructions"] as? String

            // Create the session with the configured model
            let session: LanguageModelSession
            if !tools.isEmpty {
                if let instructions = instructions, !instructions.isEmpty {
                    session = LanguageModelSession(
                        model: model,
                        tools: tools,
                        instructions: instructions
                    )
                } else {
                    session = LanguageModelSession(
                        model: model,
                        tools: tools
                    )
                }
            } else {
                if let instructions = instructions, !instructions.isEmpty {
                    session = LanguageModelSession(
                        model: model,
                        instructions: instructions
                    )
                } else {
                    session = LanguageModelSession(model: model)
                }
            }

            queue.async(flags: .barrier) {
                self.sessions[sessionId] = session
            }

            return sessionId
        }
        #endif
        throw FoundationModelsManagerError.notAvailable
    }

    // MARK: - Adapter Management

    /// Load an adapter by name from Background Assets
    func loadAdapterAsync(name: String, options: [String: Any]?) async throws -> [String: Any] {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *) {
            do {
                let adapter = try SystemLanguageModel.Adapter(name: name)
                let adapterId = UUID().uuidString

                // Optionally compile the adapter
                if let compile = options?["compile"] as? Bool, compile {
                    try await adapter.compile()
                }

                queue.async(flags: .barrier) {
                    self.adapters[adapterId] = adapter
                }

                return [
                    "id": adapterId,
                    "name": name,
                    "isReady": true,
                    "isCompiled": options?["compile"] as? Bool ?? false,
                    "metadata": adapter.creatorDefinedMetadata
                ]
            } catch {
                throw FoundationModelsManagerError.generationFailed("Failed to load adapter: \(error.localizedDescription)")
            }
        }
        #endif
        throw FoundationModelsManagerError.notAvailable
    }

    /// Load an adapter from a local file
    func loadAdapterFromFileAsync(filePath: String, options: [String: Any]?) async throws -> [String: Any] {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *) {
            do {
                let fileURL = URL(fileURLWithPath: filePath)
                let adapter = try SystemLanguageModel.Adapter(fileURL: fileURL)
                let adapterId = UUID().uuidString

                // Extract name from file path
                let name = fileURL.deletingPathExtension().lastPathComponent

                // Optionally compile the adapter
                if let compile = options?["compile"] as? Bool, compile {
                    try await adapter.compile()
                }

                queue.async(flags: .barrier) {
                    self.adapters[adapterId] = adapter
                }

                return [
                    "id": adapterId,
                    "name": name,
                    "isReady": true,
                    "isCompiled": options?["compile"] as? Bool ?? false,
                    "metadata": adapter.creatorDefinedMetadata
                ]
            } catch {
                throw FoundationModelsManagerError.generationFailed("Failed to load adapter from file: \(error.localizedDescription)")
            }
        }
        #endif
        throw FoundationModelsManagerError.notAvailable
    }

    /// Compile an adapter for faster inference
    func compileAdapterAsync(adapterId: String) async throws {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *) {
            let adapter = try getAdapter(adapterId)

            do {
                try await adapter.compile()
            } catch {
                throw FoundationModelsManagerError.generationFailed("Failed to compile adapter: \(error.localizedDescription)")
            }
            return
        }
        #endif
        throw FoundationModelsManagerError.notAvailable
    }

    /// Unload an adapter
    func unloadAdapter(adapterId: String) throws {
        var found = false
        queue.sync {
            found = adapters[adapterId] != nil
        }

        guard found else {
            throw FoundationModelsManagerError.generationFailed("Adapter not found: \(adapterId)")
        }

        queue.async(flags: .barrier) {
            self.adapters.removeValue(forKey: adapterId)
        }
    }

    /// Get adapter download status
    func getAdapterDownloadStatusAsync(name: String) async throws -> [String: Any] {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *) {
            let assetPackIds = SystemLanguageModel.Adapter.compatibleAdapterIdentifiers(name: name)

            if assetPackIds.isEmpty {
                return ["state": "notStarted"]
            }

            // For now, return a simple status - full implementation would integrate with AssetPackManager
            // Check if adapter can be loaded (indicates it's downloaded)
            do {
                _ = try SystemLanguageModel.Adapter(name: name)
                return ["state": "completed"]
            } catch {
                return ["state": "notStarted"]
            }
        }
        #endif
        throw FoundationModelsManagerError.notAvailable
    }

    /// Remove obsolete adapters
    func removeObsoleteAdaptersAsync() async throws {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *) {
            try SystemLanguageModel.Adapter.removeObsoleteAdapters()
            return
        }
        #endif
        throw FoundationModelsManagerError.notAvailable
    }

    /// Check if adapter is compatible
    func isAdapterCompatibleAsync(name: String) async throws -> Bool {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *) {
            let assetPackIds = SystemLanguageModel.Adapter.compatibleAdapterIdentifiers(name: name)
            return !assetPackIds.isEmpty
        }
        #endif
        throw FoundationModelsManagerError.notAvailable
    }

    // MARK: - Feedback

    /// Log feedback about a model response
    /// Note: The feedback logging API may have changed. This implementation provides a stub
    /// that can be updated when the API stabilizes.
    func logFeedbackAsync(sessionId: String, options: [String: Any]) async throws -> [String: Any] {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *) {
            // Validate session exists
            _ = try getSession(sessionId)

            // Parse sentiment
            guard let sentimentString = options["sentiment"] as? String else {
                throw FoundationModelsManagerError.generationFailed("Sentiment is required")
            }

            // Parse issues for validation
            var issueCategories: [String] = []
            if let issueArray = options["issues"] as? [[String: Any]] {
                for issueDict in issueArray {
                    if let categoryString = issueDict["category"] as? String {
                        issueCategories.append(categoryString)
                    }
                }
            }

            // Parse desired response
            let desiredResponse = options["desiredResponse"] as? String

            // Note: The logFeedbackAttachment API may not be available in the current beta.
            // For now, we acknowledge the feedback was received.
            // When the API stabilizes, this can be updated to actually log the feedback.

            return [
                "success": true,
                "message": "Feedback received (logging not yet available in current API version)",
                "sentiment": sentimentString,
                "issueCount": issueCategories.count,
                "hasDesiredResponse": desiredResponse != nil
            ]
        }
        #endif
        throw FoundationModelsManagerError.notAvailable
    }
}

// MARK: - Dynamic Tool

#if canImport(FoundationModels)
@available(iOS 26.0, macOS 26.0, *)
private struct DynamicTool: Tool {
    let name: String
    let description: String
    let parametersDict: [String: Any]?

    @Generable
    struct Arguments {
        // Dynamic arguments will be handled via raw JSON
    }

    init(name: String, description: String, parameters: [String: Any]?) {
        self.name = name
        self.description = description
        self.parametersDict = parameters
    }

    func call(arguments: Arguments) async throws -> String {
        // This is a placeholder - actual tool execution happens in JavaScript
        // The Swift side just needs to return the arguments so JS can execute
        return "{}"
    }
}
#endif

// MARK: - Expo Module

public class ExpoFoundationModelsModule: Module {
    public func definition() -> ModuleDefinition {
        Name("ExpoFoundationModels")

        Events("onToken", "onPartialSchema", "onToolCall", "onAdapterDownload")

        // MARK: - CoreML Functions

        AsyncFunction("loadModel") { (modelName: String) -> String in
            return try await CoreMLManager.shared.loadModelAsync(modelName: modelName)
        }

        AsyncFunction("unloadModel") { (modelId: String) in
            try CoreMLManager.shared.unloadModel(modelId: modelId)
        }

        AsyncFunction("predict") { (modelId: String, input: [String: Any]) -> [String: Any] in
            return try await CoreMLManager.shared.predictAsync(modelId: modelId, input: input)
        }

        Function("isModelLoaded") { (modelId: String) -> Bool in
            return CoreMLManager.shared.isModelLoaded(modelId: modelId)
        }

        Function("getLoadedModels") { () -> [String] in
            return CoreMLManager.shared.getLoadedModels()
        }

        // MARK: - Foundation Models Functions

        Function("isAvailable") { () -> Bool in
            return FoundationModelsManager.shared.isAvailable()
        }

        Function("getAvailability") { () -> [String: Any] in
            return FoundationModelsManager.shared.getAvailability()
        }

        AsyncFunction("createSession") { (instructions: String?) -> String in
            return try await FoundationModelsManager.shared.createSessionAsync(instructions: instructions)
        }

        AsyncFunction("closeSession") { (sessionId: String) in
            try FoundationModelsManager.shared.closeSession(sessionId: sessionId)
        }

        AsyncFunction("respond") { (sessionId: String, prompt: String, options: [String: Any]?) -> String in
            let genOptions = FMGenerationOptions.from(dictionary: options)
            return try await FoundationModelsManager.shared.respondAsync(
                sessionId: sessionId,
                prompt: prompt,
                options: genOptions
            )
        }

        AsyncFunction("streamResponse") { (sessionId: String, prompt: String, options: [String: Any]?) -> String in
            let genOptions = FMGenerationOptions.from(dictionary: options)
            return try await FoundationModelsManager.shared.streamResponseAsync(
                sessionId: sessionId,
                prompt: prompt,
                options: genOptions,
                onToken: { [weak self] token in
                    self?.sendEvent("onToken", [
                        "token": token,
                        "sessionId": sessionId
                    ])
                }
            )
        }

        // MARK: - Structured Output Functions

        AsyncFunction("respondWithSchema") { (sessionId: String, prompt: String, schema: [String: Any], options: [String: Any]?) -> [String: Any] in
            let genOptions = FMGenerationOptions.from(dictionary: options)
            return try await FoundationModelsManager.shared.respondWithSchemaAsync(
                sessionId: sessionId,
                prompt: prompt,
                schema: schema,
                options: genOptions
            )
        }

        AsyncFunction("respondWithChoices") { (sessionId: String, prompt: String, choices: [String], options: [String: Any]?) -> String in
            let genOptions = FMGenerationOptions.from(dictionary: options)
            return try await FoundationModelsManager.shared.respondWithChoicesAsync(
                sessionId: sessionId,
                prompt: prompt,
                choices: choices,
                options: genOptions
            )
        }

        AsyncFunction("streamWithSchema") { (sessionId: String, prompt: String, schema: [String: Any], options: [String: Any]?) -> [String: Any] in
            let genOptions = FMGenerationOptions.from(dictionary: options)
            return try await FoundationModelsManager.shared.streamWithSchemaAsync(
                sessionId: sessionId,
                prompt: prompt,
                schema: schema,
                options: genOptions,
                onPartial: { [weak self] partial in
                    self?.sendEvent("onPartialSchema", [
                        "partial": partial,
                        "sessionId": sessionId
                    ])
                }
            )
        }

        // MARK: - Tool Calling Functions

        AsyncFunction("createSessionWithTools") { (options: [String: Any]) -> String in
            return try await FoundationModelsManager.shared.createSessionWithToolsAsync(options: options)
        }

        AsyncFunction("respondWithTools") { (sessionId: String, prompt: String, options: [String: Any]?) -> [String: Any] in
            let genOptions = FMGenerationOptions.from(dictionary: options)
            return try await FoundationModelsManager.shared.respondWithToolsAsync(
                sessionId: sessionId,
                prompt: prompt,
                options: genOptions
            )
        }

        AsyncFunction("submitToolResult") { (sessionId: String, toolResult: [String: Any]) -> [String: Any] in
            return try await FoundationModelsManager.shared.submitToolResultAsync(
                sessionId: sessionId,
                toolResult: toolResult
            )
        }

        AsyncFunction("streamWithTools") { (sessionId: String, prompt: String, options: [String: Any]?) -> [String: Any] in
            let genOptions = FMGenerationOptions.from(dictionary: options)
            return try await FoundationModelsManager.shared.streamWithToolsAsync(
                sessionId: sessionId,
                prompt: prompt,
                options: genOptions,
                onToken: { [weak self] token in
                    self?.sendEvent("onToken", [
                        "token": token,
                        "sessionId": sessionId
                    ])
                },
                onToolCall: { [weak self] toolCall in
                    self?.sendEvent("onToolCall", [
                        "toolCall": toolCall,
                        "sessionId": sessionId
                    ])
                }
            )
        }

        // MARK: - Session Management Functions

        AsyncFunction("getTranscript") { (sessionId: String) -> [[String: Any]] in
            return try await FoundationModelsManager.shared.getTranscriptAsync(sessionId: sessionId)
        }

        AsyncFunction("prewarm") { (sessionId: String, options: [String: Any]?) in
            try await FoundationModelsManager.shared.prewarmAsync(sessionId: sessionId, options: options)
        }

        AsyncFunction("createSessionWithTranscript") { (options: [String: Any]) -> String in
            return try await FoundationModelsManager.shared.createSessionWithTranscriptAsync(options: options)
        }

        // MARK: - Advanced Configuration Functions

        AsyncFunction("createSessionWithConfig") { (options: [String: Any]) -> String in
            return try await FoundationModelsManager.shared.createSessionWithConfigAsync(options: options)
        }

        // MARK: - Adapter Functions

        AsyncFunction("loadAdapter") { (name: String, options: [String: Any]?) -> [String: Any] in
            return try await FoundationModelsManager.shared.loadAdapterAsync(name: name, options: options)
        }

        AsyncFunction("loadAdapterFromFile") { (filePath: String, options: [String: Any]?) -> [String: Any] in
            return try await FoundationModelsManager.shared.loadAdapterFromFileAsync(filePath: filePath, options: options)
        }

        AsyncFunction("compileAdapter") { (adapterId: String) in
            try await FoundationModelsManager.shared.compileAdapterAsync(adapterId: adapterId)
        }

        AsyncFunction("unloadAdapter") { (adapterId: String) in
            try FoundationModelsManager.shared.unloadAdapter(adapterId: adapterId)
        }

        AsyncFunction("getAdapterDownloadStatus") { (name: String) -> [String: Any] in
            return try await FoundationModelsManager.shared.getAdapterDownloadStatusAsync(name: name)
        }

        AsyncFunction("removeObsoleteAdapters") {
            try await FoundationModelsManager.shared.removeObsoleteAdaptersAsync()
        }

        AsyncFunction("isAdapterCompatible") { (name: String) -> Bool in
            return try await FoundationModelsManager.shared.isAdapterCompatibleAsync(name: name)
        }

        // MARK: - Feedback Functions

        AsyncFunction("logFeedback") { (sessionId: String, options: [String: Any]) -> [String: Any] in
            return try await FoundationModelsManager.shared.logFeedbackAsync(sessionId: sessionId, options: options)
        }
    }
}
