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

        Events("onToken")

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
                "reason" to "platformNotSupported"
            )
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
    }
}
