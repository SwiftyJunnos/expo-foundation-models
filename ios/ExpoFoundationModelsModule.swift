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
    ///
    /// **iOS 26 Beta Workaround:**
    /// The `DynamicGenerationSchema` API doesn't support runtime schema construction in current betas.
    /// Instead, we use a prompt-based approach:
    /// 1. Include the JSON schema in the prompt
    /// 2. Ask the model to generate JSON matching that schema
    /// 3. Parse and validate the response
    ///
    /// This approach is less reliable than native schema enforcement but works with the current API.
    /// See: https://github.com/mcp-foundation/expo-foundation-models/issues/1
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
                // Build a prompt that includes only the schema (no English instructions)
                // English text mixed with non-English prompts can trigger unsupportedLanguageOrLocale errors
                let schemaJson = try JSONSerialization.data(withJSONObject: schema, options: .sortedKeys)
                let schemaString = String(data: schemaJson, encoding: .utf8) ?? "{}"

                // Keep prompt minimal - just the user prompt + schema as JSON
                // The session's system instructions should already specify output format
                let structuredPrompt = """
                \(prompt)

                JSON Schema: \(schemaString)
                """

                let nativeOptions = options.toNativeOptions()
                let response = try await session.respond(to: structuredPrompt, options: nativeOptions)
                
                // Parse the JSON response - access .content from Response<String>
                return try parseJsonResponse(response.content)
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
    ///
    /// **iOS 26 Beta Workaround:**
    /// Uses prompt-based approach instead of `DynamicGenerationSchema` enum.
    /// The model is asked to respond with exactly one of the provided choices.
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
                // Build a prompt that constrains the response to one of the choices
                // Avoid English instructions that can trigger unsupportedLanguageOrLocale errors
                let choicesFormatted = choices.map { "\"\($0)\"" }.joined(separator: ", ")

                // Keep prompt minimal - just user prompt + choices
                let structuredPrompt = """
                \(prompt)

                [\(choicesFormatted)]
                """

                let nativeOptions = options.toNativeOptions()
                let response = try await session.respond(to: structuredPrompt, options: nativeOptions)
                
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
    ///
    /// **iOS 26 Beta Workaround:**
    /// Uses prompt-based streaming with JSON parsing on each chunk.
    /// Partial results are emitted as the JSON is being constructed.
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
                // Build a prompt that includes only the schema (no English instructions)
                // English text mixed with non-English prompts can trigger unsupportedLanguageOrLocale errors
                let schemaJson = try JSONSerialization.data(withJSONObject: schema, options: .sortedKeys)
                let schemaString = String(data: schemaJson, encoding: .utf8) ?? "{}"

                // Keep prompt minimal - just the user prompt + schema as JSON
                let structuredPrompt = """
                \(prompt)

                JSON Schema: \(schemaString)
                """

                let nativeOptions = options.toNativeOptions()
                let stream = session.streamResponse(to: structuredPrompt, options: nativeOptions)
                
                var accumulatedText = ""
                var finalResult: [String: Any] = [:]

                for try await partialResponse in stream {
                    // Access .content from the stream snapshot
                    accumulatedText = partialResponse.content
                    
                    // Try to parse partial JSON (may fail for incomplete JSON, which is expected)
                    if let partial = tryParsePartialJson(accumulatedText) {
                        finalResult = partial
                        onPartial(partial)
                    }
                }
                
                // Parse the final complete response
                if let parsed = tryParsePartialJson(accumulatedText) {
                    return parsed
                }
                
                // If parsing failed, try to extract JSON from the response
                return try parseJsonResponse(accumulatedText)
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

    // MARK: - JSON Parsing Helpers
    // 
    // iOS 26 Beta Workaround:
    // Since DynamicGenerationSchema doesn't support runtime schema construction,
    // we use prompt-based JSON generation and parse the text response.
    // 
    // These helpers extract and parse JSON from model responses.
    // See: https://github.com/mcp-foundation/expo-foundation-models/issues/1

    /// Parse a JSON response from the model, handling common formatting issues
    private func parseJsonResponse(_ response: String) throws -> [String: Any] {
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
        
        // Try to find JSON object boundaries if there's extra text
        if let startIndex = jsonString.firstIndex(of: "{"),
           let endIndex = jsonString.lastIndex(of: "}") {
            jsonString = String(jsonString[startIndex...endIndex])
        }
        
        guard let data = jsonString.data(using: .utf8) else {
            throw FoundationModelsManagerError.generationFailed("Failed to encode response as UTF-8")
        }
        
        do {
            guard let dict = try JSONSerialization.jsonObject(with: data, options: []) as? [String: Any] else {
                throw FoundationModelsManagerError.generationFailed("Response is not a JSON object")
            }
            return dict
        } catch {
            throw FoundationModelsManagerError.generationFailed(
                "Failed to parse JSON response: \(error.localizedDescription). Raw response: \(jsonString.prefix(200))..."
            )
        }
    }
    
    /// Try to parse partial JSON (for streaming), returns nil if incomplete
    private func tryParsePartialJson(_ text: String) -> [String: Any]? {
        var jsonString = text.trimmingCharacters(in: .whitespacesAndNewlines)
        
        // Remove markdown code blocks if present
        if jsonString.hasPrefix("```json") {
            jsonString = String(jsonString.dropFirst(7))
        } else if jsonString.hasPrefix("```") {
            jsonString = String(jsonString.dropFirst(3))
        }
        jsonString = jsonString.trimmingCharacters(in: .whitespacesAndNewlines)
        
        // Find the JSON object start
        guard let startIndex = jsonString.firstIndex(of: "{") else {
            return nil
        }
        jsonString = String(jsonString[startIndex...])
        
        // Try to parse as-is first (complete JSON)
        if let data = jsonString.data(using: .utf8),
           let dict = try? JSONSerialization.jsonObject(with: data, options: []) as? [String: Any] {
            return dict
        }
        
        // For partial JSON, try to close open brackets
        // This is a simple heuristic that works for many cases
        var balanced = jsonString
        var openBraces = 0
        var openBrackets = 0
        var inString = false
        var prevChar: Character = " "
        
        for char in balanced {
            if char == "\"" && prevChar != "\\" {
                inString = !inString
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
        
        // Close any open structures
        if inString { balanced += "\"" }
        balanced += String(repeating: "]", count: max(0, openBrackets))
        balanced += String(repeating: "}", count: max(0, openBraces))
        
        if let data = balanced.data(using: .utf8),
           let dict = try? JSONSerialization.jsonObject(with: data, options: []) as? [String: Any] {
            return dict
        }
        
        return nil
    }

    #if canImport(FoundationModels)
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
    /// See: https://github.com/mcp-foundation/expo-foundation-models/issues/1
    func respondWithToolsAsync(
        sessionId: String,
        prompt: String,
        options: FMGenerationOptions
    ) async throws -> [String: Any] {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *) {
            let session = try getSession(sessionId)

            do {
                // Get the tools from the session's configuration
                // We need to build a prompt that includes tool information
                let toolsPrompt = buildToolsPrompt(for: sessionId)
                
                let structuredPrompt = """
                \(toolsPrompt)

                User request: \(prompt)

                If you need to use a tool to answer, respond with ONLY a JSON object in this exact format:
                {"tool_call": {"name": "toolName", "arguments": {...}}}

                If you can answer directly without a tool, just respond normally with text.
                """
                
                let nativeOptions = options.toNativeOptions()
                let response = try await session.respond(to: structuredPrompt, options: nativeOptions)
                
                // Try to parse as a tool call
                if let toolCall = parseToolCallResponse(response.content) {
                    return [
                        "type": "toolCall",
                        "toolCall": [
                            "id": UUID().uuidString,
                            "name": toolCall["name"] ?? "",
                            "arguments": toolCall["arguments"] ?? [:]
                        ]
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
            } catch let error as LanguageModelSession.GenerationError {
                throw mapGenerationError(error)
            } catch {
                throw FoundationModelsManagerError.generationFailed(error.localizedDescription)
            }
        }
        #endif
        throw FoundationModelsManagerError.notAvailable
    }

    /// Stream response with tool support
    ///
    /// **iOS 26 Beta Workaround:**
    /// Uses prompt-based tool calling with streaming.
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
                // Build prompt with tool information
                let toolsPrompt = buildToolsPrompt(for: sessionId)
                
                let structuredPrompt = """
                \(toolsPrompt)

                User request: \(prompt)

                If you need to use a tool to answer, respond with ONLY a JSON object in this exact format:
                {"tool_call": {"name": "toolName", "arguments": {...}}}

                If you can answer directly without a tool, just respond normally with text.
                """
                
                var fullResponse = ""
                let nativeOptions = options.toNativeOptions()
                let stream = session.streamResponse(to: structuredPrompt, options: nativeOptions)

                for try await partialResponse in stream {
                    let newContent = partialResponse.content
                    if newContent.count > fullResponse.count {
                        let newToken = String(newContent.dropFirst(fullResponse.count))
                        fullResponse = newContent
                        onToken(newToken)
                    }
                }

                // Check for tool call in the response
                if let toolCall = parseToolCallResponse(fullResponse) {
                    let toolCallInfo: [String: Any] = [
                        "id": UUID().uuidString,
                        "name": toolCall["name"] ?? "",
                        "arguments": toolCall["arguments"] ?? [:]
                    ]
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

// MARK: - Dynamic Tool

#if canImport(FoundationModels)
@available(iOS 26.0, macOS 26.0, *)
private struct DynamicTool: Tool, @unchecked Sendable {
    // Note: @unchecked Sendable is used because [String: Any] contains Any which is not Sendable.
    // This is safe in our use case as the parametersDict is only read, never mutated after init.
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
