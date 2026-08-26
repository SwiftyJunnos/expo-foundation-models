# Session Management

Manage conversation history, optimize performance, and resume sessions.

## Transcript Access

Get the complete conversation history from a session.

### Getting the Transcript

```typescript
import { FoundationModels, type TranscriptEntry } from 'expo-foundation-models';

const transcript = await FoundationModels.getTranscript(sessionId);

for (const entry of transcript) {
  switch (entry.type) {
    case 'instructions':
      console.log('System:', entry.content);
      break;
    case 'prompt':
      console.log('User:', entry.content);
      break;
    case 'response':
      console.log('Assistant:', entry.content);
      break;
    case 'toolCall':
      console.log(`Tool Call: ${entry.name}(${JSON.stringify(entry.arguments)})`);
      break;
    case 'toolOutput':
      console.log('Tool Output:', entry.content);
      break;
  }
}
```

### Transcript Entry Types

| Type | Description | Properties |
|------|-------------|------------|
| `instructions` | System instructions | `content` |
| `prompt` | User message | `content` |
| `response` | Model response | `content` |
| `toolCall` | Tool invocation | `name`, `arguments`, `callId` |
| `toolOutput` | Tool result | `content`, `callId` |

### Use Cases

- **Display conversation** - Show chat history in UI
- **Debug** - Inspect what the model saw
- **Export** - Save conversations for later
- **Analytics** - Track conversation patterns

## Prewarm

Reduce response latency by preloading resources.

### Basic Prewarm

```typescript
// Prewarm with no options
await FoundationModels.prewarm(sessionId);
```

### Prewarm with Prompt Prefix

Cache a common prompt prefix for faster subsequent requests:

```typescript
await FoundationModels.prewarm(sessionId, {
  promptPrefix: 'You are helping a user with their code. The user says:',
});
```

### When to Prewarm

- **Before user input** - While waiting for user to type
- **On session create** - If you know the context
- **Between messages** - During idle time

### Example: Prewarm on Screen Focus

```typescript
import { useFocusEffect } from '@react-navigation/native';

function ChatScreen() {
  const [sessionId, setSessionId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (sessionId) {
        // Prewarm when screen becomes active
        FoundationModels.prewarm(sessionId, {
          promptPrefix: 'The user is asking about:',
        });
      }
    }, [sessionId])
  );

  // ...
}
```

## Context Options

Control how much context and effort the model applies to a request.

- **Availability:** iOS 27.0+. Passing `contextOptions` on iOS 26 or earlier rejects
  with error code `featureUnavailable`. Check `features.features.contextOptions`
  from `getFeatures()` first.

```typescript
const features = await FoundationModels.getFeatures();

const options = features.features.contextOptions
  ? {
      contextOptions: {
        reasoningLevel: 'deep',          // 'light' | 'moderate' | 'deep'
        includeSchemaInPrompt: false,
      },
    }
  : {};

const response = await FoundationModels.respond(
  sessionId,
  'Analyze this architecture trade-off...',
  options
);
```

### Reasoning Levels

| Level | Behavior | Use Case |
|-------|----------|----------|
| `light` | Fastest, minimal deliberation | Simple lookups, formatting |
| `moderate` | Balanced (default behavior) | General tasks |
| `deep` | Maximum deliberation | Complex reasoning, analysis |

`includeSchemaInPrompt: false` keeps structured-output schemas out of the prompt text
(relevant when combining `contextOptions` with schema-based requests).

## Resume Sessions

Create a new session with existing conversation history.

### Basic Resume

```typescript
const newSessionId = await FoundationModels.createSessionWithTranscript(
  [
    { type: 'prompt', content: 'What is React?' },
    { type: 'response', content: 'React is a JavaScript library for building user interfaces.' },
    { type: 'prompt', content: 'How do I create a component?' },
    { type: 'response', content: 'You can create a component using a function...' },
  ],
  'You are a programming tutor.'
);

// Continue the conversation
const response = await FoundationModels.respond(
  newSessionId,
  'Show me an example.'
);
// The model has context from previous messages
```

### Saving and Restoring

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

// Save transcript
async function saveConversation(sessionId: string, key: string) {
  const transcript = await FoundationModels.getTranscript(sessionId);
  await AsyncStorage.setItem(key, JSON.stringify(transcript));
}

// Restore conversation
async function restoreConversation(key: string, instructions: string) {
  const data = await AsyncStorage.getItem(key);
  if (!data) return null;
  
  const transcript = JSON.parse(data) as TranscriptEntry[];
  return FoundationModels.createSessionWithTranscript(transcript, instructions);
}
```

### Partial Resume

Resume with only recent messages:

```typescript
const fullTranscript = await FoundationModels.getTranscript(oldSessionId);

// Keep only last 10 exchanges
const recentEntries = fullTranscript.slice(-20);

const newSessionId = await FoundationModels.createSessionWithTranscript(
  recentEntries,
  instructions
);
```

## Session Lifecycle

### Managing Multiple Sessions

```typescript
class SessionManager {
  private sessions: Map<string, string> = new Map();
  
  async createSession(userId: string, instructions: string): Promise<string> {
    // Close existing session if any
    const existing = this.sessions.get(userId);
    if (existing) {
      await FoundationModels.closeSession(existing);
    }
    
    const sessionId = await FoundationModels.createSession(instructions);
    this.sessions.set(userId, sessionId);
    return sessionId;
  }
  
  async getSession(userId: string): Promise<string | null> {
    return this.sessions.get(userId) || null;
  }
  
  async closeSession(userId: string): Promise<void> {
    const sessionId = this.sessions.get(userId);
    if (sessionId) {
      await FoundationModels.closeSession(sessionId);
      this.sessions.delete(userId);
    }
  }
  
  async closeAll(): Promise<void> {
    for (const sessionId of this.sessions.values()) {
      await FoundationModels.closeSession(sessionId);
    }
    this.sessions.clear();
  }
}
```

### Cleanup on Unmount

```typescript
import { useEffect, useState, useRef } from 'react';

function ChatComponent() {
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Create session on mount
    FoundationModels.createSession('You are helpful.')
      .then((id) => {
        sessionIdRef.current = id;
      });

    // Cleanup on unmount
    return () => {
      if (sessionIdRef.current) {
        FoundationModels.closeSession(sessionIdRef.current);
      }
    };
  }, []);

  // ...
}
```

## Complete Example: Persistent Chat

```typescript
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FoundationModels, type TranscriptEntry } from 'expo-foundation-models';

const STORAGE_KEY = 'chat_history';
const INSTRUCTIONS = 'You are a helpful assistant.';

function usePersistentChat() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TranscriptEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved conversation on mount
  useEffect(() => {
    async function init() {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        
        if (saved) {
          const transcript = JSON.parse(saved) as TranscriptEntry[];
          const id = await FoundationModels.createSessionWithTranscript(
            transcript,
            INSTRUCTIONS
          );
          setSessionId(id);
          setMessages(transcript);
        } else {
          const id = await FoundationModels.createSession(INSTRUCTIONS);
          setSessionId(id);
        }
      } catch (error) {
        console.error('Failed to init chat:', error);
        const id = await FoundationModels.createSession(INSTRUCTIONS);
        setSessionId(id);
      } finally {
        setIsLoading(false);
      }
    }
    
    init();
    
    return () => {
      if (sessionId) {
        FoundationModels.closeSession(sessionId);
      }
    };
  }, []);

  // Save after each message
  const saveTranscript = useCallback(async () => {
    if (!sessionId) return;
    const transcript = await FoundationModels.getTranscript(sessionId);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(transcript));
    setMessages(transcript);
  }, [sessionId]);

  const sendMessage = useCallback(async (content: string) => {
    if (!sessionId) return;
    
    await FoundationModels.respond(sessionId, content);
    await saveTranscript();
  }, [sessionId, saveTranscript]);

  const clearHistory = useCallback(async () => {
    if (sessionId) {
      await FoundationModels.closeSession(sessionId);
    }
    await AsyncStorage.removeItem(STORAGE_KEY);
    const newId = await FoundationModels.createSession(INSTRUCTIONS);
    setSessionId(newId);
    setMessages([]);
  }, [sessionId]);

  return {
    messages,
    isLoading,
    sendMessage,
    clearHistory,
  };
}
```

## Best Practices

1. **Always close sessions** - Prevent memory leaks
2. **Prewarm during idle time** - Improve perceived performance
3. **Limit transcript size** - Don't store infinite history
4. **Handle session errors** - Sessions may expire or fail
5. **Save important conversations** - Persist to storage if needed

## Next Steps

- [Adapters](./adapters.md) - Use fine-tuned models
- [Feedback](./feedback.md) - Log response quality
