# Structured Output

Generate JSON conforming to schemas or constrain output to specific choices.

> **iOS Version Behavior**
>
> - **iOS 27.0+** — Native path. The JSON Schema you pass is converted natively
>   (`DynamicGenerationSchema` → `GenerationSchema`), so output is enforced by the
>   framework instead of relying on prompt instructions. Same wire format
>   (JSON Schema in, JSON object out) — no code changes needed.
> - **iOS 26.x** — Prompt-based fallback. `DynamicGenerationSchema` does not support
>   runtime schema construction there, so:
>   1. The JSON schema is serialized and included in the prompt
>   2. The model is instructed to output valid JSON matching the schema
>   3. The response is parsed and validated
>
> **On iOS 26 the following limitations remain:** results may vary (the model might not
> always produce valid JSON), no native schema enforcement, slightly higher token usage,
> and partial JSON parsing during streaming may fail.
>
> **Non-object root schemas** are supported on both paths: a schema whose root is an
> array, string, number, boolean, or null returns the generated value directly — native
> conversion (`anyFromGeneratedContent`) on iOS 27+, JSON parsing of the response text on
> the iOS 26 fallback. There is no object-wrapping and no post-generation failure for
> non-object roots.
>
> **Image attachments** in a structured-output prompt are always forwarded to the model
> through a native `Prompt` with attachments — including on the fallback path. On iOS 26
> or earlier, image attachments reject explicitly with error code `featureUnavailable`;
> images are never silently dropped.
>
> The library selects the path automatically at runtime — check
> `(await FoundationModels.getFeatures()).osVersion` if you need to know which one applies.

## JSON Schema Generation

Generate structured data matching a JSON Schema.

### Basic Example

```typescript
import { FoundationModels } from 'expo-foundation-models';

const person = await FoundationModels.respondWithSchema(
  sessionId,
  'Generate a person profile for a software developer.',
  {
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'integer' },
      occupation: { type: 'string' },
    },
    required: ['name', 'age'],
  }
);

console.log(person);
// { name: "Alex Chen", age: 28, occupation: "Software Developer" }
```

### Complex Schema

```typescript
const character = await FoundationModels.respondWithSchema(
  sessionId,
  'Generate an RPG character.',
  {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Character name' },
      class: { 
        type: 'string', 
        enum: ['Warrior', 'Mage', 'Rogue', 'Cleric'] 
      },
      level: { 
        type: 'integer', 
        minimum: 1, 
        maximum: 100 
      },
      stats: {
        type: 'object',
        properties: {
          strength: { type: 'integer' },
          intelligence: { type: 'integer' },
          dexterity: { type: 'integer' },
        },
        required: ['strength', 'intelligence', 'dexterity'],
      },
      skills: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        maxItems: 5,
      },
      backstory: { 
        type: 'string', 
        description: 'Brief character backstory' 
      },
    },
    required: ['name', 'class', 'level', 'stats'],
  }
);
```

### Nested Objects

```typescript
const recipe = await FoundationModels.respondWithSchema(
  sessionId,
  'Create a recipe for chocolate chip cookies.',
  {
    type: 'object',
    properties: {
      name: { type: 'string' },
      prepTime: { type: 'string' },
      cookTime: { type: 'string' },
      servings: { type: 'integer' },
      ingredients: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            amount: { type: 'string' },
          },
          required: ['name', 'amount'],
        },
      },
      steps: {
        type: 'array',
        items: { type: 'string' },
      },
    },
    required: ['name', 'ingredients', 'steps'],
  }
);
```

## Schema Types

### Supported Types

| Type | Description | Example |
|------|-------------|---------|
| `string` | Text value | `"hello"` |
| `integer` | Whole number | `42` |
| `number` | Decimal number | `3.14` |
| `boolean` | True/false | `true` |
| `object` | Nested object | `{ "key": "value" }` |
| `array` | List of items | `[1, 2, 3]` |

### Schema Properties

```typescript
{
  type: 'object',
  properties: {
    // String with constraints
    name: {
      type: 'string',
      description: 'The person\'s full name',
      minLength: 1,
      maxLength: 100,
    },
    
    // Integer with range
    age: {
      type: 'integer',
      minimum: 0,
      maximum: 150,
    },
    
    // Enum constraint
    status: {
      type: 'string',
      enum: ['active', 'inactive', 'pending'],
    },
    
    // Array with constraints
    tags: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
      maxItems: 10,
    },
  },
  required: ['name', 'age'],
}
```

## Choice Constraints

Constrain output to one of specific choices.

### Basic Choices

```typescript
const sentiment = await FoundationModels.respondWithChoices(
  sessionId,
  'Classify the sentiment of: "I absolutely love this product!"',
  ['positive', 'negative', 'neutral']
);

console.log(sentiment); // "positive"
```

### Classification Example

```typescript
const category = await FoundationModels.respondWithChoices(
  sessionId,
  'Categorize this support ticket: "My order hasn\'t arrived yet"',
  ['billing', 'shipping', 'technical', 'general']
);

console.log(category); // "shipping"
```

### Yes/No Questions

```typescript
const answer = await FoundationModels.respondWithChoices(
  sessionId,
  'Is Python a compiled language?',
  ['yes', 'no']
);

console.log(answer); // "no"
```

## Streaming Structured Output

Stream structured output with partial updates.

```typescript
const result = await FoundationModels.streamWithSchema(
  sessionId,
  'Generate a detailed product review.',
  {
    type: 'object',
    properties: {
      title: { type: 'string' },
      rating: { type: 'integer' },
      pros: { type: 'array', items: { type: 'string' } },
      cons: { type: 'array', items: { type: 'string' } },
      summary: { type: 'string' },
    },
    required: ['title', 'rating', 'summary'],
  },
  (partial) => {
    console.log('Partial result:', partial);
    // { title: "Great Product" }
    // { title: "Great Product", rating: 5 }
    // { title: "Great Product", rating: 5, pros: ["Easy to use"] }
    // ...
  }
);

console.log('Final:', result);
```

## TypeScript Integration

Use generics for type-safe results.

```typescript
interface Person {
  name: string;
  age: number;
  email?: string;
}

const person = await FoundationModels.respondWithSchema<Person>(
  sessionId,
  'Generate a person profile.',
  {
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'integer' },
      email: { type: 'string' },
    },
    required: ['name', 'age'],
  }
);

// TypeScript knows person.name is string
console.log(person.name.toUpperCase());
```

## Use Cases

### Data Extraction

```typescript
const extracted = await FoundationModels.respondWithSchema(
  sessionId,
  `Extract contact info from: "Call John at 555-1234 or email john@example.com"`,
  {
    type: 'object',
    properties: {
      name: { type: 'string' },
      phone: { type: 'string' },
      email: { type: 'string' },
    },
  }
);
// { name: "John", phone: "555-1234", email: "john@example.com" }
```

### Content Analysis

```typescript
const analysis = await FoundationModels.respondWithSchema(
  sessionId,
  `Analyze this article: "${articleText}"`,
  {
    type: 'object',
    properties: {
      topics: { type: 'array', items: { type: 'string' } },
      sentiment: { type: 'string', enum: ['positive', 'negative', 'neutral'] },
      readingLevel: { type: 'string' },
      wordCount: { type: 'integer' },
    },
  }
);
```

### Form Generation

```typescript
const formFields = await FoundationModels.respondWithSchema(
  sessionId,
  'Generate form fields for a job application.',
  {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        label: { type: 'string' },
        type: { type: 'string', enum: ['text', 'email', 'textarea', 'select'] },
        required: { type: 'boolean' },
        placeholder: { type: 'string' },
      },
      required: ['label', 'type'],
    },
  }
);
```

## Best Practices

1. **Use descriptions** - Help the model understand what you want
2. **Set required fields** - Ensure essential data is always present
3. **Use enums for fixed values** - Constrain categorical data
4. **Keep schemas focused** - Don't request too much at once
5. **Handle parsing errors** - Wrap in try/catch

```typescript
try {
  const result = await FoundationModels.respondWithSchema(
    sessionId,
    prompt,
    schema
  );
  // Use result
} catch (error) {
  if (error instanceof FoundationModelsError) {
    console.error('Generation failed:', error.message);
  }
}
```

## Next Steps

- [Tool Calling](./tool-calling.md) - Let the model call functions
- [Session Management](./session-management.md) - Manage conversation context
