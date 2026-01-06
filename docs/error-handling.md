# Error Handling

Handle errors gracefully in your Foundation Models and CoreML integrations with detailed root cause analysis and diagnostics.

## Error Classes

### FoundationModelsError

Enhanced error class with root cause analysis and actionable suggestions:

```typescript
import { FoundationModelsError } from 'expo-foundation-models';

try {
  await FoundationModels.respond(sessionId, prompt);
} catch (error) {
  if (error instanceof FoundationModelsError) {
    // Basic error info
    console.error('Type:', error.type);
    console.error('Message:', error.message);
    console.error('Code:', error.code);

    // Enhanced diagnostics (NEW)
    console.error('Root Cause:', error.cause);
    console.error('Explanation:', error.getCauseExplanation());
    console.error('Suggestions:', error.suggestions);
    console.error('Diagnostics:', error.diagnostics);
  }
}
```

### CoreMLError

Enhanced error class with detailed diagnostics for model issues:

```typescript
import { CoreMLError } from 'expo-foundation-models';

try {
  await CoreML.loadModel('MyModel');
} catch (error) {
  if (error instanceof CoreMLError) {
    // Basic error info
    console.error('Message:', error.message);
    console.error('Code:', error.code);

    // Enhanced diagnostics (NEW)
    console.error('Root Cause:', error.cause);
    console.error('Explanation:', error.getCauseExplanation());
    console.error('Suggestions:', error.suggestions);

    // Check specific error types
    if (error.isInputShapeIssue()) {
      console.error('Input shape diagnostics:', error.diagnostics?.inputShapes);
    }
  }
}
```

## Root Cause Analysis

Errors now include a `cause` property that identifies the specific reason for failure:

### Foundation Models Error Causes

| Cause | Description |
|-------|-------------|
| `deviceNotEligible` | Device doesn't support Apple Intelligence |
| `appleIntelligenceDisabled` | Apple Intelligence not enabled in Settings |
| `modelNotDownloaded` | On-device model still downloading |
| `contextWindowExceeded` | Conversation too long |
| `inputTooLong` | Prompt exceeds token limit |
| `guardrailViolation` | Content blocked by safety filters |
| `contentRefused` | Model refused the request |
| `sessionExpired` | Session timed out |
| `unsupportedLanguage` | Language not supported |

### CoreML Error Causes

| Cause | Description |
|-------|-------------|
| `computeUnitIncompatible` | Required compute unit not available |
| `fileNotFound` | Model file missing from bundle |
| `insufficientMemory` | Not enough memory to load model |
| `inputShapeMismatch` | Input dimensions don't match |
| `dataTypeMismatch` | Wrong input data type |
| `missingFeature` | Required input not provided |

## Foundation Models Error Types

| Type | Description | Common Cause |
|------|-------------|--------------|
| `guardrailViolation` | Content blocked by safety | Unsafe prompt or response |
| `refusal` | Model refused to respond | Inappropriate request |
| `notAvailable` | Service not available | iOS version, device, settings |
| `sessionNotFound` | Session doesn't exist | Closed or expired session |
| `generationFailed` | Generation error | Invalid parameters, network |
| `streamingFailed` | Streaming error | Connection issue |
| `unsupportedLanguage` | Language not supported | Non-English content |
| `unknown` | Unexpected error | Various causes |

## Handling Specific Errors

### Guardrail Violations

```typescript
try {
  const response = await FoundationModels.respond(sessionId, prompt);
} catch (error) {
  if (error instanceof FoundationModelsError) {
    if (error.isGuardrailViolation()) {
      console.log('Content was blocked by safety filters.');
      console.log('Context:', error.context);
      
      // Show user-friendly message
      showAlert('Your request contains content that cannot be processed.');
    }
  }
}
```

### Refusals

```typescript
try {
  const response = await FoundationModels.respond(sessionId, prompt);
} catch (error) {
  if (error instanceof FoundationModelsError) {
    if (error.isRefusal()) {
      console.log('Model refused the request.');
      console.log('Explanation:', error.refusalExplanation);
      
      // Suggest rephrasing
      showAlert('The assistant cannot help with this request. Please try rephrasing.');
    }
  }
}
```

### Availability Issues

```typescript
try {
  const sessionId = await FoundationModels.createSession();
} catch (error) {
  if (error instanceof FoundationModelsError && error.type === 'notAvailable') {
    // Check detailed availability
    const { reason } = FoundationModels.getAvailability();
    
    switch (reason) {
      case 'deviceNotEligible':
        showAlert('This device does not support Apple Intelligence.');
        break;
      case 'appleIntelligenceNotEnabled':
        showAlert('Please enable Apple Intelligence in Settings.');
        break;
      case 'modelNotReady':
        showAlert('The AI model is still downloading. Please try again later.');
        break;
      case 'platformNotSupported':
        showAlert('This feature requires iOS 26 or later.');
        break;
    }
  }
}
```

### Session Errors

```typescript
try {
  const response = await FoundationModels.respond(sessionId, prompt);
} catch (error) {
  if (error instanceof FoundationModelsError && error.type === 'sessionNotFound') {
    // Session expired or was closed
    console.log('Session no longer exists, creating new one...');
    
    sessionId = await FoundationModels.createSession(instructions);
    // Retry the request
    const response = await FoundationModels.respond(sessionId, prompt);
  }
}
```

## Comprehensive Error Handler

```typescript
import { FoundationModelsError, FoundationModels } from 'expo-foundation-models';

type ErrorResult = {
  userMessage: string;
  shouldRetry: boolean;
  technicalDetails?: string;
};

function handleFoundationModelsError(error: unknown): ErrorResult {
  if (!(error instanceof FoundationModelsError)) {
    return {
      userMessage: 'An unexpected error occurred.',
      shouldRetry: true,
      technicalDetails: String(error),
    };
  }

  switch (error.type) {
    case 'guardrailViolation':
      return {
        userMessage: 'Your request could not be processed due to content restrictions.',
        shouldRetry: false,
      };

    case 'refusal':
      return {
        userMessage: 'The assistant cannot help with this type of request.',
        shouldRetry: false,
        technicalDetails: error.refusalExplanation,
      };

    case 'notAvailable':
      const { reason } = FoundationModels.getAvailability();
      return {
        userMessage: getAvailabilityMessage(reason),
        shouldRetry: reason === 'modelNotReady',
      };

    case 'sessionNotFound':
      return {
        userMessage: 'Your session has expired. Starting a new conversation.',
        shouldRetry: true,
      };

    case 'generationFailed':
      return {
        userMessage: 'Failed to generate a response. Please try again.',
        shouldRetry: true,
        technicalDetails: error.message,
      };

    case 'streamingFailed':
      return {
        userMessage: 'Connection interrupted. Please try again.',
        shouldRetry: true,
      };

    case 'unsupportedLanguage':
      return {
        userMessage: 'This language is not currently supported.',
        shouldRetry: false,
      };

    default:
      return {
        userMessage: 'Something went wrong. Please try again.',
        shouldRetry: true,
        technicalDetails: error.message,
      };
  }
}

function getAvailabilityMessage(reason?: string): string {
  switch (reason) {
    case 'deviceNotEligible':
      return 'Your device does not support this feature.';
    case 'appleIntelligenceNotEnabled':
      return 'Please enable Apple Intelligence in your device Settings.';
    case 'modelNotReady':
      return 'The AI is still setting up. Please try again in a few minutes.';
    default:
      return 'This feature is not available on your device.';
  }
}
```

## Retry Logic

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry certain errors
      if (error instanceof FoundationModelsError) {
        if (['guardrailViolation', 'refusal', 'notAvailable', 'unsupportedLanguage'].includes(error.type)) {
          throw error;
        }
      }

      // Wait before retry
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
      }
    }
  }

  throw lastError;
}

// Usage
const response = await withRetry(
  () => FoundationModels.respond(sessionId, prompt),
  3,
  1000
);
```

## React Hook for Error Handling

```typescript
import { useState, useCallback } from 'react';
import { FoundationModelsError } from 'expo-foundation-models';

interface UseFoundationModelsResult<T> {
  execute: (...args: any[]) => Promise<T | undefined>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

function useFoundationModels<T>(
  fn: (...args: any[]) => Promise<T>
): UseFoundationModelsResult<T> {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (...args: any[]) => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await fn(...args);
        return result;
      } catch (e) {
        const { userMessage } = handleFoundationModelsError(e);
        setError(userMessage);
        return undefined;
      } finally {
        setIsLoading(false);
      }
    },
    [fn]
  );

  const clearError = useCallback(() => setError(null), []);

  return { execute, isLoading, error, clearError };
}

// Usage
function ChatComponent() {
  const { execute: sendMessage, isLoading, error, clearError } = useFoundationModels(
    (prompt: string) => FoundationModels.respond(sessionId, prompt)
  );

  const handleSend = async () => {
    const response = await sendMessage(userInput);
    if (response) {
      // Handle success
    }
  };

  return (
    <View>
      {error && (
        <View>
          <Text>{error}</Text>
          <Button title="Dismiss" onPress={clearError} />
        </View>
      )}
      {/* ... */}
    </View>
  );
}
```

## Diagnostics API

Use the diagnostics API to proactively check for issues and get detailed information:

### Foundation Models Diagnostics

```typescript
// Get detailed availability diagnostics
const diag = FoundationModels.diagnostics.getAvailability();
if (!diag.isAvailable) {
  console.log('Cause:', diag.cause);
  console.log('Explanation:', diag.causeExplanation);
  console.log('Suggestions:', diag.suggestions);
  // e.g., cause: 'appleIntelligenceDisabled'
  //       suggestions: ['Go to Settings > Apple Intelligence & Siri']
}

// Get session diagnostics including context window usage
const session = await FoundationModels.diagnostics.getSession(sessionId);
console.log(`Token usage: ${session.contextWindow.estimatedUsedTokens}/${session.contextWindow.maxTokens}`);
if (session.contextWindow.remainingTokens < 500) {
  console.log('Warning: Running low on context window');
}

// Analyze any error for enhanced information
try {
  await FoundationModels.respond(sessionId, prompt);
} catch (error) {
  const analysis = FoundationModels.diagnostics.analyzeError(error);
  console.log('Root cause:', analysis.cause);
  console.log('Explanation:', analysis.explanation);
  console.log('Suggestions:', analysis.suggestions);
}
```

### CoreML Diagnostics

```typescript
// Get model diagnostics
const modelDiag = await CoreML.diagnostics.getModel(modelId);
console.log('Input features:', modelDiag.inputFeatures);
console.log('Output features:', modelDiag.outputFeatures);
console.log('Device info:', modelDiag.deviceInfo);

// Validate input before prediction (catch errors early)
const validation = await CoreML.diagnostics.validateInput(modelId, input);
if (!validation.isValid) {
  console.log('Issues found:');
  for (const issue of validation.issues) {
    console.log(`- ${issue.featureName}: ${issue.issue}`);
    if (issue.expectedShape && issue.receivedShape) {
      console.log(`  Expected shape: ${issue.expectedShape}, got: ${issue.receivedShape}`);
    }
  }
  console.log('Suggestions:', validation.suggestions);
}
```

## Error Helper Methods

### FoundationModelsError Methods

```typescript
error.isGuardrailViolation()     // Content blocked by safety
error.isRefusal()                // Model refused request
error.isContextWindowExceeded()  // Too many tokens
error.isDeviceEligibilityIssue() // Device can't run AI
error.isModelAvailabilityIssue() // Model not downloaded
error.isSessionIssue()           // Session expired/invalid
error.getCauseExplanation()      // Human-readable cause
error.toJSON()                   // Serialize for logging
```

### CoreMLError Methods

```typescript
error.isComputeUnitIssue()  // GPU/Neural Engine not available
error.isInputShapeIssue()   // Wrong input dimensions
error.isMemoryIssue()       // Not enough memory
error.isModelNotFound()     // Model file missing
error.isDataTypeIssue()     // Wrong input types
error.getCauseExplanation() // Human-readable cause
error.toJSON()              // Serialize for logging
```

## Logging Errors

```typescript
function logError(error: unknown, context: Record<string, unknown>) {
  if (error instanceof FoundationModelsError) {
    console.error('FoundationModels Error:', {
      type: error.type,
      message: error.message,
      code: error.code,
      cause: error.cause,
      causeExplanation: error.getCauseExplanation(),
      suggestions: error.suggestions,
      diagnostics: error.diagnostics,
      refusalExplanation: error.refusalExplanation,
      context: error.context,
      ...context,
    });

    // Send to your logging service
    errorReporter.captureException(error, {
      tags: { errorType: error.type, cause: error.cause },
      extra: { ...context, suggestions: error.suggestions },
    });
  } else if (error instanceof CoreMLError) {
    console.error('CoreML Error:', {
      message: error.message,
      code: error.code,
      cause: error.cause,
      causeExplanation: error.getCauseExplanation(),
      suggestions: error.suggestions,
      diagnostics: error.diagnostics,
      ...context,
    });

    errorReporter.captureException(error, {
      tags: { cause: error.cause },
      extra: { ...context, suggestions: error.suggestions },
    });
  } else {
    console.error('Unknown Error:', error);
    errorReporter.captureException(error, { extra: context });
  }
}
```

## Best Practices

1. **Always catch errors** - Every async call can fail
2. **Show user-friendly messages** - Don't expose technical details
3. **Retry when appropriate** - Network errors are often transient
4. **Log for debugging** - Capture context for investigation
5. **Check availability first** - Before creating sessions
6. **Handle session expiry** - Recreate sessions when needed

## Next Steps

- [Getting Started](./getting-started.md) - Back to basics
- [Foundation Models](./foundation-models.md) - Text generation
