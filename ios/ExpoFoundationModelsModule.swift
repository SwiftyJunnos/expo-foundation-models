import ExpoModulesCore
@preconcurrency import CoreML

#if canImport(FoundationModels)
@preconcurrency import FoundationModels
#endif

// MARK: - CoreML Manager

/// Errors that can occur during CoreML operations
enum CoreMLManagerError: Error {
    case modelNotFound
    case modelLoadFailed
    case modelNotLoaded
    case predictionFailed
    case invalidInput

    var localizedDescription: String {
        switch self {
        case .modelNotFound:
            return "Model not found in app bundle"
        case .modelLoadFailed:
            return "Failed to load CoreML model"
        case .modelNotLoaded:
            return "Model is not loaded"
        case .predictionFailed:
            return "Prediction failed"
        case .invalidInput:
            return "Invalid input provided"
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
            throw CoreMLManagerError.modelNotFound
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
            throw CoreMLManagerError.modelLoadFailed
        }
    }

    /// Unload a model to free memory
    func unloadModel(modelId: String) throws {
        var found = false
        queue.sync {
            found = loadedModels[modelId] != nil
        }

        guard found else {
            throw CoreMLManagerError.modelNotLoaded
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
            throw CoreMLManagerError.modelNotLoaded
        }

        let featureProvider = DictionaryFeatureProvider(dictionary: input)

        do {
            let prediction = try mlModel.prediction(from: featureProvider)
            return convertPredictionToDict(prediction)
        } catch {
            throw CoreMLManagerError.predictionFailed
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

/// Errors for Foundation Models operations
struct FoundationModelsManagerError: Error, LocalizedError {
    let message: String

    static let notAvailable = FoundationModelsManagerError(message: "Foundation Models is not available. Requires iOS 26+ with Apple Intelligence enabled in Settings.")
    static let sessionNotFound = FoundationModelsManagerError(message: "Session not found")

    static func generationFailed(_ reason: String) -> FoundationModelsManagerError {
        return FoundationModelsManagerError(message: "Text generation failed: \(reason)")
    }

    static func streamingFailed(_ reason: String) -> FoundationModelsManagerError {
        return FoundationModelsManagerError(message: "Streaming failed: \(reason)")
    }

    var errorDescription: String? { message }
}

/// Generation options for Foundation Models
struct FMGenerationOptions {
    var temperature: Double = 0.7
    var maxTokens: Int = 1000

    static func from(dictionary: [String: Any]?) -> FMGenerationOptions {
        var options = FMGenerationOptions()
        if let dict = dictionary {
            if let temp = dict["temperature"] as? Double {
                options.temperature = temp
            }
            if let tokens = dict["maxTokens"] as? Int {
                options.maxTokens = tokens
            }
        }
        return options
    }
}

/// Manager for Apple's Foundation Models framework
final class FoundationModelsManager: @unchecked Sendable {
    static let shared = FoundationModelsManager()

    // Store sessions as Any to avoid @available on stored property
    private var sessions: [String: Any] = [:]
    private let queue = DispatchQueue(label: "expo.modules.foundationmodels.fm", attributes: .concurrent)

    private init() {}

    /// Check if Foundation Models is available
    func isAvailable() -> Bool {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *) {
            return SystemLanguageModel.default.isAvailable
        }
        #endif
        return false
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
            var session: LanguageModelSession?
            queue.sync {
                session = self.sessions[sessionId] as? LanguageModelSession
            }

            guard let session = session else {
                throw FoundationModelsManagerError.sessionNotFound
            }

            do {
                let response = try await session.respond(to: prompt)
                return response.content
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
            var session: LanguageModelSession?
            queue.sync {
                session = self.sessions[sessionId] as? LanguageModelSession
            }

            guard let session = session else {
                throw FoundationModelsManagerError.sessionNotFound
            }

            do {
                var fullResponse = ""
                let stream = session.streamResponse(to: prompt)

                for try await partialResponse in stream {
                    let newContent = partialResponse.content
                    if newContent.count > fullResponse.count {
                        let newToken = String(newContent.dropFirst(fullResponse.count))
                        fullResponse = newContent
                        onToken(newToken)
                    }
                }

                return fullResponse
            } catch {
                throw FoundationModelsManagerError.streamingFailed(error.localizedDescription)
            }
        }
        #endif
        throw FoundationModelsManagerError.notAvailable
    }
}

// MARK: - Expo Module

public class ExpoFoundationModelsModule: Module {
    public func definition() -> ModuleDefinition {
        Name("ExpoFoundationModels")

        Events("onToken")

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
    }
}
