import { Platform } from 'react-native';
import { FoundationModels, FoundationModelsError } from '../index';
import type { Tool, ToolCall, ToolResult, SessionOptions } from '../ExpoFoundationModels.types';
import ExpoFoundationModelsModule from '../ExpoFoundationModelsModule';

// Get the mocked module
const mockModule = ExpoFoundationModelsModule as jest.Mocked<typeof ExpoFoundationModelsModule>;

describe('FoundationModels - Tool Calling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = 'ios';
  });

  describe('Tool Definition', () => {
    it('should define a tool with name, description, and parameters', () => {
      const weatherTool: Tool = {
        name: 'getWeather',
        description: 'Get current weather for a city',
        parameters: {
          type: 'object',
          properties: {
            city: { type: 'string', description: 'City name' },
            unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
          },
          required: ['city'],
        },
      };

      expect(weatherTool.name).toBe('getWeather');
      expect(weatherTool.description).toBe('Get current weather for a city');
      expect(weatherTool.parameters?.properties?.city.type).toBe('string');
    });

    it('should define a tool without parameters', () => {
      const timeTool: Tool = {
        name: 'getCurrentTime',
        description: 'Get the current time',
      };

      expect(timeTool.name).toBe('getCurrentTime');
      expect(timeTool.parameters).toBeUndefined();
    });
  });

  describe('createSessionWithTools', () => {
    const weatherTool: Tool = {
      name: 'getWeather',
      description: 'Get weather for a city',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string' },
        },
        required: ['city'],
      },
    };

    it('should create session with tools', async () => {
      const mockSessionId = 'session-with-tools-123';
      mockModule.createSessionWithTools.mockResolvedValue(mockSessionId);

      const options: SessionOptions = {
        instructions: 'You are a helpful assistant',
        tools: [weatherTool],
      };

      const result = await FoundationModels.createSessionWithTools(options);

      expect(mockModule.createSessionWithTools).toHaveBeenCalledWith({
        instructions: 'You are a helpful assistant',
        tools: [weatherTool],
      });
      expect(result).toBe(mockSessionId);
    });

    it('should create session with multiple tools', async () => {
      const mockSessionId = 'session-multi-tools';
      mockModule.createSessionWithTools.mockResolvedValue(mockSessionId);

      const calculatorTool: Tool = {
        name: 'calculate',
        description: 'Perform calculations',
        parameters: {
          type: 'object',
          properties: {
            expression: { type: 'string' },
          },
          required: ['expression'],
        },
      };

      const options: SessionOptions = {
        tools: [weatherTool, calculatorTool],
      };

      const result = await FoundationModels.createSessionWithTools(options);

      expect(mockModule.createSessionWithTools).toHaveBeenCalledWith({
        tools: [weatherTool, calculatorTool],
      });
      expect(result).toBe(mockSessionId);
    });

    it('should throw error when tools array is empty', async () => {
      const options: SessionOptions = {
        tools: [],
      };

      await expect(FoundationModels.createSessionWithTools(options)).rejects.toThrow(
        FoundationModelsError
      );
    });

    it('should throw error on non-iOS platform', async () => {
      (Platform as any).OS = 'android';

      const options: SessionOptions = {
        tools: [weatherTool],
      };

      await expect(FoundationModels.createSessionWithTools(options)).rejects.toThrow(
        FoundationModelsError
      );

      const error = await FoundationModels.createSessionWithTools(options).catch((e) => e);
      expect(error.type).toBe('notAvailable');
    });
  });

  describe('respondWithTools', () => {
    it('should return text response when no tool is called', async () => {
      const mockResponse = {
        type: 'text' as const,
        content: 'Hello! How can I help you?',
      };
      mockModule.respondWithTools.mockResolvedValue(mockResponse);

      const result = await FoundationModels.respondWithTools('session-123', 'Hello!');

      expect(mockModule.respondWithTools).toHaveBeenCalledWith('session-123', 'Hello!', null);
      expect(result.type).toBe('text');
      expect(result.content).toBe('Hello! How can I help you?');
    });

    it('should return tool call when model wants to use a tool', async () => {
      const mockResponse = {
        type: 'toolCall' as const,
        toolCall: {
          id: 'call-123',
          name: 'getWeather',
          arguments: { city: 'Tokyo' },
        },
      };
      mockModule.respondWithTools.mockResolvedValue(mockResponse);

      const result = await FoundationModels.respondWithTools(
        'session-123',
        "What's the weather in Tokyo?"
      );

      expect(result.type).toBe('toolCall');
      expect(result.toolCall?.name).toBe('getWeather');
      expect(result.toolCall?.arguments).toEqual({ city: 'Tokyo' });
    });

    it('should handle multiple sequential tool calls', async () => {
      // First call returns tool call
      mockModule.respondWithTools.mockResolvedValueOnce({
        type: 'toolCall' as const,
        toolCall: {
          id: 'call-1',
          name: 'getWeather',
          arguments: { city: 'Tokyo' },
        },
      });

      const result1 = await FoundationModels.respondWithTools(
        'session-123',
        'Compare weather in Tokyo and New York'
      );
      expect(result1.type).toBe('toolCall');
      expect(result1.toolCall?.arguments.city).toBe('Tokyo');
    });

    it('should throw error when session ID is empty', async () => {
      await expect(FoundationModels.respondWithTools('', 'Hello')).rejects.toThrow(
        FoundationModelsError
      );

      const error = await FoundationModels.respondWithTools('', 'Hello').catch((e) => e);
      expect(error.type).toBe('sessionNotFound');
    });

    it('should throw error when prompt is empty', async () => {
      await expect(FoundationModels.respondWithTools('session-123', '')).rejects.toThrow(
        FoundationModelsError
      );
    });

    it('should forward toolCallingMode required unchanged to native', async () => {
      mockModule.respondWithTools.mockResolvedValue({
        type: 'toolCall' as const,
        toolCall: {
          id: 'call-1',
          name: 'getWeather',
          arguments: { city: 'Tokyo' },
        } as ToolCall,
      });

      await FoundationModels.respondWithTools('session-123', 'Weather in Tokyo?', {
        toolCallingMode: 'required',
      });

      expect(mockModule.respondWithTools).toHaveBeenCalledWith('session-123', 'Weather in Tokyo?', {
        toolCallingMode: 'required',
      });
    });

    it('should forward toolCallingMode disallowed unchanged to native', async () => {
      mockModule.respondWithTools.mockResolvedValue({ type: 'text' as const, content: 'Sure!' });

      await FoundationModels.respondWithTools('session-123', 'Tell me a joke', {
        toolCallingMode: 'disallowed',
      });

      expect(mockModule.respondWithTools).toHaveBeenCalledWith('session-123', 'Tell me a joke', {
        toolCallingMode: 'disallowed',
      });
    });

    it('should pass valid tool call payloads through unchanged', async () => {
      // Native validates the payload before it crosses the bridge (non-empty
      // name matching a registered session tool, JSON-object arguments); the
      // facade's contract is to hand the validated call through untouched.
      const mockResponse = {
        type: 'toolCall' as const,
        toolCall: {
          id: 'call-42',
          name: 'searchWeb',
          arguments: {
            query: 'expo foundation models',
            maxResults: 5,
            filters: { lang: 'en' },
          },
        },
      };
      mockModule.respondWithTools.mockResolvedValue(mockResponse);

      const result = await FoundationModels.respondWithTools(
        'session-123',
        'Search for expo foundation models'
      );

      expect(mockModule.respondWithTools).toHaveBeenCalledWith(
        'session-123',
        'Search for expo foundation models',
        null
      );
      expect(result.type).toBe('toolCall');
      expect(result.toolCall?.id).toBe('call-42');
      expect(result.toolCall?.name).toBe('searchWeb');
      expect(result.toolCall?.arguments).toEqual({
        query: 'expo foundation models',
        maxResults: 5,
        filters: { lang: 'en' },
      });
    });
  });

  describe('submitToolResult', () => {
    it('should submit tool result and get text response', async () => {
      const mockResponse = {
        type: 'text' as const,
        content: 'The weather in Tokyo is 25°C and sunny.',
      };
      mockModule.submitToolResult.mockResolvedValue(mockResponse);

      const toolResult: ToolResult = {
        callId: 'call-123',
        result: { temperature: 25, condition: 'sunny' },
      };

      const result = await FoundationModels.submitToolResult('session-123', toolResult);

      expect(mockModule.submitToolResult).toHaveBeenCalledWith('session-123', toolResult);
      expect(result.type).toBe('text');
      expect(result.content).toBe('The weather in Tokyo is 25°C and sunny.');
    });

    it('should submit tool result and get another tool call', async () => {
      const mockResponse = {
        type: 'toolCall' as const,
        toolCall: {
          id: 'call-456',
          name: 'getWeather',
          arguments: { city: 'New York' },
        },
      };
      mockModule.submitToolResult.mockResolvedValue(mockResponse);

      const toolResult: ToolResult = {
        callId: 'call-123',
        result: { temperature: 25, condition: 'sunny' },
      };

      const result = await FoundationModels.submitToolResult('session-123', toolResult);

      expect(result.type).toBe('toolCall');
      expect(result.toolCall?.name).toBe('getWeather');
    });

    it('should handle tool error result', async () => {
      const mockResponse = {
        type: 'text' as const,
        content: "I'm sorry, I couldn't get the weather information.",
      };
      mockModule.submitToolResult.mockResolvedValue(mockResponse);

      const toolResult: ToolResult = {
        callId: 'call-123',
        error: 'API rate limit exceeded',
      };

      const result = await FoundationModels.submitToolResult('session-123', toolResult);

      expect(mockModule.submitToolResult).toHaveBeenCalledWith('session-123', toolResult);
      expect(result.type).toBe('text');
    });

    it('should throw error when session ID is empty', async () => {
      const toolResult: ToolResult = {
        callId: 'call-123',
        result: { data: 'test' },
      };

      await expect(FoundationModels.submitToolResult('', toolResult)).rejects.toThrow(
        FoundationModelsError
      );
    });

    it('should throw error when callId is empty', async () => {
      const toolResult: ToolResult = {
        callId: '',
        result: { data: 'test' },
      };

      await expect(FoundationModels.submitToolResult('session-123', toolResult)).rejects.toThrow(
        FoundationModelsError
      );
    });

    it('should throw error on non-iOS platform', async () => {
      (Platform as any).OS = 'android';

      const toolResult: ToolResult = {
        callId: 'call-123',
        result: { data: 'test' },
      };

      await expect(FoundationModels.submitToolResult('session-123', toolResult)).rejects.toThrow(
        FoundationModelsError
      );
    });
  });

  describe('Tool Calling Flow Integration', () => {
    it('should complete a full tool calling flow', async () => {
      // Step 1: Create session with tools
      mockModule.createSessionWithTools.mockResolvedValue('session-tools');

      const weatherTool: Tool = {
        name: 'getWeather',
        description: 'Get weather',
        parameters: {
          type: 'object',
          properties: { city: { type: 'string' } },
          required: ['city'],
        },
      };

      const sessionId = await FoundationModels.createSessionWithTools({
        tools: [weatherTool],
      });
      expect(sessionId).toBe('session-tools');

      // Step 2: Send prompt, get tool call
      mockModule.respondWithTools.mockResolvedValue({
        type: 'toolCall',
        toolCall: {
          id: 'call-1',
          name: 'getWeather',
          arguments: { city: 'Paris' },
        },
      });

      const response1 = await FoundationModels.respondWithTools(
        sessionId,
        "What's the weather in Paris?"
      );
      expect(response1.type).toBe('toolCall');
      expect(response1.toolCall?.name).toBe('getWeather');

      // Step 3: Execute tool and submit result
      mockModule.submitToolResult.mockResolvedValue({
        type: 'text',
        content: 'The weather in Paris is 18°C with light rain.',
      });

      const response2 = await FoundationModels.submitToolResult(sessionId, {
        callId: response1.toolCall!.id,
        result: { temperature: 18, condition: 'light rain' },
      });
      expect(response2.type).toBe('text');
      expect(response2.content).toContain('Paris');
    });
  });

  describe('streamWithTools', () => {
    it('should stream response and handle tool calls', async () => {
      const mockFinalResponse = {
        type: 'text' as const,
        content: 'The weather is nice today.',
      };
      mockModule.streamWithTools.mockResolvedValue(mockFinalResponse);

      const onToken = jest.fn();
      const onToolCall = jest.fn();

      const result = await FoundationModels.streamWithTools(
        'session-123',
        "What's the weather?",
        { onToken, onToolCall }
      );

      expect(mockModule.streamWithTools).toHaveBeenCalledWith('session-123', "What's the weather?", null);
      expect(mockModule.addListener).toHaveBeenCalled();
      expect(result).toEqual(mockFinalResponse);
    });

    it('should deliver a valid native tool call event through the facade callback', async () => {
      const mockFinalResponse = { type: 'text' as const, content: 'Done' };
      mockModule.streamWithTools.mockResolvedValue(mockFinalResponse);

      const toolCall = { id: 'call-1', name: 'getWeather', arguments: { city: 'Seoul' } };
      const onToken = jest.fn();
      const onToolCall = jest.fn();

      const pending = FoundationModels.streamWithTools('session-123', "What's the weather?", {
        onToken,
        onToolCall,
      });

      // The facade registers listeners synchronously before awaiting the native call.
      const handler = mockModule.addListener.mock.calls.find((call) => call[0] === 'onToolCall')?.[1] as
        | ((event: { sessionId: string; toolCall: typeof toolCall }) => void)
        | undefined;
      expect(handler).toBeDefined();

      handler!({ sessionId: 'session-123', toolCall });
      const result = await pending;

      expect(onToolCall).toHaveBeenCalledTimes(1);
      expect(onToolCall).toHaveBeenCalledWith(toolCall);
      expect(result).toEqual(mockFinalResponse);
    });

    it('should remove listeners after completion', async () => {
      const mockRemove = jest.fn();
      mockModule.addListener.mockReturnValue({ remove: mockRemove });
      mockModule.streamWithTools.mockResolvedValue({
        type: 'text',
        content: 'Done',
      });

      await FoundationModels.streamWithTools('session-123', 'Hello', {
        onToken: jest.fn(),
        onToolCall: jest.fn(),
      });

      expect(mockRemove).toHaveBeenCalled();
    });

    it('should throw error when session ID is empty', async () => {
      await expect(
        FoundationModels.streamWithTools('', 'Hello', { onToken: jest.fn(), onToolCall: jest.fn() })
      ).rejects.toThrow(FoundationModelsError);
    });

    it.each(['required', 'disallowed'] as const)(
      'should forward toolCallingMode %s unchanged to native',
      async (mode) => {
        mockModule.streamWithTools.mockResolvedValue({ type: 'text' as const, content: 'Done' });
        const callbacks = { onToken: jest.fn(), onToolCall: jest.fn() };

        await FoundationModels.streamWithTools('session-123', "What's the weather?", callbacks, {
          toolCallingMode: mode,
        });

        expect(mockModule.streamWithTools).toHaveBeenCalledWith(
          'session-123',
          "What's the weather?",
          { toolCallingMode: mode }
        );
      }
    );

    it('should pass a final toolCall response through unchanged', async () => {
      const finalToolCall = {
        type: 'toolCall' as const,
        toolCall: {
          id: 'call-7',
          name: 'getWeather',
          arguments: { city: 'Seoul' },
        },
      };
      mockModule.streamWithTools.mockResolvedValue(finalToolCall);

      const result = await FoundationModels.streamWithTools(
        'session-123',
        "What's the weather in Seoul?",
        { onToken: jest.fn(), onToolCall: jest.fn() }
      );

      expect(result.type).toBe('toolCall');
      expect(result.toolCall).toEqual(finalToolCall.toolCall);
    });
  });
});

describe('Tool Types', () => {
  it('Tool should have correct structure', () => {
    const tool: Tool = {
      name: 'testTool',
      description: 'A test tool',
      parameters: {
        type: 'object',
        properties: {
          arg1: { type: 'string' },
          arg2: { type: 'number' },
        },
        required: ['arg1'],
      },
    };

    expect(tool.name).toBe('testTool');
    expect(tool.parameters?.type).toBe('object');
  });

  it('ToolCall should have id, name, and arguments', () => {
    const toolCall: ToolCall = {
      id: 'call-abc123',
      name: 'getWeather',
      arguments: { city: 'London', unit: 'celsius' },
    };

    expect(toolCall.id).toBe('call-abc123');
    expect(toolCall.name).toBe('getWeather');
    expect(toolCall.arguments.city).toBe('London');
  });

  it('ToolResult should have callId and result or error', () => {
    const successResult: ToolResult = {
      callId: 'call-123',
      result: { temperature: 20, unit: 'celsius' },
    };

    const errorResult: ToolResult = {
      callId: 'call-456',
      error: 'Network timeout',
    };

    expect(successResult.result).toBeDefined();
    expect(successResult.error).toBeUndefined();
    expect(errorResult.error).toBe('Network timeout');
    expect(errorResult.result).toBeUndefined();
  });

  it('SessionOptions should support tools and instructions', () => {
    const options: SessionOptions = {
      instructions: 'Be helpful',
      tools: [
        {
          name: 'tool1',
          description: 'First tool',
        },
        {
          name: 'tool2',
          description: 'Second tool',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      ],
    };

    expect(options.instructions).toBe('Be helpful');
    expect(options.tools?.length).toBe(2);
  });
});
