# Adapters

Load and use fine-tuned (adapted) models for specialized tasks.

## Overview

Adapters are custom-trained models that specialize the base Foundation Models for specific use cases. They use a technique called LoRA (Low-Rank Adaptation) to efficiently adapt the on-device language model without modifying its original weights.

This package supports **loading and using** pre-trained adapters. Training adapters requires Apple's separate Python toolkit.

## Training vs Using Adapters

| Task | Tool | Environment |
|------|------|-------------|
| **Training adapters** | [Apple's Python Toolkit](https://developer.apple.com/apple-intelligence/foundation-models-adapter/) | Mac with Apple Silicon (32GB+ RAM) or Linux GPU |
| **Using adapters** | This package (`expo-foundation-models`) | iOS 26+ device with Apple Intelligence |

## Training Adapters

### When to Consider Adapters

Before training an adapter, try prompt engineering or tool calling first. Consider adapters if:

- You need the model to become a subject-matter expert
- You need specific style, format, or policy adherence
- Prompt engineering isn't achieving required accuracy
- You want lower latency (adapters need minimal prompting)

### Training Requirements

| Requirement | Details |
|-------------|---------|
| **Hardware** | Mac with Apple Silicon + 32GB RAM, or Linux GPU |
| **Python** | 3.11 or later |
| **Data** | 100-1,000 samples for basic tasks, 5,000+ for complex |
| **Storage** | ~160MB per adapter |
| **Entitlement** | Required for App Store distribution |

### Training Workflow

1. **Download the toolkit** from [Apple Developer](https://developer.apple.com/download/foundation-models-adapter/)

2. **Set up Python environment**
   ```bash
   conda create -n adapter-training python=3.11
   conda activate adapter-training
   pip install -r requirements.txt
   ```

3. **Prepare your dataset** in JSONL format:
   ```jsonl
   [{"role": "user", "content": "PROMPT"}, {"role": "assistant", "content": "RESPONSE"}]
   ```

4. **Train the adapter**
   ```bash
   python -m examples.train_adapter \
     --train-data /path/to/train.jsonl \
     --eval-data /path/to/valid.jsonl \
     --epochs 5 \
     --learning-rate 1e-3 \
     --batch-size 4 \
     --checkpoint-dir /path/to/checkpoints/
   ```

5. **Optionally train draft model** for faster inference (speculative decoding)

6. **Export to `.fmadapter`**
   ```bash
   python -m export.export_fmadapter \
     --adapter-name my_adapter \
     --checkpoint /path/to/checkpoints/adapter-final.pt \
     --output-dir /path/to/exports/
   ```

7. **Load in your app** using this package (see below)

### Important Considerations

- **OS Version Compatibility**: Each adapter works with a *single specific* system model version. You must train separate adapters for each OS version you support.
- **Distribution**: Adapters (~160MB each) should be hosted on a server and downloaded via Background Assets, not bundled in your app.
- **Entitlement**: Request the [Foundation Models Framework Adapter Entitlement](https://developer.apple.com/contact/request/foundation-models-framework-adapter-entitlement) before App Store submission.

For complete training documentation, see [Apple's Adapter Training Guide](https://developer.apple.com/apple-intelligence/foundation-models-adapter/).

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

> **iOS 27+ note:** Apple obsoleted `SystemLanguageModel(adapter:)` in the iOS 27 SDK
> with no replacement. On iOS 27+ a session created with `adapterId` falls back to the
> default system model; on iOS ≤26 adapter sessions behave as before. See
> [KNOWN_ISSUES.md](../KNOWN_ISSUES.md) Issue #4.

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
