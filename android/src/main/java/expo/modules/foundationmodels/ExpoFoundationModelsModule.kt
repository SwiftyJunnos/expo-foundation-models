package expo.modules.foundationmodels

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException

class PlatformNotSupportedException : CodedException(
    code = "PLATFORM_NOT_SUPPORTED",
    message = "This feature is only available on iOS"
)

class ExpoFoundationModelsModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("ExpoFoundationModels")

        Events("onToken", "onPartialSchema", "onToolCall", "onAdapterDownload")

        // CoreML Functions (iOS only)

        AsyncFunction("loadModel") { modelName: String, promise: Promise ->
            promise.reject(PlatformNotSupportedException())
        }

        AsyncFunction("unloadModel") { modelId: String, promise: Promise ->
            promise.reject(PlatformNotSupportedException())
        }

        AsyncFunction("predict") { modelId: String, input: Map<String, Any>, promise: Promise ->
            promise.reject(PlatformNotSupportedException())
        }

        Function("isModelLoaded") { modelId: String ->
            false
        }

        Function("getLoadedModels") {
            emptyList<String>()
        }

        // Foundation Models Functions (iOS only)

        Function("isAvailable") {
            false
        }

        Function("getAvailability") {
            mapOf(
                "available" to false,
                "status" to "unavailable",
                "reason" to "platformNotSupported",
                "osVersion" to android.os.Build.VERSION.RELEASE,
                "features" to mapOf(
                    "privateCloudCompute" to false,
                    "imageAttachments" to false,
                    "contextOptions" to false,
                    "toolCallingMode" to false,
                    "tokenCounting" to false,
                    "modelVariant" to false
                )
            )
        }

        // Token / Context / Variant Info Functions (iOS only)

        AsyncFunction("getTokenCount") { text: String, promise: Promise ->
            promise.reject(PlatformNotSupportedException())
        }

        AsyncFunction("getContextSize") { promise: Promise ->
            promise.reject(PlatformNotSupportedException())
        }

        AsyncFunction("getModelVariant") { promise: Promise ->
            promise.reject(PlatformNotSupportedException())
        }

        AsyncFunction("createSession") { instructions: String?, promise: Promise ->
            promise.reject(PlatformNotSupportedException())
        }

        AsyncFunction("closeSession") { sessionId: String, promise: Promise ->
            promise.reject(PlatformNotSupportedException())
        }

        AsyncFunction("respond") { sessionId: String, prompt: String, options: Map<String, Any>?, promise: Promise ->
            promise.reject(PlatformNotSupportedException())
        }

        AsyncFunction("streamResponse") { sessionId: String, prompt: String, options: Map<String, Any>?, promise: Promise ->
            promise.reject(PlatformNotSupportedException())
        }

        // Structured Output Functions (iOS only)

        AsyncFunction("respondWithSchema") { sessionId: String, prompt: String, schema: Map<String, Any>, options: Map<String, Any>?, promise: Promise ->
            promise.reject(PlatformNotSupportedException())
        }

        AsyncFunction("respondWithChoices") { sessionId: String, prompt: String, choices: List<String>, options: Map<String, Any>?, promise: Promise ->
            promise.reject(PlatformNotSupportedException())
        }

        AsyncFunction("streamWithSchema") { sessionId: String, prompt: String, schema: Map<String, Any>, options: Map<String, Any>?, promise: Promise ->
            promise.reject(PlatformNotSupportedException())
        }

        // Tool Calling Functions (iOS only)

        AsyncFunction("createSessionWithTools") { options: Map<String, Any>, promise: Promise ->
            promise.reject(PlatformNotSupportedException())
        }

        AsyncFunction("respondWithTools") { sessionId: String, prompt: String, options: Map<String, Any>?, promise: Promise ->
            promise.reject(PlatformNotSupportedException())
        }

        AsyncFunction("submitToolResult") { sessionId: String, toolResult: Map<String, Any>, promise: Promise ->
            promise.reject(PlatformNotSupportedException())
        }

        AsyncFunction("streamWithTools") { sessionId: String, prompt: String, options: Map<String, Any>?, promise: Promise ->
            promise.reject(PlatformNotSupportedException())
        }

        // Session Management Functions (iOS only)

        AsyncFunction("getTranscript") { sessionId: String, promise: Promise ->
            promise.reject(PlatformNotSupportedException())
        }

        AsyncFunction("prewarm") { sessionId: String, options: Map<String, Any>?, promise: Promise ->
            promise.reject(PlatformNotSupportedException())
        }

        AsyncFunction("createSessionWithTranscript") { options: Map<String, Any>, promise: Promise ->
            promise.reject(PlatformNotSupportedException())
        }

        // Advanced Configuration Functions (iOS only)

        AsyncFunction("createSessionWithConfig") { options: Map<String, Any>, promise: Promise ->
            promise.reject(PlatformNotSupportedException())
        }

        // Adapter Functions (iOS only)

        AsyncFunction("loadAdapter") { name: String, options: Map<String, Any>?, promise: Promise ->
            promise.reject(PlatformNotSupportedException())
        }

        AsyncFunction("loadAdapterFromFile") { filePath: String, options: Map<String, Any>?, promise: Promise ->
            promise.reject(PlatformNotSupportedException())
        }

        AsyncFunction("compileAdapter") { adapterId: String, promise: Promise ->
            promise.reject(PlatformNotSupportedException())
        }

        AsyncFunction("unloadAdapter") { adapterId: String, promise: Promise ->
            promise.reject(PlatformNotSupportedException())
        }

        AsyncFunction("getAdapterDownloadStatus") { name: String, promise: Promise ->
            promise.reject(PlatformNotSupportedException())
        }

        AsyncFunction("removeObsoleteAdapters") { promise: Promise ->
            promise.reject(PlatformNotSupportedException())
        }

        AsyncFunction("isAdapterCompatible") { name: String, promise: Promise ->
            promise.reject(PlatformNotSupportedException())
        }

        // Feedback Functions (iOS only)

        AsyncFunction("logFeedback") { sessionId: String, options: Map<String, Any>, promise: Promise ->
            promise.reject(PlatformNotSupportedException())
        }
    }
}
