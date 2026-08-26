# Tool Calling

Let the model call functions you define to extend its capabilities.

> **How Tool Calling Works**
>
> Tool calling uses a **JavaScript-driven prompt flow on every supported OS version**
> (iOS 26.x and iOS 27.0+ alike), because Apple's native Tool API requires compile-time
> `@Generable` argument types that cannot be created from JavaScript:
> 1. Tool definitions are included in the prompt sent to the model
> 2. The model responds with a JSON tool call when it needs a tool
>    (`respondWithTools` resolves to `{ type: 'toolCall', toolCall }`)
> 3. Your JavaScript code executes the tool handler
> 4. `submitToolResult` continues the conversation with the tool result
>
> Native code never fabricates or short-circuits a tool result — generation continues
> only through `submitToolResult`.
>
> **Limitations (all OS versions):** token usage is slightly higher because tool
> definitions are part of the prompt. Model-emitted tool calls are validated
> natively before they reach JavaScript (registered tool name, JSON-object
> arguments — see [Tool Call Payload Validation](#tool-call-payload-validation)),
> but argument *values* are still model-generated: validate them against your own
> schemas before executing your tools.
>
> The flow is identical on iOS 26 and iOS 27; only the `toolCallingMode` option below is
> iOS 27-only.

## Overview

Tool calling enables the model to:
- Access real-time data (weather, stocks, etc.)
- Perform calculations
- Query databases
- Call APIs
- Execute any custom logic

The flow is:
1. Define tools with their parameters
2. Send a prompt
3. Model returns either text or a tool call request
4. Execute the tool and submit the result
5. Model continues with the tool result

## Defining Tools

### Basic Tool

```typescript
import { FoundationModels, type Tool } from 'expo-foundation-models';

const weatherTool: Tool = {
  name: 'getWeather',
  description: 'Get the current weather for a city',
  parameters: {
    type: 'object',
    properties: {
      city: { 
        type: 'string', 
        description: 'City name (e.g., "Tokyo", "New York")' 
      },
      unit: { 
        type: 'string', 
        enum: ['celsius', 'fahrenheit'],
        description: 'Temperature unit'
      },
    },
    required: ['city'],
  },
};
```

### Multiple Tools

```typescript
const tools: Tool[] = [
  {
    name: 'getWeather',
    description: 'Get current weather for a location',
    parameters: {
      type: 'object',
      properties: {
        city: { type: 'string' },
      },
      required: ['city'],
    },
  },
  {
    name: 'calculate',
    description: 'Perform a mathematical calculation',
    parameters: {
      type: 'object',
      properties: {
        expression: { 
          type: 'string', 
          description: 'Math expression (e.g., "2 + 2 * 3")' 
        },
      },
      required: ['expression'],
    },
  },
  {
    name: 'searchWeb',
    description: 'Search the web for information',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        maxResults: { type: 'integer' },
      },
      required: ['query'],
    },
  },
];
```

## Creating a Tool Session

```typescript
const sessionId = await FoundationModels.createSessionWithTools({
  instructions: 'You are a helpful assistant with access to tools.',
  tools: tools,
});
```

Or use the general `createSession` with tools:

```typescript
const sessionId = await FoundationModels.createSession({
  instructions: 'You are a helpful assistant.',
  tools: tools,
  guardrails: 'default',
});
```

## Handling Tool Calls

### Basic Flow

```typescript
// Send prompt
const response = await FoundationModels.respondWithTools(
  sessionId,
  "What's the weather in Tokyo?"
);

// Check response type
if (response.type === 'toolCall') {
  const { name, arguments: args, id } = response.toolCall!;
  
  console.log(`Tool: ${name}`);
  console.log(`Arguments: ${JSON.stringify(args)}`);
  
  // Execute your tool
  const result = await executeMyTool(name, args);
  
  // Submit result back
  const finalResponse = await FoundationModels.submitToolResult(sessionId, {
    callId: id,
    result: result,
  });
  
  console.log(finalResponse.content);
} else {
  // Regular text response
  console.log(response.content);
}
```

### Tool Execution Example

```typescript
async function executeMyTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case 'getWeather':
      // Call weather API
      const city = args.city as string;
      const weather = await fetchWeatherAPI(city);
      return {
        temperature: weather.temp,
        condition: weather.condition,
        humidity: weather.humidity,
      };
      
    case 'calculate':
      // Evaluate expression (use a safe math library!)
      const expr = args.expression as string;
      const result = evaluateMath(expr);
      return { result };
      
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
```

## Handling Errors

Submit errors back to the model:

```typescript
try {
  const result = await executeMyTool(name, args);
  
  await FoundationModels.submitToolResult(sessionId, {
    callId: id,
    result: result,
  });
} catch (error) {
  // Tell the model the tool failed
  await FoundationModels.submitToolResult(sessionId, {
    callId: id,
    error: `Tool execution failed: ${error.message}`,
  });
}
```

## Chained Tool Calls

The model may call multiple tools in sequence:

```typescript
async function handleConversation(prompt: string) {
  let response = await FoundationModels.respondWithTools(sessionId, prompt);
  
  // Keep handling tool calls until we get text
  while (response.type === 'toolCall') {
    const { name, arguments: args, id } = response.toolCall!;
    
    try {
      const result = await executeMyTool(name, args);
      response = await FoundationModels.submitToolResult(sessionId, {
        callId: id,
        result,
      });
    } catch (error) {
      response = await FoundationModels.submitToolResult(sessionId, {
        callId: id,
        error: error.message,
      });
    }
  }
  
  return response.content;
}
```

## Streaming with Tools

Stream responses while supporting tool calls:

```typescript
const response = await FoundationModels.streamWithTools(
  sessionId,
  prompt,
  {
    onToken: (token) => {
      // Handle streaming tokens
      console.log(token);
    },
    onToolCall: (toolCall) => {
      // Handle tool call
      console.log('Tool called:', toolCall.name);
    },
  }
);

// Final response (may be text or tool call)
if (response.type === 'toolCall') {
  // Handle tool call
}
```

## Tool Calling Mode

Control whether the model may, must, or must not use tools for a request.

- **Availability:** iOS 27.0+. Passing `toolCallingMode` on iOS 26 or earlier rejects
  with error code `featureUnavailable`. Check `features.features.toolCallingMode`
  from `getFeatures()` first.

```typescript
const features = await FoundationModels.getFeatures();

if (!features.features.toolCallingMode) {
  // iOS 26: fall back to prompt phrasing ("Use the getWeather tool to...")
}

const response = await FoundationModels.respondWithTools(
  sessionId,
  "What's the weather in Tokyo?",
  { toolCallingMode: 'required' }
);
```

### Modes

Because tool calling is a prompt-driven flow on every OS version, `toolCallingMode`
shapes **what goes into the prompt** — it never registers an executable native tool:

| Mode | Behavior | Use Case |
|------|----------|----------|
| `'allowed'` (default) | Tool definitions and tool-call instructions are included, but the model may answer in plain text. `respondWithTools` resolves to `{ type: 'text' }` or `{ type: 'toolCall', toolCall }`. | General assistance |
| `'required'` | The prompt demands exactly one JSON tool call. If the model answers with plain text or unparsable output instead of a tool call, the request rejects with a normalized generation error — you never receive plain text from a `required` request. | Guaranteed data-backed answers |
| `'disallowed'` | Tool definitions and tool-call instructions are omitted entirely; the model generates a normal text response and can never emit a tool call. Saves prompt tokens for pure-text requests. | Pure text generation |

The same semantics apply to `respondWithTools` and `streamWithTools`. In all modes
your JavaScript code stays authoritative: execute tools yourself and continue via
`submitToolResult`; no executable `DynamicTool` is registered natively.

## Tool Call Payload Validation

`respondWithTools` and `streamWithTools` share the same native validation for
every model-emitted tool call. A tool call only ever reaches JavaScript if:

- `name` is a non-empty string that matches one of the tools registered for the
  session (`createSession({ tools })` / `createSessionWithTools`) — unknown
  names never surface as tool calls.
- `arguments` is a JSON object (a missing or empty object is valid; arrays,
  strings, and other JSON shapes are rejected).

Error behavior by `toolCallingMode`:

| Mode | Parsed but invalid tool call | No parsable tool call |
|------|------------------------------|------------------------|
| `'allowed'` (default) | Rejects with a normalized `generationFailed` error — the invalid call is never delivered to JavaScript. | Resolves to a plain `{ type: 'text' }` response. |
| `'required'` | Rejects with a normalized `generationFailed` error. | Rejects with a normalized generation error — you never receive plain text from a `required` request. |
| `'disallowed'` | Tool calls are never parsed or emitted; the request behaves as plain-text generation. | Same — plain-text generation only. |

This validation guarantees shape and registration, not meaningful values: keep
validating arguments against your own tool schemas before executing them
(see [Best Practices](#best-practices)).

## Complete Example

```typescript
import { FoundationModels, type Tool, type ToolCall } from 'expo-foundation-models';

// Define tools
const tools: Tool[] = [
  {
    name: 'getCurrentTime',
    description: 'Get the current time in a timezone',
    parameters: {
      type: 'object',
      properties: {
        timezone: { 
          type: 'string', 
          description: 'Timezone (e.g., "America/New_York")' 
        },
      },
      required: ['timezone'],
    },
  },
  {
    name: 'convertCurrency',
    description: 'Convert between currencies',
    parameters: {
      type: 'object',
      properties: {
        amount: { type: 'number' },
        from: { type: 'string', description: 'Source currency (e.g., "USD")' },
        to: { type: 'string', description: 'Target currency (e.g., "EUR")' },
      },
      required: ['amount', 'from', 'to'],
    },
  },
];

// Tool implementations
const toolHandlers: Record<string, (args: any) => Promise<any>> = {
  getCurrentTime: async ({ timezone }) => {
    const time = new Date().toLocaleString('en-US', { timeZone: timezone });
    return { time, timezone };
  },
  
  convertCurrency: async ({ amount, from, to }) => {
    // In real app, call exchange rate API
    const rates: Record<string, number> = { USD: 1, EUR: 0.85, JPY: 110 };
    const result = amount * (rates[to] / rates[from]);
    return { amount, from, to, result: result.toFixed(2) };
  },
};

// Main function
async function chat(userMessage: string): Promise<string> {
  const sessionId = await FoundationModels.createSessionWithTools({
    instructions: 'You are a helpful assistant.',
    tools,
  });
  
  try {
    let response = await FoundationModels.respondWithTools(sessionId, userMessage);
    
    while (response.type === 'toolCall' && response.toolCall) {
      const { name, arguments: args, id } = response.toolCall;
      
      console.log(`Executing ${name}(${JSON.stringify(args)})`);
      
      const handler = toolHandlers[name];
      if (!handler) {
        response = await FoundationModels.submitToolResult(sessionId, {
          callId: id,
          error: `Unknown tool: ${name}`,
        });
        continue;
      }
      
      try {
        const result = await handler(args);
        response = await FoundationModels.submitToolResult(sessionId, {
          callId: id,
          result,
        });
      } catch (error) {
        response = await FoundationModels.submitToolResult(sessionId, {
          callId: id,
          error: String(error),
        });
      }
    }
    
    return response.content || '';
  } finally {
    await FoundationModels.closeSession(sessionId);
  }
}

// Usage
const answer = await chat("What time is it in Tokyo, and how much is $100 in yen?");
console.log(answer);
```

## Best Practices

1. **Write clear descriptions** - Help the model understand when to use each tool
2. **Validate parameters** - Don't trust model-provided arguments blindly
3. **Handle errors gracefully** - Always return something to the model
4. **Keep tools focused** - One tool per task, not Swiss Army knives
5. **Use required fields** - Mark essential parameters as required

## Next Steps

- [Session Management](./session-management.md) - Manage conversation context
- [Adapters](./adapters.md) - Use fine-tuned models
