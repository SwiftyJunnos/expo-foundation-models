import { Platform } from 'react-native';
import { FoundationModels, FoundationModelsError } from '../index';
import type { JSONSchema, GenerationOptions } from '../ExpoFoundationModels.types';
import ExpoFoundationModelsModule from '../ExpoFoundationModelsModule';

// Get the mocked module
const mockModule = ExpoFoundationModelsModule as jest.Mocked<typeof ExpoFoundationModelsModule>;

describe('FoundationModels - Structured Output', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = 'ios';
  });

  describe('respondWithSchema', () => {
    const personSchema: JSONSchema = {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'The person\'s full name' },
        age: { type: 'integer', description: 'Age in years' },
        email: { type: 'string', description: 'Email address' },
      },
      required: ['name', 'age'],
    };

    it('should generate structured output matching schema', async () => {
      const mockResponse = { name: 'John Doe', age: 30, email: 'john@example.com' };
      mockModule.respondWithSchema.mockResolvedValue(mockResponse);

      const result = await FoundationModels.respondWithSchema(
        'session-123',
        'Generate a person profile',
        personSchema
      );

      expect(mockModule.respondWithSchema).toHaveBeenCalledWith(
        'session-123',
        'Generate a person profile',
        personSchema,
        null
      );
      expect(result).toEqual(mockResponse);
    });

    it('should pass generation options to native module', async () => {
      const mockResponse = { name: 'Jane', age: 25 };
      mockModule.respondWithSchema.mockResolvedValue(mockResponse);

      const options: GenerationOptions = {
        temperature: 0.5,
        maximumResponseTokens: 200,
      };

      await FoundationModels.respondWithSchema(
        'session-123',
        'Generate a person',
        personSchema,
        options
      );

      expect(mockModule.respondWithSchema).toHaveBeenCalledWith(
        'session-123',
        'Generate a person',
        personSchema,
        options
      );
    });

    it('should handle nested object schemas', async () => {
      const addressSchema: JSONSchema = {
        type: 'object',
        properties: {
          person: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              address: {
                type: 'object',
                properties: {
                  street: { type: 'string' },
                  city: { type: 'string' },
                  zipCode: { type: 'string' },
                },
                required: ['street', 'city'],
              },
            },
            required: ['name', 'address'],
          },
        },
        required: ['person'],
      };

      const mockResponse = {
        person: {
          name: 'Alice',
          address: {
            street: '123 Main St',
            city: 'New York',
            zipCode: '10001',
          },
        },
      };
      mockModule.respondWithSchema.mockResolvedValue(mockResponse);

      const result = await FoundationModels.respondWithSchema(
        'session-123',
        'Generate a person with address',
        addressSchema
      );

      expect(result).toEqual(mockResponse);
    });

    it('should handle array schemas', async () => {
      const arraySchema: JSONSchema = {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of items',
          },
          count: { type: 'integer' },
        },
        required: ['items'],
      };

      const mockResponse = { items: ['apple', 'banana', 'cherry'], count: 3 };
      mockModule.respondWithSchema.mockResolvedValue(mockResponse);

      const result = await FoundationModels.respondWithSchema(
        'session-123',
        'Generate a list of fruits',
        arraySchema
      );

      expect(result).toEqual(mockResponse);
    });

    it('should handle enum constraints in schema', async () => {
      const enumSchema: JSONSchema = {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['pending', 'approved', 'rejected'],
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
          },
        },
        required: ['status'],
      };

      const mockResponse = { status: 'approved', priority: 'high' };
      mockModule.respondWithSchema.mockResolvedValue(mockResponse);

      const result = await FoundationModels.respondWithSchema(
        'session-123',
        'Classify this request',
        enumSchema
      );

      expect(result.status).toBe('approved');
    });

    it('should throw FoundationModelsError when session ID is empty', async () => {
      await expect(
        FoundationModels.respondWithSchema('', 'prompt', personSchema)
      ).rejects.toThrow(FoundationModelsError);

      const error = await FoundationModels.respondWithSchema('', 'prompt', personSchema).catch((e) => e);
      expect(error.type).toBe('sessionNotFound');
    });

    it('should throw FoundationModelsError when prompt is empty', async () => {
      await expect(
        FoundationModels.respondWithSchema('session-123', '', personSchema)
      ).rejects.toThrow(FoundationModelsError);

      const error = await FoundationModels.respondWithSchema('session-123', '', personSchema).catch((e) => e);
      expect(error.type).toBe('generationFailed');
    });

    it('should throw FoundationModelsError when schema is invalid', async () => {
      const invalidSchema = null as any;

      await expect(
        FoundationModels.respondWithSchema('session-123', 'prompt', invalidSchema)
      ).rejects.toThrow(FoundationModelsError);
    });

    it('should throw FoundationModelsError on non-iOS platform', async () => {
      (Platform as any).OS = 'android';

      await expect(
        FoundationModels.respondWithSchema('session-123', 'prompt', personSchema)
      ).rejects.toThrow(FoundationModelsError);

      const error = await FoundationModels.respondWithSchema('session-123', 'prompt', personSchema).catch((e) => e);
      expect(error.type).toBe('notAvailable');
    });

    it('should handle guardrail violation errors', async () => {
      mockModule.respondWithSchema.mockRejectedValue(new Error('Content blocked by safety guardrails'));

      const error = await FoundationModels.respondWithSchema(
        'session-123',
        'Generate harmful content',
        personSchema
      ).catch((e) => e);

      expect(error).toBeInstanceOf(FoundationModelsError);
      expect(error.type).toBe('guardrailViolation');
    });

    it('should handle refusal errors', async () => {
      mockModule.respondWithSchema.mockRejectedValue(new Error('Model refused to generate'));

      const error = await FoundationModels.respondWithSchema(
        'session-123',
        'Generate something inappropriate',
        personSchema
      ).catch((e) => e);

      expect(error).toBeInstanceOf(FoundationModelsError);
      expect(error.type).toBe('refusal');
    });
  });

  describe('respondWithChoices', () => {
    it('should return one of the provided choices', async () => {
      const choices = ['positive', 'negative', 'neutral'];
      mockModule.respondWithChoices.mockResolvedValue('positive');

      const result = await FoundationModels.respondWithChoices(
        'session-123',
        'What is the sentiment of: "I love this product!"',
        choices
      );

      expect(mockModule.respondWithChoices).toHaveBeenCalledWith(
        'session-123',
        'What is the sentiment of: "I love this product!"',
        choices,
        null
      );
      expect(result).toBe('positive');
      expect(choices).toContain(result);
    });

    it('should pass generation options to native module', async () => {
      const choices = ['yes', 'no', 'maybe'];
      mockModule.respondWithChoices.mockResolvedValue('yes');

      const options: GenerationOptions = {
        temperature: 0,
        sampling: { type: 'greedy' },
      };

      await FoundationModels.respondWithChoices(
        'session-123',
        'Is this correct?',
        choices,
        options
      );

      expect(mockModule.respondWithChoices).toHaveBeenCalledWith(
        'session-123',
        'Is this correct?',
        choices,
        options
      );
    });

    it('should handle numeric choices', async () => {
      const choices = ['1', '2', '3', '4', '5'];
      mockModule.respondWithChoices.mockResolvedValue('4');

      const result = await FoundationModels.respondWithChoices(
        'session-123',
        'Rate this from 1 to 5',
        choices
      );

      expect(result).toBe('4');
    });

    it('should throw FoundationModelsError when session ID is empty', async () => {
      await expect(
        FoundationModels.respondWithChoices('', 'prompt', ['a', 'b'])
      ).rejects.toThrow(FoundationModelsError);

      const error = await FoundationModels.respondWithChoices('', 'prompt', ['a', 'b']).catch((e) => e);
      expect(error.type).toBe('sessionNotFound');
    });

    it('should throw FoundationModelsError when prompt is empty', async () => {
      await expect(
        FoundationModels.respondWithChoices('session-123', '', ['a', 'b'])
      ).rejects.toThrow(FoundationModelsError);

      const error = await FoundationModels.respondWithChoices('session-123', '', ['a', 'b']).catch((e) => e);
      expect(error.type).toBe('generationFailed');
    });

    it('should throw FoundationModelsError when choices array is empty', async () => {
      await expect(
        FoundationModels.respondWithChoices('session-123', 'prompt', [])
      ).rejects.toThrow(FoundationModelsError);
    });

    it('should throw FoundationModelsError when choices is not an array', async () => {
      await expect(
        FoundationModels.respondWithChoices('session-123', 'prompt', null as any)
      ).rejects.toThrow(FoundationModelsError);
    });

    it('should throw FoundationModelsError on non-iOS platform', async () => {
      (Platform as any).OS = 'android';

      await expect(
        FoundationModels.respondWithChoices('session-123', 'prompt', ['a', 'b'])
      ).rejects.toThrow(FoundationModelsError);

      const error = await FoundationModels.respondWithChoices('session-123', 'prompt', ['a', 'b']).catch((e) => e);
      expect(error.type).toBe('notAvailable');
    });

    it('should handle guardrail violation errors', async () => {
      mockModule.respondWithChoices.mockRejectedValue(new Error('Content blocked by safety guardrails'));

      const error = await FoundationModels.respondWithChoices(
        'session-123',
        'Harmful prompt',
        ['a', 'b']
      ).catch((e) => e);

      expect(error).toBeInstanceOf(FoundationModelsError);
      expect(error.type).toBe('guardrailViolation');
    });
  });

  describe('streamWithSchema', () => {
    const simpleSchema: JSONSchema = {
      type: 'object',
      properties: {
        title: { type: 'string' },
        content: { type: 'string' },
      },
      required: ['title', 'content'],
    };

    it('should stream structured output and call onPartial for partial results', async () => {
      const mockFinalResponse = { title: 'Hello', content: 'World' };
      mockModule.streamWithSchema.mockResolvedValue(mockFinalResponse);

      const onPartial = jest.fn();
      const result = await FoundationModels.streamWithSchema(
        'session-123',
        'Generate a post',
        simpleSchema,
        onPartial
      );

      expect(mockModule.streamWithSchema).toHaveBeenCalledWith(
        'session-123',
        'Generate a post',
        simpleSchema,
        null
      );
      expect(mockModule.addListener).toHaveBeenCalledWith('onPartialSchema', expect.any(Function));
      expect(result).toEqual(mockFinalResponse);
    });

    it('should remove listener after completion', async () => {
      const mockRemove = jest.fn();
      mockModule.addListener.mockReturnValue({ remove: mockRemove });
      mockModule.streamWithSchema.mockResolvedValue({ title: 'Test', content: 'Content' });

      await FoundationModels.streamWithSchema(
        'session-123',
        'Generate',
        simpleSchema,
        jest.fn()
      );

      expect(mockRemove).toHaveBeenCalled();
    });

    it('should remove listener even on error', async () => {
      const mockRemove = jest.fn();
      mockModule.addListener.mockReturnValue({ remove: mockRemove });
      mockModule.streamWithSchema.mockRejectedValue(new Error('Stream failed'));

      await expect(
        FoundationModels.streamWithSchema('session-123', 'Generate', simpleSchema, jest.fn())
      ).rejects.toThrow();

      expect(mockRemove).toHaveBeenCalled();
    });

    it('should throw FoundationModelsError when session ID is empty', async () => {
      await expect(
        FoundationModels.streamWithSchema('', 'prompt', simpleSchema, jest.fn())
      ).rejects.toThrow(FoundationModelsError);
    });

    it('should throw FoundationModelsError on non-iOS platform', async () => {
      (Platform as any).OS = 'android';

      await expect(
        FoundationModels.streamWithSchema('session-123', 'prompt', simpleSchema, jest.fn())
      ).rejects.toThrow(FoundationModelsError);
    });
  });
});

describe('JSONSchema Type', () => {
  it('should support basic types', () => {
    const stringSchema: JSONSchema = { type: 'string' };
    const numberSchema: JSONSchema = { type: 'number' };
    const integerSchema: JSONSchema = { type: 'integer' };
    const booleanSchema: JSONSchema = { type: 'boolean' };

    expect(stringSchema.type).toBe('string');
    expect(numberSchema.type).toBe('number');
    expect(integerSchema.type).toBe('integer');
    expect(booleanSchema.type).toBe('boolean');
  });

  it('should support object type with properties', () => {
    const schema: JSONSchema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'integer' },
      },
      required: ['name'],
    };

    expect(schema.type).toBe('object');
    expect(schema.properties?.name.type).toBe('string');
    expect(schema.required).toContain('name');
  });

  it('should support array type with items', () => {
    const schema: JSONSchema = {
      type: 'array',
      items: { type: 'string' },
    };

    expect(schema.type).toBe('array');
    expect(schema.items?.type).toBe('string');
  });

  it('should support enum constraint', () => {
    const schema: JSONSchema = {
      type: 'string',
      enum: ['red', 'green', 'blue'],
    };

    expect(schema.enum).toEqual(['red', 'green', 'blue']);
  });

  it('should support description', () => {
    const schema: JSONSchema = {
      type: 'string',
      description: 'A user-friendly description',
    };

    expect(schema.description).toBe('A user-friendly description');
  });
});
