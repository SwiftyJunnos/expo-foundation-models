# Adapters

Load and use fine-tuned (adapted) models for specialized tasks.

## Overview

Adapters are custom-trained models that specialize the base Foundation Models for specific use cases. They're distributed via Background Assets and require special entitlements.

## Requirements

### Entitlement

Add to your app's entitlements:
```xml
<key>com.apple.developer.foundation-model-adapter</key>
<true/>
```

### Background Assets

Configure adapters in your app's Background Assets manifest.

## Loading Adapters

### From Background Assets

```typescript
import { FoundationModels } from 'expo-foundation-models';

// Load adapter by name
const adapter = await FoundationModels.loadAdapter('myCustomAdapter');

console.log('Adapter loaded:', adapter);
// {
//   id: "adapter-uuid-123",
//   name: "myCustomAdapter",
//   isReady: true,
//   isCompiled: false,
//   metadata: { version: "1.0", author: "..." }
// }
```

### With Compilation

Compile the adapter for faster inference:

```typescript
const adapter = await FoundationModels.loadAdapter('myCustomAdapter', {
  compile: true,
});

console.log(adapter.isCompiled); // true
```

### From Local File

Load from a `.fmadapter` file:

```typescript
const adapter = await FoundationModels.loadAdapterFromFile(
  '/path/to/custom.fmadapter',
  { compile: true }
);
```

## Using Adapters

### Create Session with Adapter

```typescript
// Load adapter
const adapter = await FoundationModels.loadAdapter('myCustomAdapter');

// Create session using adapter
const sessionId = await FoundationModels.createSession({
  adapterId: adapter.id,
  instructions: 'You are a specialized assistant.',
  guardrails: 'default',
});

// Use session normally
const response = await FoundationModels.respond(sessionId, 'Hello!');
```

### Combine with Other Options

```typescript
const sessionId = await FoundationModels.createSession({
  adapterId: adapter.id,
  instructions: 'You are an expert in domain X.',
  guardrails: 'permissiveContentTransformations',
  useCase: 'contentTagging',
  tools: myTools,
});
```

## Adapter Management

### Check Compatibility

```typescript
const compatible = await FoundationModels.isAdapterCompatible('myAdapter');

if (!compatible) {
  console.log('Adapter is not compatible with current model version');
}
```

### Check Download Status

```typescript
const status = await FoundationModels.getAdapterDownloadStatus('myAdapter');

switch (status.state) {
  case 'notStarted':
    console.log('Download not started');
    break;
  case 'downloading':
    console.log(`Downloading: ${status.progress * 100}%`);
    break;
  case 'paused':
    console.log('Download paused');
    break;
  case 'completed':
    console.log('Ready to use');
    break;
  case 'failed':
    console.log('Download failed:', status.error);
    break;
}
```

### Compile Adapter

Compile later if not done at load time:

```typescript
await FoundationModels.compileAdapter(adapter.id);
```

### Unload Adapter

Free memory when done:

```typescript
await FoundationModels.unloadAdapter(adapter.id);
```

### Remove Obsolete Adapters

Clean up adapters incompatible with current model:

```typescript
await FoundationModels.removeObsoleteAdapters();
```

## Adapter Info

```typescript
interface AdapterInfo {
  id: string;           // Unique instance ID
  name: string;         // Adapter name
  isReady: boolean;     // Ready for use
  isCompiled: boolean;  // Compiled for faster inference
  metadata?: {          // Creator-defined metadata
    [key: string]: unknown;
  };
}
```

## Complete Example

```typescript
import { FoundationModels, FoundationModelsError } from 'expo-foundation-models';

async function useCustomAdapter() {
  let adapter = null;
  let sessionId = null;
  
  try {
    // Check compatibility first
    const compatible = await FoundationModels.isAdapterCompatible('legalAssistant');
    if (!compatible) {
      throw new Error('Adapter not compatible');
    }
    
    // Load and compile
    adapter = await FoundationModels.loadAdapter('legalAssistant', {
      compile: true,
    });
    
    console.log('Loaded adapter:', adapter.name);
    console.log('Metadata:', adapter.metadata);
    
    // Create session
    sessionId = await FoundationModels.createSession({
      adapterId: adapter.id,
      instructions: 'You are a legal document assistant.',
    });
    
    // Use the specialized model
    const response = await FoundationModels.respond(
      sessionId,
      'Summarize this contract clause...'
    );
    
    console.log(response);
    
  } catch (error) {
    if (error instanceof FoundationModelsError) {
      console.error('Error:', error.message);
    }
  } finally {
    // Cleanup
    if (sessionId) {
      await FoundationModels.closeSession(sessionId);
    }
    if (adapter) {
      await FoundationModels.unloadAdapter(adapter.id);
    }
  }
}
```

## Best Practices

1. **Check compatibility** - Before loading adapters
2. **Compile for production** - Improves inference speed
3. **Unload when done** - Free memory
4. **Remove obsolete** - Clean up old versions
5. **Handle download states** - Adapters may not be ready immediately

## Next Steps

- [Feedback](./feedback.md) - Log response quality
- [Error Handling](./error-handling.md) - Handle adapter errors
