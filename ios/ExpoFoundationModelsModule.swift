import ExpoModulesCore
import ImageIO
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

// MARK: - CoreML Error Diagnostics

/// Root cause categories for CoreML errors
enum CoreMLErrorCause: String, Codable {
    // Load failures
    case computeUnitIncompatible = "computeUnitIncompatible"
    case fileCorrupted = "fileCorrupted"
    case fileNotFound = "fileNotFound"
    case insufficientMemory = "insufficientMemory"
    case unsupportedOperation = "unsupportedOperation"
    case modelVersionMismatch = "modelVersionMismatch"
    case compilationRequired = "compilationRequired"

    // Prediction failures
    case inputShapeMismatch = "inputShapeMismatch"
    case missingFeature = "missingFeature"
    case dataTypeMismatch = "dataTypeMismatch"
    case numericOverflow = "numericOverflow"
    case invalidInputValue = "invalidInputValue"
    case memoryAllocationFailed = "memoryAllocationFailed"

    // General
    case unknown = "unknown"

    var explanation: String {
        switch self {
        case .computeUnitIncompatible:
            return "The model requires compute units (Neural Engine, GPU) not available on this device"
        case .fileCorrupted:
            return "The model file appears to be corrupted or incomplete"
        case .fileNotFound:
            return "The model file was not found in the app bundle"
        case .insufficientMemory:
            return "Not enough memory available to load the model"
        case .unsupportedOperation:
            return "The model contains operations not supported on this device or iOS version"
        case .modelVersionMismatch:
            return "The model was compiled for a different CoreML version"
        case .compilationRequired:
            return "The model needs to be compiled (.mlmodelc) before use"
        case .inputShapeMismatch:
            return "The input data shape does not match what the model expects"
        case .missingFeature:
            return "A required input feature was not provided"
        case .dataTypeMismatch:
            return "The input data type does not match what the model expects"
        case .numericOverflow:
            return "A numeric value exceeded the allowed range"
        case .invalidInputValue:
            return "An input value is invalid (NaN, Infinity, or out of range)"
        case .memoryAllocationFailed:
            return "Failed to allocate memory for the prediction"
        case .unknown:
            return "An unknown error occurred"
        }
    }
}

/// Compute unit diagnostic information
struct ComputeUnitDiagnostics: Codable {
    let availableUnits: [String]
    let requestedUnit: String?

    func toDict() -> [String: Any] {
        var dict: [String: Any] = ["availableUnits": availableUnits]
        if let requested = requestedUnit {
            dict["requestedUnit"] = requested
        }
        return dict
    }
}

/// Input shape diagnostic information for prediction errors
struct InputShapeDiagnostics: Codable {
    let featureName: String
    let expectedType: String
    let receivedType: String?
    let expectedShape: [Int]?
    let receivedShape: [Int]?

    func toDict() -> [String: Any] {
        var dict: [String: Any] = [
            "featureName": featureName,
            "expectedType": expectedType
        ]
        if let received = receivedType {
            dict["receivedType"] = received
        }
        if let expected = expectedShape {
            dict["expectedShape"] = expected
        }
        if let received = receivedShape {
            dict["receivedShape"] = received
        }
        return dict
    }
}

/// Device information for diagnostics
struct DeviceInfoDiagnostics: Codable {
    let model: String
    let osVersion: String
    let hasNeuralEngine: Bool
    let availableMemoryMB: Int

    func toDict() -> [String: Any] {
        return [
            "model": model,
            "osVersion": osVersion,
            "hasNeuralEngine": hasNeuralEngine,
            "availableMemoryMB": availableMemoryMB
        ]
    }
}

/// Comprehensive CoreML diagnostics container
struct CoreMLDiagnostics {
    let modelName: String?
    let modelId: String?
    let computeUnits: ComputeUnitDiagnostics?
    let inputShapes: [InputShapeDiagnostics]?
    let deviceInfo: DeviceInfoDiagnostics?
    let timestamp: Date

    func toDict() -> [String: Any] {
        var dict: [String: Any] = [
            "timestamp": ISO8601DateFormatter().string(from: timestamp)
        ]
        if let name = modelName {
            dict["modelName"] = name
        }
        if let id = modelId {
            dict["modelId"] = id
        }
        if let compute = computeUnits {
            dict["computeUnits"] = compute.toDict()
        }
        if let shapes = inputShapes {
            dict["inputShapes"] = shapes.map { $0.toDict() }
        }
        if let device = deviceInfo {
            dict["deviceInfo"] = device.toDict()
        }
        return dict
    }
}

/// Enhanced CoreML error with diagnostic information
struct EnhancedCoreMLError: Error, LocalizedError {
    let originalError: CoreMLManagerError
    let cause: CoreMLErrorCause
    let diagnostics: CoreMLDiagnostics
    let suggestions: [String]

    var errorDescription: String? {
        var message = originalError.errorDescription ?? "CoreML error"
        message += "\n\nRoot cause: \(cause.explanation)"
        if !suggestions.isEmpty {
            message += "\n\nSuggestions:\n" + suggestions.map { "• \($0)" }.joined(separator: "\n")
        }
        return message
    }

    func toDict() -> [String: Any] {
        return [
            "message": originalError.errorDescription ?? "CoreML error",
            "cause": cause.rawValue,
            "causeExplanation": cause.explanation,
            "diagnostics": diagnostics.toDict(),
            "suggestions": suggestions
        ]
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

    /// Get model diagnostics
    func getModelDiagnostics(modelId: String) throws -> [String: Any] {
        var model: MLModel?
        var modelName: String?
        queue.sync {
            model = loadedModels[modelId]
            modelName = modelNames[modelId]
        }

        guard let mlModel = model else {
            throw CoreMLManagerError.modelNotLoaded(id: modelId)
        }

        let description = mlModel.modelDescription

        // Get input features
        var inputFeatures: [[String: Any]] = []
        for (name, inputDesc) in description.inputDescriptionsByName {
            var feature: [String: Any] = [
                "name": name,
                "type": featureTypeToString(inputDesc.type)
            ]
            if inputDesc.isOptional {
                feature["isOptional"] = true
            }
            if let multiArrayConstraint = inputDesc.multiArrayConstraint {
                feature["shape"] = multiArrayConstraint.shape.map { $0.intValue }
                feature["dataType"] = multiArrayDataTypeToString(multiArrayConstraint.dataType)
            }
            inputFeatures.append(feature)
        }

        // Get output features
        var outputFeatures: [[String: Any]] = []
        for (name, outputDesc) in description.outputDescriptionsByName {
            var feature: [String: Any] = [
                "name": name,
                "type": featureTypeToString(outputDesc.type)
            ]
            if let multiArrayConstraint = outputDesc.multiArrayConstraint {
                feature["shape"] = multiArrayConstraint.shape.map { $0.intValue }
                feature["dataType"] = multiArrayDataTypeToString(multiArrayConstraint.dataType)
            }
            outputFeatures.append(feature)
        }

        return [
            "modelId": modelId,
            "modelName": modelName ?? "unknown",
            "isLoaded": true,
            "inputFeatures": inputFeatures,
            "outputFeatures": outputFeatures,
            "deviceInfo": ErrorAnalyzer.shared.gatherDeviceInfo().toDict(),
            "timestamp": ISO8601DateFormatter().string(from: Date())
        ]
    }

    /// Validate input before prediction
    func validateModelInput(modelId: String, input: [String: Any]) throws -> [String: Any] {
        var model: MLModel?
        queue.sync {
            model = loadedModels[modelId]
        }

        guard let mlModel = model else {
            throw CoreMLManagerError.modelNotLoaded(id: modelId)
        }

        let description = mlModel.modelDescription
        var issues: [[String: Any]] = []
        var suggestions: [String] = []

        // Check each expected input
        for (featureName, featureDesc) in description.inputDescriptionsByName {
            // Check if required feature is missing
            if !featureDesc.isOptional && input[featureName] == nil {
                issues.append([
                    "featureName": featureName,
                    "issue": "missingFeature",
                    "expectedType": featureTypeToString(featureDesc.type)
                ])
                suggestions.append("Provide the required input feature '\(featureName)'")
                continue
            }

            // If feature is provided, validate type
            if let value = input[featureName] {
                let receivedType = getValueType(value)
                let expectedType = featureTypeToString(featureDesc.type)

                // Check for type compatibility
                if !isTypeCompatible(value: value, expectedType: featureDesc.type) {
                    issues.append([
                        "featureName": featureName,
                        "issue": "typeMismatch",
                        "expectedType": expectedType,
                        "receivedType": receivedType
                    ])
                    suggestions.append("Convert '\(featureName)' from \(receivedType) to \(expectedType)")
                }

                // Check shape for arrays
                if let multiArrayConstraint = featureDesc.multiArrayConstraint,
                   let array = value as? [Any] {
                    let expectedShape = multiArrayConstraint.shape.map { $0.intValue }
                    let receivedShape = [array.count]

                    if expectedShape != receivedShape && !expectedShape.isEmpty {
                        issues.append([
                            "featureName": featureName,
                            "issue": "shapeMismatch",
                            "expectedShape": expectedShape,
                            "receivedShape": receivedShape
                        ])
                        suggestions.append("Reshape '\(featureName)' from \(receivedShape) to \(expectedShape)")
                    }
                }
            }
        }

        // Check for unexpected inputs
        for inputName in input.keys {
            if description.inputDescriptionsByName[inputName] == nil {
                issues.append([
                    "featureName": inputName,
                    "issue": "unexpectedFeature"
                ])
                suggestions.append("Remove unexpected input feature '\(inputName)'")
            }
        }

        return [
            "isValid": issues.isEmpty,
            "issues": issues,
            "suggestions": suggestions
        ]
    }

    // Helper methods for diagnostics
    private func featureTypeToString(_ type: MLFeatureType) -> String {
        switch type {
        case .double: return "Double"
        case .int64: return "Int64"
        case .string: return "String"
        case .multiArray: return "MultiArray"
        case .dictionary: return "Dictionary"
        case .image: return "Image"
        case .sequence: return "Sequence"
        case .invalid: return "Invalid"
        case .state: return "State"
        @unknown default: return "Unknown"
        }
    }

    private func multiArrayDataTypeToString(_ type: MLMultiArrayDataType) -> String {
        switch type {
        case .double: return "Double"
        case .float32: return "Float32"
        case .float16: return "Float16"
        case .int32: return "Int32"
        @unknown default: return "Unknown"
        }
    }

    private func getValueType(_ value: Any) -> String {
        if value is Double || value is Float {
            return "Double"
        } else if value is Int {
            return "Int64"
        } else if value is String {
            return "String"
        } else if value is [Any] {
            return "Array"
        } else if value is [String: Any] {
            return "Dictionary"
        }
        return "Unknown"
    }

    private func isTypeCompatible(value: Any, expectedType: MLFeatureType) -> Bool {
        switch expectedType {
        case .double:
            return value is Double || value is Float || value is Int || value is NSNumber
        case .int64:
            return value is Int || value is Int64 || value is NSNumber
        case .string:
            return value is String
        case .multiArray:
            return value is [Any] || value is [Double] || value is [Float] || value is [Int]
        case .dictionary:
            return value is [String: Any]
        default:
            return true // Allow for unknown types
        }
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
    case featureUnavailable = "featureUnavailable"
    case unknown = "unknown"
}

extension FMErrorType {
    /// Default normalized code for legacy error types.
    var defaultNormalizedCode: FMNormalizedErrorCode {
        switch self {
        case .guardrailViolation: return .guardrailViolation
        case .refusal: return .refusal
        case .unsupportedLanguage: return .unsupportedLanguageOrLocale
        case .notAvailable, .sessionNotFound, .featureUnavailable: return .unsupportedCapability
        case .generationFailed, .streamingFailed, .unknown: return .unknown
        }
    }
}

/// Normalized error codes (single source of truth, shared with the TS facade).
/// Every generation/session/model failure maps to exactly one of these so that
/// iOS 26 and iOS 27 devices report identical wire-level error codes.
enum FMNormalizedErrorCode: String {
    case contextSizeExceeded
    case rateLimited
    case refusal
    case guardrailViolation
    case unsupportedLanguageOrLocale
    case unsupportedCapability
    /// Emitted for `FMErrorType.featureUnavailable` failures so the TS facade's
    /// `parseNativeError` fast path classifies them without relying on message
    /// heuristics. Already part of the facade's valid-codes vocabulary.
    case featureUnavailable
    case assetsUnavailable
    case concurrentRequests
    case timeout
    case transcriptMutationWhileResponding
    case unsupportedGenerationGuide
    case decodingFailure
    case unknown
}

/// Errors for Foundation Models operations
struct FoundationModelsManagerError: Error, LocalizedError {
    let type: FMErrorType
    let message: String
    let refusalExplanation: String?
    let context: String?
    /// Normalized wire-level error code (see FMNormalizedErrorCode).
    let normalizedCode: FMNormalizedErrorCode

    init(type: FMErrorType, message: String, refusalExplanation: String? = nil, context: String? = nil, normalizedCode: FMNormalizedErrorCode? = nil) {
        self.type = type
        self.message = message
        self.refusalExplanation = refusalExplanation
        self.context = context
        self.normalizedCode = normalizedCode ?? type.defaultNormalizedCode
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

    static func featureUnavailable(_ reason: String) -> FoundationModelsManagerError {
        return FoundationModelsManagerError(
            type: .featureUnavailable,
            message: reason
        )
    }

    var errorDescription: String? { message }

    /// Convert to dictionary for JavaScript
    func toDict() -> [String: Any] {
        var dict: [String: Any] = [
            "type": type.rawValue,
            "code": normalizedCode.rawValue,
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

extension FoundationModelsManagerError: CustomNSError {
    static var errorDomain: String { "ExpoFoundationModels" }

    var errorCode: Int {
        let allCases: [FMNormalizedErrorCode] = [
            .contextSizeExceeded, .rateLimited, .refusal, .guardrailViolation,
            .unsupportedLanguageOrLocale, .unsupportedCapability, .assetsUnavailable,
            .concurrentRequests, .timeout, .transcriptMutationWhileResponding,
            .unsupportedGenerationGuide, .decodingFailure, .unknown,
            // Appended last so existing numeric error codes stay stable.
            .featureUnavailable
        ]
        return allCases.firstIndex(of: normalizedCode) ?? allCases.count - 1
    }

    var errorUserInfo: [String: Any] {
        return ["code": normalizedCode.rawValue]
    }
}

// MARK: - Foundation Models Error Diagnostics

/// Root cause categories for Foundation Models errors
enum FoundationModelsErrorCause: String, Codable {
    // Availability issues
    case deviceNotEligible = "deviceNotEligible"
    case appleIntelligenceDisabled = "appleIntelligenceDisabled"
    case modelNotDownloaded = "modelNotDownloaded"
    case modelDownloading = "modelDownloading"
    case unsupportedRegion = "unsupportedRegion"
    case unsupportedOSVersion = "unsupportedOSVersion"

    // Generation issues
    case contextWindowExceeded = "contextWindowExceeded"
    case inputTooLong = "inputTooLong"
    case outputTruncated = "outputTruncated"
    case unsupportedLanguage = "unsupportedLanguage"

    // Safety issues
    case guardrailViolation = "guardrailViolation"
    case contentRefused = "contentRefused"

    // Session issues
    case sessionExpired = "sessionExpired"
    case sessionInvalidated = "sessionInvalidated"
    case concurrencyLimit = "concurrencyLimit"

    // General
    case unknown = "unknown"

    var explanation: String {
        switch self {
        case .deviceNotEligible:
            return "This device does not support Apple Intelligence. Requires iPhone 15 Pro or newer, or M1+ Mac"
        case .appleIntelligenceDisabled:
            return "Apple Intelligence is not enabled. Enable it in Settings > Apple Intelligence & Siri"
        case .modelNotDownloaded:
            return "The on-device model has not been downloaded yet"
        case .modelDownloading:
            return "The on-device model is currently downloading"
        case .unsupportedRegion:
            return "Apple Intelligence is not available in this region"
        case .unsupportedOSVersion:
            return "This feature requires iOS 26 or later"
        case .contextWindowExceeded:
            return "The conversation exceeded the maximum context window size"
        case .inputTooLong:
            return "The input prompt is too long for the model to process"
        case .outputTruncated:
            return "The response was truncated due to token limits"
        case .unsupportedLanguage:
            return "The requested language is not supported by the model"
        case .guardrailViolation:
            return "The content was blocked by safety filters"
        case .contentRefused:
            return "The model refused to generate the requested content"
        case .sessionExpired:
            return "The session has expired or timed out"
        case .sessionInvalidated:
            return "The session was invalidated due to an error"
        case .concurrencyLimit:
            return "Too many concurrent requests. Please wait and try again"
        case .unknown:
            return "An unknown error occurred"
        }
    }
}

/// Context window diagnostic information
struct ContextWindowDiagnostics: Codable {
    let estimatedUsedTokens: Int
    let maxTokens: Int
    let remainingTokens: Int

    func toDict() -> [String: Any] {
        return [
            "estimatedUsedTokens": estimatedUsedTokens,
            "maxTokens": maxTokens,
            "remainingTokens": remainingTokens
        ]
    }
}

/// Device eligibility diagnostic information for Foundation Models
struct DeviceEligibilityDiagnostics: Codable {
    let deviceModel: String
    let osVersion: String
    let requiredOSVersion: String
    let appleIntelligenceEnabled: Bool?
    let modelDownloaded: Bool?

    func toDict() -> [String: Any] {
        var dict: [String: Any] = [
            "deviceModel": deviceModel,
            "osVersion": osVersion,
            "requiredOSVersion": requiredOSVersion
        ]
        if let enabled = appleIntelligenceEnabled {
            dict["appleIntelligenceEnabled"] = enabled
        }
        if let downloaded = modelDownloaded {
            dict["modelDownloaded"] = downloaded
        }
        return dict
    }
}

/// Comprehensive Foundation Models diagnostics container
struct FoundationModelsDiagnostics {
    let sessionId: String?
    let contextWindow: ContextWindowDiagnostics?
    let deviceEligibility: DeviceEligibilityDiagnostics?
    let timestamp: Date

    func toDict() -> [String: Any] {
        var dict: [String: Any] = [
            "timestamp": ISO8601DateFormatter().string(from: timestamp)
        ]
        if let id = sessionId {
            dict["sessionId"] = id
        }
        if let context = contextWindow {
            dict["contextWindow"] = context.toDict()
        }
        if let eligibility = deviceEligibility {
            dict["deviceEligibility"] = eligibility.toDict()
        }
        return dict
    }
}

/// Enhanced Foundation Models error with diagnostic information
struct EnhancedFoundationModelsError: Error, LocalizedError {
    let originalError: FoundationModelsManagerError
    let cause: FoundationModelsErrorCause
    let diagnostics: FoundationModelsDiagnostics
    let suggestions: [String]

    var errorDescription: String? {
        var message = originalError.message
        message += "\n\nRoot cause: \(cause.explanation)"
        if !suggestions.isEmpty {
            message += "\n\nSuggestions:\n" + suggestions.map { "• \($0)" }.joined(separator: "\n")
        }
        return message
    }

    func toDict() -> [String: Any] {
        var dict = originalError.toDict()
        dict["cause"] = cause.rawValue
        dict["causeExplanation"] = cause.explanation
        dict["diagnostics"] = diagnostics.toDict()
        dict["suggestions"] = suggestions
        return dict
    }
}

// MARK: - Error Analyzer

/// Singleton that analyzes errors to determine root causes and generate suggestions
final class ErrorAnalyzer {
    static let shared = ErrorAnalyzer()
    private init() {}

    /// Analyze a CoreML error and determine root cause
    func analyzeCoreMLError(
        _ error: Error,
        modelName: String?,
        modelId: String?
    ) -> (cause: CoreMLErrorCause, suggestions: [String]) {
        let errorMessage = error.localizedDescription.lowercased()
        var cause: CoreMLErrorCause = .unknown
        var suggestions: [String] = []

        // Analyze error message patterns
        if errorMessage.contains("compute") || errorMessage.contains("neural engine") || errorMessage.contains("gpu") {
            cause = .computeUnitIncompatible
            suggestions = [
                "Try setting computeUnits to .cpuOnly in model configuration",
                "Ensure the model is compatible with this device's compute capabilities"
            ]
        } else if errorMessage.contains("memory") || errorMessage.contains("allocation") {
            if errorMessage.contains("prediction") || errorMessage.contains("inference") {
                cause = .memoryAllocationFailed
            } else {
                cause = .insufficientMemory
            }
            suggestions = [
                "Free up device memory by closing other apps",
                "Consider using a smaller model variant",
                "Try loading the model when memory pressure is lower"
            ]
        } else if errorMessage.contains("shape") || errorMessage.contains("dimension") {
            cause = .inputShapeMismatch
            suggestions = [
                "Check that input dimensions match the model's expected input shape",
                "Verify array lengths match the model specification",
                "Review the model's input description for exact requirements"
            ]
        } else if errorMessage.contains("type") || errorMessage.contains("conversion") || errorMessage.contains("cast") {
            cause = .dataTypeMismatch
            suggestions = [
                "Ensure input values are of the correct type (Double, Float, etc.)",
                "Check for type mismatches in array elements",
                "Review the model's expected input types"
            ]
        } else if errorMessage.contains("not found") || errorMessage.contains("no such file") || errorMessage.contains("missing") {
            if errorMessage.contains("feature") || errorMessage.contains("input") {
                cause = .missingFeature
                suggestions = [
                    "Provide all required input features",
                    "Check the model's input description for required feature names"
                ]
            } else {
                cause = .fileNotFound
                suggestions = [
                    "Verify the model file is included in the app bundle",
                    "Check the model filename matches exactly (case-sensitive)",
                    "Ensure the model has been compiled (.mlmodelc)"
                ]
            }
        } else if errorMessage.contains("corrupt") || errorMessage.contains("invalid format") || errorMessage.contains("malformed") {
            cause = .fileCorrupted
            suggestions = [
                "Re-export the model from its source",
                "Verify the model file wasn't truncated during copy",
                "Check that the model version is compatible"
            ]
        } else if errorMessage.contains("unsupported") || errorMessage.contains("not supported") {
            cause = .unsupportedOperation
            suggestions = [
                "Check if the model uses operations supported on this iOS version",
                "Consider using a different model architecture",
                "Update to the latest iOS version"
            ]
        } else if errorMessage.contains("compile") || errorMessage.contains("compilation") {
            cause = .compilationRequired
            suggestions = [
                "Ensure Xcode has compiled the .mlmodel to .mlmodelc",
                "Add the model to the app target in Xcode"
            ]
        } else if errorMessage.contains("overflow") || errorMessage.contains("range") {
            cause = .numericOverflow
            suggestions = [
                "Check input values are within the expected range",
                "Normalize input data before prediction"
            ]
        } else if errorMessage.contains("nan") || errorMessage.contains("infinity") || errorMessage.contains("invalid") {
            cause = .invalidInputValue
            suggestions = [
                "Validate input values before prediction (no NaN or Infinity)",
                "Check for division by zero or invalid calculations"
            ]
        }

        return (cause, suggestions)
    }

    /// Analyze a Foundation Models error and determine root cause
    func analyzeFoundationModelsError(
        _ error: Error,
        sessionId: String?
    ) -> (cause: FoundationModelsErrorCause, suggestions: [String]) {
        let errorMessage = error.localizedDescription.lowercased()
        var cause: FoundationModelsErrorCause = .unknown
        var suggestions: [String] = []

        if errorMessage.contains("context") || errorMessage.contains("token") || errorMessage.contains("exceeded") || errorMessage.contains("window") {
            cause = .contextWindowExceeded
            suggestions = [
                "Reduce the length of your prompt",
                "Start a new session to reset the context",
                "Summarize previous conversation before continuing"
            ]
        } else if errorMessage.contains("guardrail") || errorMessage.contains("safety") || errorMessage.contains("blocked") {
            cause = .guardrailViolation
            suggestions = [
                "Rephrase your request to avoid triggering safety filters",
                "Remove potentially sensitive content from the prompt"
            ]
        } else if errorMessage.contains("refused") || errorMessage.contains("cannot") || errorMessage.contains("refusal") {
            cause = .contentRefused
            suggestions = [
                "The model cannot fulfill this type of request",
                "Try rephrasing or asking for something different"
            ]
        } else if errorMessage.contains("language") || errorMessage.contains("locale") {
            cause = .unsupportedLanguage
            suggestions = [
                "Use a supported language (English, etc.)",
                "Check your device's language settings"
            ]
        } else if errorMessage.contains("session") {
            if errorMessage.contains("expired") || errorMessage.contains("timeout") {
                cause = .sessionExpired
            } else if errorMessage.contains("invalid") {
                cause = .sessionInvalidated
            }
            suggestions = [
                "Create a new session and try again",
                "Sessions may expire after periods of inactivity"
            ]
        } else if errorMessage.contains("not available") || errorMessage.contains("unavailable") {
            if errorMessage.contains("device") || errorMessage.contains("eligible") {
                cause = .deviceNotEligible
                suggestions = [
                    "Apple Intelligence requires iPhone 15 Pro or later, or M1+ Mac"
                ]
            } else if errorMessage.contains("intelligence") || errorMessage.contains("enabled") || errorMessage.contains("settings") {
                cause = .appleIntelligenceDisabled
                suggestions = [
                    "Enable Apple Intelligence in Settings > Apple Intelligence & Siri"
                ]
            } else if errorMessage.contains("download") || errorMessage.contains("ready") {
                cause = .modelNotDownloaded
                suggestions = [
                    "Wait for the on-device model to finish downloading",
                    "Ensure device has sufficient storage space"
                ]
            }
        } else if errorMessage.contains("too long") || errorMessage.contains("input") && errorMessage.contains("limit") {
            cause = .inputTooLong
            suggestions = [
                "Shorten your prompt",
                "Split your request into smaller parts"
            ]
        }

        return (cause, suggestions)
    }

    /// Gather device info for diagnostics
    func gatherDeviceInfo() -> DeviceInfoDiagnostics {
        return DeviceInfoDiagnostics(
            model: getDeviceModel(),
            osVersion: ProcessInfo.processInfo.operatingSystemVersionString,
            hasNeuralEngine: checkNeuralEngineAvailability(),
            availableMemoryMB: getAvailableMemoryMB()
        )
    }

    /// Gather device eligibility diagnostics for Foundation Models
    func gatherDeviceEligibility() -> DeviceEligibilityDiagnostics {
        return DeviceEligibilityDiagnostics(
            deviceModel: getDeviceModel(),
            osVersion: ProcessInfo.processInfo.operatingSystemVersionString,
            requiredOSVersion: "iOS 26.0+",
            appleIntelligenceEnabled: nil, // Would need to check system settings
            modelDownloaded: nil // Would need to check model status
        )
    }

    private func getDeviceModel() -> String {
        var systemInfo = utsname()
        uname(&systemInfo)
        let machineMirror = Mirror(reflecting: systemInfo.machine)
        return machineMirror.children.reduce("") { identifier, element in
            guard let value = element.value as? Int8, value != 0 else { return identifier }
            return identifier + String(UnicodeScalar(UInt8(value)))
        }
    }

    private func checkNeuralEngineAvailability() -> Bool {
        let model = getDeviceModel()
        // A12 Bionic and later have Neural Engine (iPhone XS/XR and later)
        // This is a simplified check based on device identifier patterns
        if model.contains("iPhone") {
            // iPhone11,x (XS/XR) and later have Neural Engine
            if let range = model.range(of: "iPhone"),
               let numberStart = model.index(range.upperBound, offsetBy: 0, limitedBy: model.endIndex),
               let commaIndex = model.firstIndex(of: ","),
               let majorVersion = Int(model[numberStart..<commaIndex]) {
                return majorVersion >= 11
            }
        } else if model.contains("iPad") {
            // iPad8,x (Pro 2018) and later have Neural Engine
            if let range = model.range(of: "iPad"),
               let numberStart = model.index(range.upperBound, offsetBy: 0, limitedBy: model.endIndex),
               let commaIndex = model.firstIndex(of: ","),
               let majorVersion = Int(model[numberStart..<commaIndex]) {
                return majorVersion >= 8
            }
        }
        // Mac with Apple Silicon (arm64) has Neural Engine
        #if arch(arm64)
        if model.contains("Mac") || model.contains("arm64") {
            return true
        }
        #endif
        return false
    }

    private func getAvailableMemoryMB() -> Int {
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size) / 4

        let kerr: kern_return_t = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
            }
        }

        if kerr == KERN_SUCCESS {
            let totalMB = Int(ProcessInfo.processInfo.physicalMemory / 1024 / 1024)
            let usedMB = Int(info.resident_size / 1024 / 1024)
            return max(0, totalMB - usedMB)
        }
        return 0
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
    /// iOS 27+: 'allowed' | 'required' | 'disallowed'
    var toolCallingMode: String?
    /// iOS 27+: { reasoningLevel: 'light'|'moderate'|'deep', includeSchemaInPrompt: Bool }
    var contextOptions: FMContextOptions?

    static func from(dictionary: [String: Any]?) -> FMGenerationOptions {
        var options = FMGenerationOptions()
        if let dict = dictionary {
            options.temperature = dict["temperature"] as? Double
            options.maximumResponseTokens = dict["maximumResponseTokens"] as? Int
            options.sampling = FMSamplingMode.from(dictionary: dict["sampling"] as? [String: Any])
            options.toolCallingMode = dict["toolCallingMode"] as? String
            options.contextOptions = FMContextOptions.from(dictionary: dict["contextOptions"] as? [String: Any])
        }
        return options
    }

    /// Throws normalized errors instead of silently ignoring options:
    /// `featureUnavailable` when an iOS 27-only generation option
    /// (`toolCallingMode` / `contextOptions`) is supplied below iOS 27, and
    /// `generationFailed` for a `toolCallingMode` value outside
    /// allowed/required/disallowed (bridge inputs bypass TS validation).
    func validateOSCapabilities() throws {
        if let mode = toolCallingMode, !["allowed", "required", "disallowed"].contains(mode) {
            throw FoundationModelsManagerError.generationFailed(
                "Invalid generation option 'toolCallingMode': '\(mode)'. Expected 'allowed', 'required' or 'disallowed'"
            )
        }
        if #available(iOS 27.0, macOS 27.0, *) {
            return
        }
        if toolCallingMode != nil {
            throw FoundationModelsManagerError.featureUnavailable(
                "Generation option 'toolCallingMode' requires iOS 27.0 or later"
            )
        }
        if contextOptions != nil {
            throw FoundationModelsManagerError.featureUnavailable(
                "Generation option 'contextOptions' requires iOS 27.0 or later"
            )
        }
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

        var nativeOptions = GenerationOptions(
            sampling: samplingMode,
            temperature: temperature,
            maximumResponseTokens: maximumResponseTokens
        )

        if #available(iOS 27.0, macOS 27.0, *) {
            if let mode = self.toolCallingMode {
                switch mode {
                case "allowed": nativeOptions.toolCallingMode = .allowed
                case "required": nativeOptions.toolCallingMode = .required
                case "disallowed": nativeOptions.toolCallingMode = .disallowed
                default: break
                }
            }
        }

        return nativeOptions
    }

    /// iOS 27 ContextOptions built from the JS-facing payload.
    @available(iOS 27.0, macOS 27.0, *)
    func toNativeContextOptions() -> ContextOptions {
        guard let contextOptions = self.contextOptions else {
            return ContextOptions()
        }
        let reasoningLevel: ContextOptions.ReasoningLevel?
        switch contextOptions.reasoningLevel {
        case "light": reasoningLevel = .light
        case "moderate": reasoningLevel = .moderate
        case "deep": reasoningLevel = .deep
        default: reasoningLevel = nil
        }
        return ContextOptions(
            includeSchemaInPrompt: contextOptions.includeSchemaInPrompt,
            reasoningLevel: reasoningLevel
        )
    }
    #endif
}

/// iOS 27 context options payload from JavaScript.
struct FMContextOptions {
    var reasoningLevel: String?
    var includeSchemaInPrompt: Bool?

    static func from(dictionary: [String: Any]?) -> FMContextOptions? {
        guard let dict = dictionary else {
            return nil
        }
        var contextOptions = FMContextOptions()
        contextOptions.reasoningLevel = dict["reasoningLevel"] as? String
        contextOptions.includeSchemaInPrompt = dict["includeSchemaInPrompt"] as? Bool
        return contextOptions
    }
}

/// An image attached to a prompt (iOS 27+): file/resource URI or base64 data.
struct FMPromptImage {
    var uri: String?
    var base64: String?
}

/// Prompt input accepted by every generation method: a plain string or a
/// `{ text, images?: [{ uri } | { base64 }] }` object. Image attachments are an
/// iOS 27+ feature; callers on older OS versions get `featureUnavailable`.
struct FMPrompt: Convertible {
    var text: String
    var images: [FMPromptImage]

    static func convert(from value: Any?, appContext: AppContext) throws -> FMPrompt {
        if let text = value as? String {
            return FMPrompt(text: text, images: [])
        }
        if let dict = value as? [String: Any], let text = dict["text"] as? String {
            var images: [FMPromptImage] = []
            if let imageDicts = dict["images"] as? [[String: Any]] {
                for imageDict in imageDicts {
                    images.append(FMPromptImage(uri: imageDict["uri"] as? String, base64: imageDict["base64"] as? String))
                }
            }
            return FMPrompt(text: text, images: images)
        }
        throw FoundationModelsManagerError.generationFailed(
            "prompt must be a string or an object of the form { text: string, images?: Array<{ uri: string } | { base64: string }> }"
        )
    }
}

/// Manager for Apple's Foundation Models framework
final class FoundationModelsManager: @unchecked Sendable {
    static let shared = FoundationModelsManager()

    // Store sessions as Any to avoid @available on stored property
    private var sessions: [String: Any] = [:]
    // Store loaded adapters
    private var adapters: [String: Any] = [:]
    // Store tool definitions for each session (for prompt-based tool calling workaround)
    private var sessionTools: [String: [[String: Any]]] = [:]
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
        var info: [String: Any]
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *) {
            let model = SystemLanguageModel.default
            switch model.availability {
            case .available:
                info = [
                    "available": true,
                    "status": "available"
                ]
            case .unavailable(.deviceNotEligible):
                info = [
                    "available": false,
                    "status": "unavailable",
                    "reason": "deviceNotEligible"
                ]
            case .unavailable(.appleIntelligenceNotEnabled):
                info = [
                    "available": false,
                    "status": "unavailable",
                    "reason": "appleIntelligenceNotEnabled"
                ]
            case .unavailable(.modelNotReady):
                info = [
                    "available": false,
                    "status": "unavailable",
                    "reason": "modelNotReady"
                ]
            case .unavailable(let reason):
                info = [
                    "available": false,
                    "status": "unavailable",
                    "reason": "unknown",
                    "message": String(describing: reason)
                ]
            }
        } else {
            info = [
                "available": false,
                "status": "unavailable",
                "reason": "platformNotSupported"
            ]
        }
        #else
        info = [
            "available": false,
            "status": "unavailable",
            "reason": "platformNotSupported"
        ]
        #endif
        info["osVersion"] = Self.osVersionString()
        info["features"] = Self.featureFlags()
        return info
    }

    /// OS version formatted as "major.minor[.patch]" (e.g. "27.0").
    static func osVersionString() -> String {
        let v = ProcessInfo.processInfo.operatingSystemVersion
        var version = "\(v.majorVersion).\(v.minorVersion)"
        if v.patchVersion > 0 {
            version += ".\(v.patchVersion)"
        }
        return version
    }

    /// Feature flags reflecting actual runtime usability: OS-version gates plus
    /// live model availability (default system model / Private Cloud Compute).
    static func featureFlags() -> [String: Bool] {
        var features = [
            "privateCloudCompute": false,
            "imageAttachments": false,
            "contextOptions": false,
            "toolCallingMode": false,
            "tokenCounting": false,
            "modelVariant": false
        ]
        // Flags describe real capability, not just the OS version: base-model
        // features additionally require a usable default system model (eligible
        // device, Apple Intelligence enabled), PCC its own model availability.
        #if canImport(FoundationModels)
        if #available(iOS 26.4, macOS 26.4, *), SystemLanguageModel.default.isAvailable {
            features["tokenCounting"] = true
        }
        if #available(iOS 27.0, macOS 27.0, *) {
            if SystemLanguageModel.default.isAvailable {
                features["imageAttachments"] = true
                features["contextOptions"] = true
                features["toolCallingMode"] = true
            }
            features["privateCloudCompute"] = PrivateCloudComputeLanguageModel().isAvailable
            // NOTE: `SystemLanguageModel.variant` does not exist in the final iOS 27 SDK
            // (verified against the swiftinterface), so modelVariant stays false and
            // getModelVariant() returns null until Apple ships a replacement symbol.
        }
        #endif
        return features
    }

    /// Get detailed availability diagnostics with root cause and suggestions
    func getAvailabilityDiagnostics() -> [String: Any] {
        var diagnostics: [String: Any] = [
            "deviceModel": ErrorAnalyzer.shared.gatherDeviceInfo().model,
            "osVersion": ProcessInfo.processInfo.operatingSystemVersionString,
            "requiredOSVersion": "iOS 26.0+",
            "timestamp": ISO8601DateFormatter().string(from: Date())
        ]

        #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *) {
            let model = SystemLanguageModel.default

            switch model.availability {
            case .available:
                diagnostics["isAvailable"] = true
                diagnostics["status"] = "available"

            case .unavailable(.deviceNotEligible):
                diagnostics["isAvailable"] = false
                diagnostics["status"] = "unavailable"
                diagnostics["cause"] = FoundationModelsErrorCause.deviceNotEligible.rawValue
                diagnostics["causeExplanation"] = FoundationModelsErrorCause.deviceNotEligible.explanation
                diagnostics["suggestions"] = [
                    "Apple Intelligence requires iPhone 15 Pro or later, or M1+ Mac",
                    "Check device compatibility at apple.com/apple-intelligence"
                ]

            case .unavailable(.appleIntelligenceNotEnabled):
                diagnostics["isAvailable"] = false
                diagnostics["status"] = "unavailable"
                diagnostics["cause"] = FoundationModelsErrorCause.appleIntelligenceDisabled.rawValue
                diagnostics["causeExplanation"] = FoundationModelsErrorCause.appleIntelligenceDisabled.explanation
                diagnostics["suggestions"] = [
                    "Go to Settings > Apple Intelligence & Siri",
                    "Enable Apple Intelligence and wait for setup to complete"
                ]

            case .unavailable(.modelNotReady):
                diagnostics["isAvailable"] = false
                diagnostics["status"] = "unavailable"
                diagnostics["cause"] = FoundationModelsErrorCause.modelNotDownloaded.rawValue
                diagnostics["causeExplanation"] = FoundationModelsErrorCause.modelNotDownloaded.explanation
                diagnostics["suggestions"] = [
                    "Wait for the on-device model to finish downloading",
                    "Ensure device has sufficient storage space (at least 4GB free)",
                    "Connect to Wi-Fi for faster download"
                ]

            case .unavailable(let reason):
                diagnostics["isAvailable"] = false
                diagnostics["status"] = "unavailable"
                diagnostics["cause"] = FoundationModelsErrorCause.unknown.rawValue
                diagnostics["causeExplanation"] = String(describing: reason)
                diagnostics["rawReason"] = String(describing: reason)
            }
        } else {
            diagnostics["isAvailable"] = false
            diagnostics["status"] = "unavailable"
            diagnostics["cause"] = FoundationModelsErrorCause.unsupportedOSVersion.rawValue
            diagnostics["causeExplanation"] = FoundationModelsErrorCause.unsupportedOSVersion.explanation
            diagnostics["suggestions"] = [
                "Update to iOS 26 or later"
            ]
        }
        #else
        diagnostics["isAvailable"] = false
        diagnostics["status"] = "unavailable"
        diagnostics["cause"] = "platformNotSupported"
        diagnostics["causeExplanation"] = "Foundation Models is only available on iOS/macOS"
        #endif

        return diagnostics
    }

    /// Get session diagnostics including context window usage
    func getSessionDiagnostics(sessionId: String) throws -> [String: Any] {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *) {
            let session = try getSession(sessionId)

            // Estimate token usage from transcript
            let transcript = session.transcript
            var estimatedTokens = 0
            for entry in transcript {
                let content = extractTranscriptContent(entry)
                // Rough token estimation: ~4 characters per token
                estimatedTokens += content.count / 4
            }

            // Approximate max tokens (actual limit may vary)
            let maxTokens = 4096
            let remainingTokens = max(0, maxTokens - estimatedTokens)

            return [
                "sessionId": sessionId,
                "contextWindow": [
                    "estimatedUsedTokens": estimatedTokens,
                    "maxTokens": maxTokens,
                    "remainingTokens": remainingTokens
                ],
                "transcriptEntryCount": transcript.count,
                "timestamp": ISO8601DateFormatter().string(from: Date())
            ]
        }
        #endif
        throw FoundationModelsManagerError.notAvailable
    }

    /// Helper to extract content from transcript entry
    #if canImport(FoundationModels)
    @available(iOS 26.0, macOS 26.0, *)
    private func extractTranscriptContent(_ entry: Transcript.Entry) -> String {
        let mirror = Mirror(reflecting: entry)
        guard let child = mirror.children.first else {
            return ""
        }

        let valueMirror = Mirror(reflecting: child.value)
        for property in valueMirror.children {
            if let label = property.label, (label == "content" || label == "text") {
                return String(describing: property.value)
            }
        }
        return ""
    }
    #endif

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
    func respondAsync(sessionId: String, prompt: FMPrompt, options: FMGenerationOptions) async throws -> String {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *) {
            let session = try getSession(sessionId)

            do {
                try options.validateOSCapabilities()
                let nativeOptions = options.toNativeOptions()
                let nativePrompt = try await makePrompt(prompt)
                if #available(iOS 27.0, macOS 27.0, *) {
                    let response = try await session.respond(
                        to: nativePrompt,
                        options: nativeOptions,
                        contextOptions: options.toNativeContextOptions()
                    )
                    return response.content
                }
                let response = try await session.respond(to: nativePrompt, options: nativeOptions)
                return response.content
            } catch {
                throw Self.mapUnderlyingError(error, fallbackType: .generationFailed)
            }
        }
        #endif
        throw FoundationModelsManagerError.notAvailable
    }

    /// Stream a response with token callback
    func streamResponseAsync(
        sessionId: String,
        prompt: FMPrompt,
        options: FMGenerationOptions,
        onToken: @escaping (String) -> Void
    ) async throws -> String {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *) {
            let session = try getSession(sessionId)

            do {
                try options.validateOSCapabilities()
                var fullResponse = ""
                let nativeOptions = options.toNativeOptions()
                let nativePrompt = try await makePrompt(prompt)
                let stream: LanguageModelSession.ResponseStream<String>
                if #available(iOS 27.0, macOS 27.0, *) {
                    stream = session.streamResponse(
                        to: nativePrompt,
                        options: nativeOptions,
                        contextOptions: options.toNativeContextOptions()
                    )
                } else {
                    stream = session.streamResponse(to: nativePrompt, options: nativeOptions)
                }

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
                throw Self.mapUnderlyingError(error, fallbackType: .streamingFailed)
            }
        }
        #endif
        throw FoundationModelsManagerError.notAvailable
    }

    /// Map any underlying Foundation Models failure to a normalized error.
    ///
    /// `LanguageModelSession.GenerationError` is obsoleted by the iOS 27 SDK, so typed
    /// matching against it is gone. Instead we map the iOS 27-only replacement types
    /// (`LanguageModelError`, `SystemLanguageModel.Error`, `LanguageModelSession.Error`)
    /// inside an availability check and fall back to stable message heuristics that
    /// behave identically on iOS 26 and iOS 27.
    static func mapUnderlyingError(
        _ error: Error,
        fallbackType: FMErrorType
    ) -> FoundationModelsManagerError {
        // Already-normalized manager errors (e.g. featureUnavailable from makePrompt)
        // pass through unchanged.
        if let managed = error as? FoundationModelsManagerError {
            return managed
        }

        var code: FMNormalizedErrorCode?
        var detail = error.localizedDescription
        #if canImport(FoundationModels)
        if #available(iOS 27.0, macOS 27.0, *) {
            switch error {
            case let modelError as LanguageModelError:
                switch modelError {
                case .contextSizeExceeded(let context):
                    code = .contextSizeExceeded
                    detail = context.debugDescription
                case .rateLimited(let context):
                    code = .rateLimited
                    detail = context.debugDescription
                case .guardrailViolation(let context):
                    code = .guardrailViolation
                    detail = context.debugDescription
                case .refusal(let refusal):
                    code = .refusal
                    detail = refusal.debugDescription
                case .unsupportedCapability(let context):
                    code = .unsupportedCapability
                    detail = context.debugDescription
                case .unsupportedLanguageOrLocale(let context):
                    code = .unsupportedLanguageOrLocale
                    detail = context.debugDescription
                case .unsupportedGenerationGuide(let context):
                    code = .unsupportedGenerationGuide
                    detail = context.debugDescription
                case .timeout(let context):
                    code = .timeout
                    detail = context.debugDescription
                case .unsupportedTranscriptContent:
                    break
                @unknown default:
                    break
                }
            case let systemError as SystemLanguageModel.Error:
                if case .assetsUnavailable(let assets) = systemError {
                    code = .assetsUnavailable
                    detail = assets.debugDescription
                }
            case let sessionError as LanguageModelSession.Error:
                switch sessionError {
                case .concurrentRequests:
                    code = .concurrentRequests
                case .transcriptMutationWhileResponding:
                    code = .transcriptMutationWhileResponding
                @unknown default:
                    break
                }
                detail = sessionError.localizedDescription
            default:
                break
            }
        }
        #endif

        // Message-based normalization shared by iOS 26 and iOS 27.
        if code == nil {
            let message = detail.lowercased()
            if message.contains("context") && (message.contains("exceed") || message.contains("window"))
                || message.contains("too long") {
                code = .contextSizeExceeded
            } else if message.contains("rate limit") || message.contains("too many requests") || message.contains("throttl") {
                code = .rateLimited
            } else if message.contains("refus") {
                code = .refusal
            } else if message.contains("guardrail") || message.contains("safety filter") || message.contains("sensitive") {
                code = .guardrailViolation
            } else if message.contains("language") || message.contains("locale") {
                code = .unsupportedLanguageOrLocale
            } else if message.contains("concurrent") || message.contains("already responding")
                || message.contains("in progress") || message.contains("another generation") {
                code = .concurrentRequests
            } else if message.contains("timed out") || message.contains("timeout") {
                code = .timeout
            } else if message.contains("asset") || message.contains("not downloaded") || message.contains("download") {
                code = .assetsUnavailable
            } else if message.contains("generationguide") || message.contains("generation guide") {
                code = .unsupportedGenerationGuide
            } else if message.contains("decod") || message.contains("pars") {
                code = .decodingFailure
            } else if message.contains("not supported") || message.contains("unsupported") || message.contains("capability") {
                code = .unsupportedCapability
            } else {
                code = .unknown
            }
        }

        switch code ?? .unknown {
        case .guardrailViolation:
            return .guardrailViolation(detail)
        case .refusal:
            return .refusal(explanation: nil, context: detail)
        case .unsupportedLanguageOrLocale:
            return .unsupportedLanguage(detail)
        default:
            return FoundationModelsManagerError(
                type: fallbackType,
                message: detail,
                normalizedCode: code ?? .unknown
            )
        }
    }

    /// Guard for the prompt-based schema fallback: that path embeds the JSON
    /// Schema in the prompt text because embedding it is the only way to keep
    /// structured output once native schema conversion has failed. When the
    /// caller explicitly opted out (`includeSchemaInPrompt: false`), fail with
    /// a normalized error instead of silently contradicting the request.
    ///
    /// Reachable on iOS 27+ only: below iOS 27 `validateOSCapabilities()`
    /// rejects every `contextOptions` payload, and a successful native
    /// conversion hands the flag to the framework, which honors it there.
    ///
    /// Carries normalized code `featureUnavailable` explicitly: the TS facade
    /// classifies it via its fast path, whereas message heuristics would
    /// misfire ("cannot" → refusal, "context…" → contextWindowExceeded).
    private func requireFallbackSchemaInPrompt(_ options: FMGenerationOptions) throws {
        guard options.contextOptions?.includeSchemaInPrompt == false else { return }
        throw FoundationModelsManagerError(
            type: .featureUnavailable,
            message: "Cannot honor contextOptions.includeSchemaInPrompt = false: the JSON Schema could not be converted to a native generation schema, so the prompt-based fallback must include the schema to preserve structured output",
            normalizedCode: .featureUnavailable
        )
    }

    /// Generate structured output using a JSON schema.
    ///
    /// **iOS 27+:** native structured generation via
    /// JSONSchema → `DynamicGenerationSchema` → `GenerationSchema`. Non-object roots
    /// (arrays, strings, numbers…) are returned as the generated value itself.
    /// If the schema cannot be converted, we transparently fall back to the legacy path.
    ///
    /// **iOS 26 / conversion fallback:**
    /// The JSON schema is embedded in the prompt and the response is parsed. Image
    /// attachments are preserved via `makePrompt` (or rejected as `featureUnavailable`
    /// below iOS 27); any JSON root parses, failing explicitly otherwise. On iOS 27
    /// the fallback responds through the context-aware overload so
    /// `contextOptions.reasoningLevel` still applies — and because the schema must
    /// stay embedded in the prompt there, `includeSchemaInPrompt: false` combined
    /// with a failed conversion throws `featureUnavailable` (see
    /// `requireFallbackSchemaInPrompt`).
    /// See: https://github.com/mcp-foundation/expo-foundation-models/issues/1
    func respondWithSchemaAsync(
        sessionId: String,
        prompt: FMPrompt,
        schema: [String: Any],
        options: FMGenerationOptions
    ) async throws -> Any {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *) {
            let session = try getSession(sessionId)

            if #available(iOS 27.0, macOS 27.0, *),
               let nativeSchema = try? makeGenerationSchema(fromJSONSchema: schema) {
                do {
                    try options.validateOSCapabilities()
                    let nativePrompt = try await makePrompt(prompt)
                    let response = try await session.respond(
                        to: nativePrompt,
                        schema: nativeSchema,
                        options: options.toNativeOptions(),
                        contextOptions: options.toNativeContextOptions()
                    )
                    return Self.anyFromGeneratedContent(response.content)
                } catch {
                    throw Self.mapUnderlyingError(error, fallbackType: .generationFailed)
                }
            }

            do {
                try options.validateOSCapabilities()
                // Schema-only prompt (no English instructions); images preserved.
                let schemaJson = try JSONSerialization.data(withJSONObject: schema, options: .sortedKeys)
                let schemaString = String(data: schemaJson, encoding: .utf8) ?? "{}"

                let structuredPrompt = FMPrompt(
                    text: """
                    \(prompt.text)

                    JSON Schema: \(schemaString)
                    """,
                    images: prompt.images
                )

                try requireFallbackSchemaInPrompt(options)

                let nativeOptions = options.toNativeOptions()
                let nativePrompt = try await makePrompt(structuredPrompt)
                let response: LanguageModelSession.Response<String>
                if #available(iOS 27.0, macOS 27.0, *) {
                    // Context-aware overload so requested reasoning levels and
                    // schema-prompt behavior are honored even in the fallback
                    // (below iOS 27 `validateOSCapabilities` rejects
                    // `contextOptions` earlier).
                    response = try await session.respond(
                        to: nativePrompt,
                        options: nativeOptions,
                        contextOptions: options.toNativeContextOptions()
                    )
                } else {
                    response = try await session.respond(to: nativePrompt, options: nativeOptions)
                }

                return try jsonValueFromResponse(response.content)
            } catch {
                throw Self.mapUnderlyingError(error, fallbackType: .generationFailed)
            }
        }
        #endif
        throw FoundationModelsManagerError.notAvailable
    }

    /// Generate a response constrained to specific choices
    ///
    /// **iOS 26 Beta Workaround:**
    /// Uses prompt-based approach instead of `DynamicGenerationSchema` enum.
    /// The model is asked to respond with exactly one of the provided choices.
    func respondWithChoicesAsync(
        sessionId: String,
        prompt: FMPrompt,
        choices: [String],
        options: FMGenerationOptions
    ) async throws -> String {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *) {
            let session = try getSession(sessionId)

            do {
                try options.validateOSCapabilities()

                // Constrain the response to one of the choices while preserving any
                // image attachments (rebuilt as an FMPrompt, never a bare string).
                // Avoid English instructions that can trigger unsupportedLanguageOrLocale errors.
                let choicesFormatted = choices.map { "\"\($0)\"" }.joined(separator: ", ")

                let structuredPrompt = FMPrompt(
                    text: """
                    \(prompt.text)

                    [\(choicesFormatted)]
                    """,
                    images: prompt.images
                )

                let nativeOptions = options.toNativeOptions()
                let nativePrompt = try await makePrompt(structuredPrompt)
                let response: LanguageModelSession.Response<String>
                if #available(iOS 27.0, macOS 27.0, *) {
                    // Context-aware overload so requested reasoning levels and
                    // schema-prompt behavior are honored (iOS 26 rejects
                    // `contextOptions` earlier via validateOSCapabilities).
                    response = try await session.respond(
                        to: nativePrompt,
                        options: nativeOptions,
                        contextOptions: options.toNativeContextOptions()
                    )
                } else {
                    response = try await session.respond(to: nativePrompt, options: nativeOptions)
                }

                // Clean up the response and validate it's one of the choices
                // Access .content from Response<String>
                let cleanedResponse = response.content.trimmingCharacters(in: .whitespacesAndNewlines)
                    .trimmingCharacters(in: CharacterSet(charactersIn: "\"'"))

                // Check if response matches one of the choices (case-insensitive for robustness)
                if let matchedChoice = choices.first(where: { $0.lowercased() == cleanedResponse.lowercased() }) {
                    return matchedChoice
                }

                // If no exact match, return the cleaned response (model might have chosen correctly)
                // This allows for slight variations while still being useful
                return cleanedResponse
            } catch {
                throw Self.mapUnderlyingError(error, fallbackType: .generationFailed)
            }
        }
        #endif
        throw FoundationModelsManagerError.notAvailable
    }

    /// Stream structured output with partial updates.
    ///
    /// **iOS 27+:** native structured streaming via
    /// JSONSchema → `DynamicGenerationSchema` → `GenerationSchema`; partials are real
    /// `GeneratedContent` snapshots converted to their JSON value (object, array or
    /// scalar). Falls back to the legacy path when the schema cannot be converted.
    ///
    /// **iOS 26 / conversion fallback:**
    /// Prompt-based streaming with partial JSON parsing on each chunk. Image
    /// attachments are preserved via `makePrompt` (or rejected as `featureUnavailable`
    /// below iOS 27); any JSON root streams and resolves like any other value. On
    /// iOS 27 the fallback streams through the context-aware overload so
    /// `contextOptions.reasoningLevel` still applies — and because the schema must
    /// stay embedded in the prompt there, `includeSchemaInPrompt: false` combined
    /// with a failed conversion throws `featureUnavailable` (see
    /// `requireFallbackSchemaInPrompt`).
    ///
    /// Final-value semantics: the last native snapshot is always the result — even
    /// when it is a valid empty object `{}` — while empty mid-stream snapshots
    /// remain suppressed as partial events.
    func streamWithSchemaAsync(
        sessionId: String,
        prompt: FMPrompt,
        schema: [String: Any],
        options: FMGenerationOptions,
        onPartial: @escaping (Any) -> Void
    ) async throws -> Any {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *) {
            let session = try getSession(sessionId)

            if #available(iOS 27.0, macOS 27.0, *),
               let nativeSchema = try? makeGenerationSchema(fromJSONSchema: schema) {
                do {
                    try options.validateOSCapabilities()
                    let nativePrompt = try await makePrompt(prompt)
                    let stream = session.streamResponse(
                        to: nativePrompt,
                        schema: nativeSchema,
                        options: options.toNativeOptions(),
                        contextOptions: options.toNativeContextOptions()
                    )

                    var lastSnapshot: Any?
                    for try await partialResponse in stream {
                        let value = Self.anyFromGeneratedContent(partialResponse.content)
                        // Track the latest snapshot unconditionally: an empty
                        // object is a valid FINAL structured result. Empty
                        // mid-stream `{}` snapshots are only suppressed as
                        // partial events (early noise), never from the result.
                        lastSnapshot = value
                        if let dict = value as? [String: Any], dict.isEmpty { continue }
                        onPartial(value)
                    }
                    // Distinguish the final response from partials: return the
                    // last snapshot even when it is an empty object.
                    guard let result = lastSnapshot else {
                        throw FoundationModelsManagerError.generationFailed(
                            "Structured generation did not return any content"
                        )
                    }
                    return result
                } catch {
                    throw Self.mapUnderlyingError(error, fallbackType: .streamingFailed)
                }
            }

            do {
                try options.validateOSCapabilities()
                // Schema-only prompt (no English instructions); images preserved.
                let schemaJson = try JSONSerialization.data(withJSONObject: schema, options: .sortedKeys)
                let schemaString = String(data: schemaJson, encoding: .utf8) ?? "{}"

                let structuredPrompt = FMPrompt(
                    text: """
                    \(prompt.text)

                    JSON Schema: \(schemaString)
                    """,
                    images: prompt.images
                )

                try requireFallbackSchemaInPrompt(options)

                let nativeOptions = options.toNativeOptions()
                let nativePrompt = try await makePrompt(structuredPrompt)
                let stream: LanguageModelSession.ResponseStream<String>
                if #available(iOS 27.0, macOS 27.0, *) {
                    // Context-aware overload so requested reasoning levels and
                    // schema-prompt behavior are honored even in the fallback
                    // (below iOS 27 `validateOSCapabilities` rejects
                    // `contextOptions` earlier).
                    stream = session.streamResponse(
                        to: nativePrompt,
                        options: nativeOptions,
                        contextOptions: options.toNativeContextOptions()
                    )
                } else {
                    stream = session.streamResponse(to: nativePrompt, options: nativeOptions)
                }

                var accumulatedText = ""

                for try await partialResponse in stream {
                    // Access .content from the stream snapshot
                    accumulatedText = partialResponse.content

                    // Try to parse partial JSON (may fail for incomplete JSON, which is expected)
                    if let partial = tryParsePartialJsonValue(accumulatedText) {
                        onPartial(partial)
                    }
                }

                // Parse the final complete response
                if let parsed = tryParsePartialJsonValue(accumulatedText) {
                    return parsed
                }

                // If parsing failed, try to extract JSON from the response
                return try jsonValueFromResponse(accumulatedText)
            } catch {
                throw Self.mapUnderlyingError(error, fallbackType: .streamingFailed)
            }
        }
        #endif
        throw FoundationModelsManagerError.notAvailable
    }


    // MARK: - JSON Parsing Helpers
    // 
    // iOS 26 Beta Workaround:
    // Since DynamicGenerationSchema doesn't support runtime schema construction,
    // we use prompt-based JSON generation and parse the text response.
    // 
    // These helpers extract and parse JSON from model responses.
    // See: https://github.com/mcp-foundation/expo-foundation-models/issues/1

    /// Parse a JSON value — object, array, string, number, boolean or null — from
    /// a model response, handling common formatting issues such as markdown code
    /// fences or prose around the payload. Throws explicitly when no JSON can be
    /// extracted; callers never fail after generation on non-object roots.
    private func jsonValueFromResponse(_ response: String) throws -> Any {
        var jsonString = response.trimmingCharacters(in: .whitespacesAndNewlines)

        // Remove markdown code blocks if present
        if jsonString.hasPrefix("```json") {
            jsonString = String(jsonString.dropFirst(7))
        } else if jsonString.hasPrefix("```") {
            jsonString = String(jsonString.dropFirst(3))
        }
        if jsonString.hasSuffix("```") {
            jsonString = String(jsonString.dropLast(3))
        }
        jsonString = jsonString.trimmingCharacters(in: .whitespacesAndNewlines)

        // Try the full trimmed text first so scalar roots ("yes", 42) parse.
        if let data = jsonString.data(using: .utf8),
           let value = try? JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed]) {
            return value
        }

        // Otherwise locate the outermost container if extra text surrounds it.
        if let startIndex = jsonString.firstIndex(where: { $0 == "{" || $0 == "[" }),
           let endIndex = jsonString.lastIndex(where: { $0 == "}" || $0 == "]" }),
           startIndex < endIndex {
            let candidate = String(jsonString[startIndex...endIndex])
            if let data = candidate.data(using: .utf8),
               let value = try? JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed]) {
                return value
            }
        }

        throw FoundationModelsManagerError.generationFailed(
            "Failed to parse JSON response. Raw response: \(response.prefix(200))..."
        )
    }

    /// Try to parse a partial JSON container value (for streaming); returns nil
    /// while the payload is still incomplete. Scalar roots are only detectable
    /// once complete, so they surface via `jsonValueFromResponse` at stream end.
    private func tryParsePartialJsonValue(_ text: String) -> Any? {
        var jsonString = text.trimmingCharacters(in: .whitespacesAndNewlines)

        // Remove markdown code blocks if present
        if jsonString.hasPrefix("```json") {
            jsonString = String(jsonString.dropFirst(7))
        } else if jsonString.hasPrefix("```") {
            jsonString = String(jsonString.dropFirst(3))
        }
        jsonString = jsonString.trimmingCharacters(in: .whitespacesAndNewlines)

        guard let startIndex = jsonString.firstIndex(where: { $0 == "{" || $0 == "[" }) else {
            return nil
        }
        jsonString = String(jsonString[startIndex...])

        // Try to parse as-is first (complete JSON)
        if let data = jsonString.data(using: .utf8),
           let value = try? JSONSerialization.jsonObject(with: data, options: []) {
            return value
        }

        // For partial JSON, try to close open structures
        var balanced = jsonString
        var openBraces = 0
        var openBrackets = 0
        var inString = false
        var prevChar: Character = " "

        for char in balanced {
            if char == "\"" && prevChar != "\\" {
                inString.toggle()
            } else if !inString {
                switch char {
                case "{": openBraces += 1
                case "}": openBraces -= 1
                case "[": openBrackets += 1
                case "]": openBrackets -= 1
                default: break
                }
            }
            prevChar = char
        }

        if inString { balanced += "\"" }
        balanced += String(repeating: "]", count: max(0, openBrackets))
        balanced += String(repeating: "}", count: max(0, openBraces))

        if let data = balanced.data(using: .utf8),
           let value = try? JSONSerialization.jsonObject(with: data, options: []) {
            return value
        }

        return nil
    }

    // MARK: - iOS 27 Helpers (prompts, attachments, schemas, content)

    #if canImport(FoundationModels)

    /// Build a native `Prompt` from the JS-facing payload. Plain text works on
    /// iOS 26+; image attachments require iOS 27 and throw `featureUnavailable`
    /// on older OS versions.
    @available(iOS 26.0, macOS 26.0, *)
    private func makePrompt(_ prompt: FMPrompt) async throws -> Prompt {
        guard !prompt.images.isEmpty else {
            return Prompt(prompt.text)
        }
        guard #available(iOS 27.0, macOS 27.0, *) else {
            throw FoundationModelsManagerError.featureUnavailable(
                "Prompt image attachments require iOS 27.0 or later"
            )
        }
        var attachments: [Attachment<ImageAttachmentContent>] = []
        for image in prompt.images {
            attachments.append(try await makeImageAttachment(image))
        }
        return Prompt {
            prompt.text
            for attachment in attachments {
                attachment
            }
        }
    }

    /// Build an image `Attachment` from base64 data, or from a URI supporting
    /// http(s) URLs, `file://` URLs and plain filesystem paths. An empty or
    /// whitespace-only base64 payload counts as absent so it never overrides a
    /// valid URI.
    @available(iOS 27.0, macOS 27.0, *)
    private func makeImageAttachment(_ image: FMPromptImage) async throws -> Attachment<ImageAttachmentContent> {
        let base64 = image.base64?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !base64.isEmpty {
            return Attachment(try Self.cgImage(fromBase64: base64))
        }

        if let uri = image.uri?.trimmingCharacters(in: .whitespacesAndNewlines), !uri.isEmpty {
            if let url = URL(string: uri), let scheme = url.scheme?.lowercased() {
                switch scheme {
                case "http", "https":
                    let (data, _) = try await URLSession.shared.data(from: url)
                    return Attachment(try Self.cgImage(fromData: data))
                case "file":
                    // A valid RN-style file:// URI; standardize before touching disk.
                    let fileURL = url.standardizedFileURL
                    guard FileManager.default.fileExists(atPath: fileURL.path) else {
                        throw FoundationModelsManagerError.generationFailed("Prompt image file not found: \(uri)")
                    }
                    return Attachment(imageURL: fileURL)
                default:
                    break // Unrecognized scheme falls through to plain-path handling.
                }
            }
            let fileURL = URL(fileURLWithPath: uri).standardizedFileURL
            guard FileManager.default.fileExists(atPath: fileURL.path) else {
                throw FoundationModelsManagerError.generationFailed("Prompt image file not found: \(uri)")
            }
            return Attachment(imageURL: fileURL)
        }

        throw FoundationModelsManagerError.generationFailed(
            "Each prompt image must provide a non-empty 'uri' or 'base64'"
        )
    }

    private static func cgImage(fromBase64 base64: String) throws -> CGImage {
        guard let data = Data(base64Encoded: base64) else {
            throw FoundationModelsManagerError.generationFailed("Invalid base64 image data")
        }
        return try cgImage(fromData: data)
    }

    private static func cgImage(fromData data: Data) throws -> CGImage {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil),
              let cgImage = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
            throw FoundationModelsManagerError.generationFailed("Failed to decode image data")
        }
        return cgImage
    }

    /// Convert a JSON Schema dictionary into a native `GenerationSchema` via
    /// `DynamicGenerationSchema`. Supports objects, arrays, string enums, anyOf,
    /// primitives and `$ref`/`$defs`. Throws for unsupported constructs so callers
    /// can fall back to the prompt-based path — including constrained scalars
    /// (string `minLength`/`maxLength`, integer/number `minimum`/`maximum`),
    /// which native primitives cannot express.
    @available(iOS 26.0, macOS 26.0, *)
    private func makeGenerationSchema(fromJSONSchema json: [String: Any]) throws -> GenerationSchema {
        var definitions: [String: Any] = [:]
        if let defs = json["$defs"] as? [String: Any] {
            definitions.merge(defs) { _, new in new }
        }
        if let defs = json["definitions"] as? [String: Any] {
            definitions.merge(defs) { _, new in new }
        }

        var builtDefinitions: [String: DynamicGenerationSchema] = [:]
        var dependencies: [DynamicGenerationSchema] = []

        func definitionSchema(_ name: String) throws -> DynamicGenerationSchema {
            if let built = builtDefinitions[name] {
                return built
            }
            guard let definition = definitions[name] as? [String: Any] else {
                throw FoundationModelsManagerError.generationFailed(
                    "JSON Schema $ref target not found: \(name)"
                )
            }
            // Register a reference placeholder first so recursive $refs terminate.
            builtDefinitions[name] = DynamicGenerationSchema(referenceTo: name)
            let resolved = try dynamicSchema(from: definition, nameHint: name)
            builtDefinitions[name] = resolved
            dependencies.append(resolved)
            return resolved
        }

        // Native primitives (`String`/`Int`/`Double`) carry no length or range
        // bounds, so converting a constrained scalar would silently drop the
        // constraint. Throw instead: callers fall back to the prompt path,
        // where the embedded JSON Schema text keeps the bound visible.
        // exclusiveMinimum/exclusiveMaximum are intentionally not checked — the
        // public JSONSchema type does not declare them.
        func rejectUnenforceableScalarConstraints(
            _ schemaDict: [String: Any],
            keys: [String],
            typeName: String,
            nameHint: String?
        ) throws {
            let declared = keys.filter { schemaDict[$0] != nil }
            guard !declared.isEmpty else { return }
            let quoted = declared.map { "'\($0)'" }.joined(separator: ", ")
            throw FoundationModelsManagerError.generationFailed(
                "Unsupported JSON Schema constraint\(declared.count > 1 ? "s" : "") \(quoted) on \(typeName) '\(nameHint ?? "root")': native structured output cannot enforce it; falling back to the prompt path"
            )
        }

        func dynamicSchema(from schemaDict: [String: Any], nameHint: String?) throws -> DynamicGenerationSchema {
            if let ref = schemaDict["$ref"] as? String {
                let name = ref.hasPrefix("#/") ? ref.split(separator: "/").last.map(String.init) ?? ref : ref
                return try definitionSchema(name)
            }
            // A declared enum must survive conversion as a constraint. Detect any
            // enum before the [String] cast: string enums map to `anyOf`, while
            // numeric, boolean, mixed, or empty enums cannot be expressed safely.
            // Throw so callers fall back to the prompt path instead of silently
            // emitting an unconstrained Int/Double/Bool schema.
            if let rawEnum = schemaDict["enum"] as? [Any] {
                if let choices = rawEnum as? [String], !choices.isEmpty {
                    return DynamicGenerationSchema(name: nameHint ?? "value", description: schemaDict["description"] as? String, anyOf: choices)
                }
                throw FoundationModelsManagerError.generationFailed(
                    "Unsupported JSON Schema enum at '\(nameHint ?? "root")': only non-empty string enums are supported"
                )
            }
            if let anyOf = schemaDict["anyOf"] as? [[String: Any]] {
                let subSchemas = try anyOf.map { try dynamicSchema(from: $0, nameHint: nil) }
                return DynamicGenerationSchema(name: nameHint ?? "value", description: schemaDict["description"] as? String, anyOf: subSchemas)
            }

            switch schemaDict["type"] as? String {
            case "object":
                let objectName = (schemaDict["title"] as? String) ?? nameHint ?? "Object"
                let required = Set(schemaDict["required"] as? [String] ?? [])
                var properties: [DynamicGenerationSchema.Property] = []
                if let propertyDicts = schemaDict["properties"] as? [String: Any] {
                    for (propertyName, rawProperty) in propertyDicts {
                        guard let propertySchema = rawProperty as? [String: Any] else { continue }
                        let child = try dynamicSchema(from: propertySchema, nameHint: propertyName)
                        properties.append(.init(
                            name: propertyName,
                            description: propertySchema["description"] as? String,
                            schema: child,
                            isOptional: !required.contains(propertyName)
                        ))
                    }
                }
                return DynamicGenerationSchema(name: objectName, description: schemaDict["description"] as? String, properties: properties)
            case "array":
                let itemSchema = (schemaDict["items"] as? [String: Any]) ?? [:]
                let item = try dynamicSchema(from: itemSchema, nameHint: nameHint.map { "\($0)Item" })
                return DynamicGenerationSchema(
                    arrayOf: item,
                    minimumElements: schemaDict["minItems"] as? Int,
                    maximumElements: schemaDict["maxItems"] as? Int
                )
            case "string":
                try rejectUnenforceableScalarConstraints(schemaDict, keys: ["minLength", "maxLength"], typeName: "string", nameHint: nameHint)
                return DynamicGenerationSchema(type: String.self)
            case "integer":
                try rejectUnenforceableScalarConstraints(schemaDict, keys: ["minimum", "maximum"], typeName: "integer", nameHint: nameHint)
                return DynamicGenerationSchema(type: Int.self)
            case "number":
                try rejectUnenforceableScalarConstraints(schemaDict, keys: ["minimum", "maximum"], typeName: "number", nameHint: nameHint)
                return DynamicGenerationSchema(type: Double.self)
            case "boolean":
                return DynamicGenerationSchema(type: Bool.self)
            default:
                throw FoundationModelsManagerError.generationFailed(
                    "Unsupported JSON Schema construct at '\(nameHint ?? "root")': type \(schemaDict["type"] as? String ?? "missing")"
                )
            }
        }

        let root = try dynamicSchema(from: json, nameHint: json["title"] as? String ?? "Response")
        return try GenerationSchema(root: root, dependencies: dependencies)
    }

    /// Convert any `GeneratedContent` root into its JSON value — object, array,
    /// string, number, boolean or null — so non-object schema results survive.
    @available(iOS 26.0, macOS 26.0, *)
    private static func anyFromGeneratedContent(_ content: GeneratedContent) -> Any {
        switch content.kind {
        case .null:
            return NSNull()
        case .bool(let value):
            return value
        case .number(let value):
            return value
        case .string(let value):
            return value
        case .array(let items):
            return items.map { anyFromGeneratedContent($0) }
        case .structure(let properties, _):
            var dict: [String: Any] = [:]
            for (key, value) in properties {
                dict[key] = anyFromGeneratedContent(value)
            }
            return dict
        @unknown default:
            return NSNull()
        }
    }
    #endif

    // MARK: - Tool Calling

    /// Create a session with tools
    ///
    /// **iOS 26 Beta Workaround:**
    /// The native Tool API requires compile-time @Generable argument types.
    /// We store tool definitions separately and use prompt-based tool calling.
    func createSessionWithToolsAsync(options: [String: Any]) async throws -> String {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *) {
            let sessionId = UUID().uuidString

            guard let toolDicts = options["tools"] as? [[String: Any]], !toolDicts.isEmpty else {
                throw FoundationModelsManagerError.generationFailed("At least one tool must be provided")
            }

            let instructions = options["instructions"] as? String

            // Create a regular session (without native tools, we'll use prompt-based approach)
            let session: LanguageModelSession
            if let instructions = instructions, !instructions.isEmpty {
                session = LanguageModelSession(
                    model: SystemLanguageModel.default,
                    instructions: instructions
                )
            } else {
                session = LanguageModelSession(
                    model: SystemLanguageModel.default
                )
            }

            queue.async(flags: .barrier) {
                self.sessions[sessionId] = session
                // Store tool definitions for prompt-based tool calling
                self.sessionTools[sessionId] = toolDicts
            }

            return sessionId
        }
        #endif
        throw FoundationModelsManagerError.notAvailable
    }

    /// Send a prompt and get response (text or tool call)
    ///
    /// **iOS 26 Beta Workaround:**
    /// The native Tool API requires compile-time @Generable argument types, which can't be
    /// created dynamically from JavaScript. Instead, we use a prompt-based approach:
    /// 1. Include tool definitions in the prompt
    /// 2. Ask the model to respond with a JSON tool call if appropriate
    /// 3. Parse the response to detect tool calls
    ///
    /// `options.toolCallingMode` selects the protocol flavor: "required" demands one
    /// JSON tool call (a text-only reply throws a normalized error), "disallowed"
    /// omits definitions/instructions and always yields text, "allowed"/nil keeps
    /// the optional flow below.
    ///
    /// See: https://github.com/mcp-foundation/expo-foundation-models/issues/1
    func respondWithToolsAsync(
        sessionId: String,
        prompt: FMPrompt,
        options: FMGenerationOptions
    ) async throws -> [String: Any] {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *) {
            let session = try getSession(sessionId)

            do {
                try options.validateOSCapabilities()
                let mode = FMToolCallingProtocol(toolCallingMode: options.toolCallingMode)

                // The prompt-based protocol below owns tool-call detection and JS-side
                // execution; forwarding native `toolCallingMode` would push the model
                // toward hidden native calls that bypass JavaScript.
                var nativeOptions = options.toNativeOptions()
                nativeOptions.toolCallingMode = nil

                let structuredPrompt = try makeToolProtocolPrompt(
                    sessionId: sessionId,
                    prompt: prompt,
                    mode: mode
                )
                let nativePrompt = try await makePrompt(structuredPrompt)
                let response: LanguageModelSession.Response<String>
                if #available(iOS 27.0, macOS 27.0, *) {
                    response = try await session.respond(
                        to: nativePrompt,
                        options: nativeOptions,
                        contextOptions: options.toNativeContextOptions()
                    )
                } else {
                    response = try await session.respond(to: nativePrompt, options: nativeOptions)
                }

                switch mode {
                case .forbidden:
                    // Normal text response; never parse or surface a tool call.
                    return ["type": "text", "content": response.content]
                case .required:
                    // The caller depends on external data: a text-only reply fails
                    // the request instead of masquerading as an answer.
                    guard let toolCall = parseToolCallResponse(response.content) else {
                        throw FoundationModelsManagerError.generationFailed(
                            "The model did not return a parsable tool call while 'toolCallingMode' was 'required'"
                        )
                    }
                    return ["type": "toolCall", "toolCall": makeToolCallPayload(toolCall)]
                case .optional:
                    if let toolCall = parseToolCallResponse(response.content) {
                        return ["type": "toolCall", "toolCall": makeToolCallPayload(toolCall)]
                    }
                    return ["type": "text", "content": response.content]
                }
            } catch {
                throw Self.mapUnderlyingError(error, fallbackType: .generationFailed)
            }
        }
        #endif
        throw FoundationModelsManagerError.notAvailable
    }

    /// Submit tool result back to the model
    ///
    /// **iOS 26 Beta Workaround:**
    /// Uses prompt-based approach - we send the tool result as part of a new prompt
    /// and ask the model to continue the conversation.
    func submitToolResultAsync(
        sessionId: String,
        toolResult: [String: Any]
    ) async throws -> [String: Any] {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *) {
            let session = try getSession(sessionId)
            
            do {
                // Extract tool result information
                let callId = toolResult["callId"] as? String ?? "unknown"
                let result = toolResult["result"]
                
                // Format the result as JSON string
                var resultString: String
                if let resultDict = result as? [String: Any],
                   let jsonData = try? JSONSerialization.data(withJSONObject: resultDict, options: .prettyPrinted),
                   let json = String(data: jsonData, encoding: .utf8) {
                    resultString = json
                } else if let str = result as? String {
                    resultString = str
                } else {
                    resultString = String(describing: result ?? "null")
                }
                
                // Build a prompt that includes the tool result
                let prompt = """
                The tool has been executed and returned the following result:
                
                ```json
                \(resultString)
                ```
                
                Please use this information to provide a helpful response to the user's original question.
                """
                let response = try await session.respond(to: prompt)

                return [
                    "type": "text",
                    "content": response.content
                ]
            } catch {
                throw Self.mapUnderlyingError(error, fallbackType: .generationFailed)
            }
        }
        #endif
        throw FoundationModelsManagerError.notAvailable
    }
    /// Stream response with tool support
    ///
    /// **iOS 26 Beta Workaround:**
    /// Uses prompt-based tool calling with streaming.
    ///
    /// Honors `options.toolCallingMode` like `respondWithTools`: "required" fails when
    /// no parsable tool call arrives, "disallowed" streams plain text without any
    /// tool parsing or onToolCall emission, "allowed"/nil detects calls opportunistically.
    func streamWithToolsAsync(
        sessionId: String,
        prompt: FMPrompt,
        options: FMGenerationOptions,
        onToken: @escaping (String) -> Void,
        onToolCall: @escaping ([String: Any]) -> Void
    ) async throws -> [String: Any] {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *) {
            let session = try getSession(sessionId)

            do {
                try options.validateOSCapabilities()
                let mode = FMToolCallingProtocol(toolCallingMode: options.toolCallingMode)

                // The prompt-based protocol below owns tool-call detection and JS-side
                // execution; forwarding native `toolCallingMode` would push the model
                // toward hidden native calls that bypass JavaScript.
                var nativeOptions = options.toNativeOptions()
                nativeOptions.toolCallingMode = nil

                let structuredPrompt = try makeToolProtocolPrompt(
                    sessionId: sessionId,
                    prompt: prompt,
                    mode: mode
                )

                var fullResponse = ""
                let nativePrompt = try await makePrompt(structuredPrompt)
                let stream: LanguageModelSession.ResponseStream<String>
                if #available(iOS 27.0, macOS 27.0, *) {
                    stream = session.streamResponse(
                        to: nativePrompt,
                        options: nativeOptions,
                        contextOptions: options.toNativeContextOptions()
                    )
                } else {
                    stream = session.streamResponse(to: nativePrompt, options: nativeOptions)
                }

                for try await partialResponse in stream {
                    let newContent = partialResponse.content
                    if newContent.count > fullResponse.count {
                        let newToken = String(newContent.dropFirst(fullResponse.count))
                        fullResponse = newContent
                        onToken(newToken)
                    }
                }

                switch mode {
                case .forbidden:
                    // Normal streamed text; never parse or emit a tool call.
                    return ["type": "text", "content": fullResponse]
                case .required:
                    // A text-only reply fails the request instead of masquerading
                    // as an answer.
                    guard let toolCall = parseToolCallResponse(fullResponse) else {
                        throw FoundationModelsManagerError.generationFailed(
                            "The model did not return a parsable tool call while 'toolCallingMode' was 'required'"
                        )
                    }
                    let toolCallInfo = makeToolCallPayload(toolCall)
                    onToolCall(toolCallInfo)
                    return ["type": "toolCall", "toolCall": toolCallInfo]
                case .optional:
                    if let toolCall = parseToolCallResponse(fullResponse) {
                        let toolCallInfo = makeToolCallPayload(toolCall)
                        onToolCall(toolCallInfo)
                        return ["type": "toolCall", "toolCall": toolCallInfo]
                    }
                    return ["type": "text", "content": fullResponse]
                }
            } catch {
                throw Self.mapUnderlyingError(error, fallbackType: .streamingFailed)
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

    // MARK: - Tool Calling Helpers (Prompt-based workaround)
    //
    // iOS 26 Beta Workaround:
    // The native Tool API requires compile-time @Generable argument types.
    // We use a prompt-based approach instead:
    // 1. Include tool definitions in the prompt
    // 2. Ask the model to respond with JSON tool calls
    // 3. Parse the response to detect and extract tool calls
    
    /// Build a prompt section describing available tools
    private func buildToolsPrompt(for sessionId: String) -> String {
        var tools: [[String: Any]] = []
        queue.sync {
            tools = sessionTools[sessionId] ?? []
        }
        
        guard !tools.isEmpty else {
            return ""
        }
        
        var prompt = "You have access to the following tools:\n\n"
        
        for tool in tools {
            let name = tool["name"] as? String ?? "unknown"
            let description = tool["description"] as? String ?? ""
            prompt += "Tool: \(name)\n"
            prompt += "Description: \(description)\n"
            
            if let parameters = tool["parameters"] as? [String: Any] {
                if let properties = parameters["properties"] as? [String: Any] {
                    prompt += "Parameters:\n"
                    for (paramName, paramInfo) in properties {
                        if let info = paramInfo as? [String: Any] {
                            let type = info["type"] as? String ?? "any"
                            let desc = info["description"] as? String ?? ""
                            prompt += "  - \(paramName) (\(type)): \(desc)\n"
                        }
                    }
                }
                if let required = parameters["required"] as? [String] {
                    prompt += "Required: \(required.joined(separator: ", "))\n"
                }
            }
            prompt += "\n"
        }
        
        return prompt
    }
    
    /// Parse a response to detect if it contains a tool call
    private func parseToolCallResponse(_ response: String) -> [String: Any]? {
        let trimmed = response.trimmingCharacters(in: .whitespacesAndNewlines)
        
        // Try to find JSON in the response
        guard let jsonStart = trimmed.firstIndex(of: "{"),
              let jsonEnd = trimmed.lastIndex(of: "}") else {
            return nil
        }
        
        let jsonString = String(trimmed[jsonStart...jsonEnd])
        
        guard let data = jsonString.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        
        // Check for tool_call format
        if let toolCall = json["tool_call"] as? [String: Any] {
            return toolCall
        }
        
        // Also support direct format with "name" and "arguments"
        if let name = json["name"] as? String, json["arguments"] != nil {
            return json
        }
        
        return nil
    }

    /// Prompt-protocol semantics resolved from `options.toolCallingMode`.
    ///
    /// Values arrive pre-validated by `FMGenerationOptions.validateOSCapabilities`,
    /// so `default` only ever sees `nil` or "allowed".
    private enum FMToolCallingProtocol {
        case optional
        case required
        case forbidden

        init(toolCallingMode: String?) {
            switch toolCallingMode {
            case .some("required"): self = .required
            case .some("disallowed"): self = .forbidden
            default: self = .optional
            }
        }
    }

    /// Builds the prompt for the JavaScript-driven tool protocol, shared by
    /// respondWithTools/streamWithTools so both enforce identical
    /// `toolCallingMode` semantics. Image attachments are always preserved.
    private func makeToolProtocolPrompt(
        sessionId: String,
        prompt: FMPrompt,
        mode: FMToolCallingProtocol
    ) throws -> FMPrompt {
        switch mode {
        case .forbidden:
            // No tool definitions and no tool-call instructions: plain request.
            return prompt
        case .optional:
            return FMPrompt(
                text: """
                \(buildToolsPrompt(for: sessionId))

                User request: \(prompt.text)

                If you need to use a tool to answer, respond with ONLY a JSON object in this exact format:
                {"tool_call": {"name": "toolName", "arguments": {...}}}

                If you can answer directly without a tool, just respond normally with text.
                """,
                images: prompt.images
            )
        case .required:
            let toolsPrompt = buildToolsPrompt(for: sessionId)
            guard !toolsPrompt.isEmpty else {
                throw FoundationModelsManagerError.generationFailed(
                    "Generation option 'toolCallingMode' requires a session with at least one registered tool"
                )
            }
            return FMPrompt(
                text: """
                \(toolsPrompt)

                User request: \(prompt.text)

                You MUST call one of the tools above to answer this request. Respond with ONLY one JSON object in this exact format, with no text before or after it:
                {"tool_call": {"name": "toolName", "arguments": {...}}}
                """,
                images: prompt.images
            )
        }
    }

    /// Uniform wire payload for a parsed prompt-protocol tool call.
    private func makeToolCallPayload(_ toolCall: [String: Any]) -> [String: Any] {
        [
            "id": UUID().uuidString,
            "name": toolCall["name"] ?? "",
            "arguments": toolCall["arguments"] ?? [:]
        ]
    }

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

    /// Create a session with extended configuration (model, guardrails, useCase, tools, adapter)
    ///
    /// `options["model"] = { type: "privateCloudCompute" }` selects
    /// `PrivateCloudComputeLanguageModel()` (iOS 27+, otherwise `featureUnavailable`).
    /// `SystemLanguageModel(adapter:)` is obsoleted in iOS 27, so the adapter path is
    /// confined to the <27 branch; on iOS 27 an `adapterId` can no longer be honored.
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

            // Tools stay JS-driven: definitions are stored for the prompt-based
            // protocol instead of being registered as executable native tools.
            // Registering native tools here would let the framework "call" them in
            // its own loop and fabricate results that bypass JavaScript execution.
            var toolDicts: [[String: Any]] = []
            if let providedTools = options["tools"] as? [[String: Any]] {
                toolDicts = providedTools
            }

            let instructions = options["instructions"] as? String
            let requestedModelType = (options["model"] as? [String: Any])?["type"] as? String

            func storeSession(_ session: LanguageModelSession) -> String {
                queue.async(flags: .barrier) {
                    self.sessions[sessionId] = session
                    // Tool definitions feed the JS-driven prompt protocol only;
                    // no executable native tools are registered for these sessions.
                    self.sessionTools[sessionId] = toolDicts
                }
                return sessionId
            }

            // Private Cloud Compute model (iOS 27+ only)
            if requestedModelType == "privateCloudCompute" {
                guard #available(iOS 27.0, macOS 27.0, *) else {
                    throw FoundationModelsManagerError.featureUnavailable(
                        "Private Cloud Compute requires iOS 27.0 or later"
                    )
                }
                let pccModel = PrivateCloudComputeLanguageModel()
                guard pccModel.isAvailable else {
                    throw FoundationModelsManagerError.featureUnavailable(
                        "Private Cloud Compute is not available on this device or account"
                    )
                }
                let nativeInstructions = instructions.map { Instructions($0) }
                return storeSession(LanguageModelSession(
                    model: pccModel,
                    instructions: nativeInstructions
                ))
            }

            // System language model path. The 27-generic initializer also accepts
            // SystemLanguageModel, so both OS versions share one construction site per branch.
            if #available(iOS 27.0, macOS 27.0, *) {
                let model = SystemLanguageModel(useCase: useCase, guardrails: guardrails)
                return storeSession(LanguageModelSession(
                    model: model,
                    instructions: instructions
                ))
            }

            let model: SystemLanguageModel
            if let adapterId = options["adapterId"] as? String {
                let loadedAdapter = try getAdapter(adapterId)
                model = SystemLanguageModel(adapter: loadedAdapter, guardrails: guardrails)
            } else {
                model = SystemLanguageModel(useCase: useCase, guardrails: guardrails)
            }

            return storeSession(LanguageModelSession(
                model: model,
                instructions: instructions
            ))
        }
        #endif
        throw FoundationModelsManagerError.notAvailable
    }

    // MARK: - Token / Context / Variant Introspection

    /// Count tokens for a prompt (iOS 26.4+).
    func getTokenCountAsync(text: String) async throws -> Int {
        #if canImport(FoundationModels)
        if #available(iOS 26.4, macOS 26.4, *) {
            do {
                return try await SystemLanguageModel.default.tokenCount(for: text)
            } catch {
                throw Self.mapUnderlyingError(error, fallbackType: .generationFailed)
            }
        }
        #endif
        throw FoundationModelsManagerError.featureUnavailable(
            "Token counting requires iOS 26.4 or later"
        )
    }

    /// Get the model context window size (iOS 26.4+); null below.
    func getContextSizeAsync() async throws -> Int? {
        #if canImport(FoundationModels)
        if #available(iOS 26.4, macOS 26.4, *) {
            return SystemLanguageModel.default.contextSize
        }
        #endif
        return nil
    }

    /// Get the active model variant (iOS 27+); null when unsupported.
    ///
    /// Note: the contract's `SystemLanguageModel.variant` symbol does not exist in the
    /// final iOS 27 SDK (verified against the swiftinterface), so this currently always
    /// returns null even on iOS 27+. Kept behind the 27 guard so a future SDK symbol
    /// can be wired in without another API change.
    func getModelVariantAsync() async throws -> [String: Any]? {
        #if canImport(FoundationModels)
        if #available(iOS 27.0, macOS 27.0, *) {
            return nil
        }
        #endif
        return nil
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

                // Store adapter - use nonisolated(unsafe) for the capture since Adapter isn't Sendable
                // but we're only storing it, not mutating across threads
                let adapterToStore = adapter
                queue.async(flags: .barrier) { [adapterToStore] in
                    self.adapters[adapterId] = adapterToStore
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

                // Store adapter - use nonisolated(unsafe) for the capture since Adapter isn't Sendable
                // but we're only storing it, not mutating across threads
                let adapterToStore = adapter
                queue.async(flags: .barrier) { [adapterToStore] in
                    self.adapters[adapterId] = adapterToStore
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

        // MARK: - CoreML Diagnostics Functions

        AsyncFunction("getModelDiagnostics") { (modelId: String) -> [String: Any] in
            return try CoreMLManager.shared.getModelDiagnostics(modelId: modelId)
        }

        AsyncFunction("validateModelInput") { (modelId: String, input: [String: Any]) -> [String: Any] in
            return try CoreMLManager.shared.validateModelInput(modelId: modelId, input: input)
        }

        // MARK: - Foundation Models Functions

        Function("isAvailable") { () -> Bool in
            return FoundationModelsManager.shared.isAvailable()
        }

        Function("getAvailability") { () -> [String: Any] in
            return FoundationModelsManager.shared.getAvailability()
        }

        Function("getFeatures") { () -> [String: Any] in
            return [
                "osVersion": FoundationModelsManager.osVersionString(),
                "features": FoundationModelsManager.featureFlags()
            ]
        }

        Function("getLocaleInfo") { () -> [String: Any] in
            var info: [String: Any] = [
                "currentIdentifier": Locale.current.identifier,
                "preferredLanguages": Locale.preferredLanguages,
                "calendar": Locale.current.calendar.identifier
            ]

            // iOS 16+ language code access
            if #available(iOS 16, macOS 13, *) {
                info["languageCode"] = Locale.current.language.languageCode?.identifier ?? "unknown"
                info["regionCode"] = Locale.current.region?.identifier ?? "unknown"
            } else {
                info["languageCode"] = Locale.current.languageCode ?? "unknown"
                info["regionCode"] = Locale.current.regionCode ?? "unknown"
            }

            return info
        }

        // MARK: - Foundation Models Diagnostics Functions

        Function("getAvailabilityDiagnostics") { () -> [String: Any] in
            return FoundationModelsManager.shared.getAvailabilityDiagnostics()
        }

        AsyncFunction("getSessionDiagnostics") { (sessionId: String) -> [String: Any] in
            return try FoundationModelsManager.shared.getSessionDiagnostics(sessionId: sessionId)
        }

        AsyncFunction("createSession") { (instructions: String?) -> String in
            return try await FoundationModelsManager.shared.createSessionAsync(instructions: instructions)
        }

        AsyncFunction("closeSession") { (sessionId: String) in
            try FoundationModelsManager.shared.closeSession(sessionId: sessionId)
        }

        AsyncFunction("respond") { (sessionId: String, prompt: FMPrompt, options: [String: Any]?) -> String in
            let genOptions = FMGenerationOptions.from(dictionary: options)
            return try await FoundationModelsManager.shared.respondAsync(
                sessionId: sessionId,
                prompt: prompt,
                options: genOptions
            )
        }

        AsyncFunction("streamResponse") { (sessionId: String, prompt: FMPrompt, options: [String: Any]?) -> String in
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

        AsyncFunction("respondWithSchema") { (sessionId: String, prompt: FMPrompt, schema: [String: Any], options: [String: Any]?) -> Any in
            let genOptions = FMGenerationOptions.from(dictionary: options)
            return try await FoundationModelsManager.shared.respondWithSchemaAsync(
                sessionId: sessionId,
                prompt: prompt,
                schema: schema,
                options: genOptions
            )
        }

        AsyncFunction("respondWithChoices") { (sessionId: String, prompt: FMPrompt, choices: [String], options: [String: Any]?) -> String in
            let genOptions = FMGenerationOptions.from(dictionary: options)
            return try await FoundationModelsManager.shared.respondWithChoicesAsync(
                sessionId: sessionId,
                prompt: prompt,
                choices: choices,
                options: genOptions
            )
        }

        AsyncFunction("streamWithSchema") { (sessionId: String, prompt: FMPrompt, schema: [String: Any], options: [String: Any]?) -> Any in
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

        AsyncFunction("respondWithTools") { (sessionId: String, prompt: FMPrompt, options: [String: Any]?) -> [String: Any] in
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

        AsyncFunction("streamWithTools") { (sessionId: String, prompt: FMPrompt, options: [String: Any]?) -> [String: Any] in
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

        // MARK: - Model Introspection Functions

        AsyncFunction("getTokenCount") { (text: String) -> Int in
            return try await FoundationModelsManager.shared.getTokenCountAsync(text: text)
        }

        AsyncFunction("getContextSize") { () -> Int? in
            return try await FoundationModelsManager.shared.getContextSizeAsync()
        }

        AsyncFunction("getModelVariant") { () -> [String: Any]? in
            return try await FoundationModelsManager.shared.getModelVariantAsync()
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
