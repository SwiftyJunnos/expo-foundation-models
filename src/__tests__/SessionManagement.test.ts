import { Platform } from 'react-native';
import { FoundationModels, FoundationModelsError } from '../index';
import type {
  TranscriptEntry,
  PrewarmOptions,
} from '../ExpoFoundationModels.types';
import ExpoFoundationModelsModule from '../ExpoFoundationModelsModule';

// Get the mocked module
const mockModule = ExpoFoundationModelsModule as jest.Mocked<typeof ExpoFoundationModelsModule>;

describe('FoundationModels - Session Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = 'ios';
  });

  describe('getTranscript', () => {
    it('should return empty transcript for new session', async () => {
      mockModule.getTranscript.mockResolvedValue([]);

      const transcript = await FoundationModels.getTranscript('session-123');

      expect(mockModule.getTranscript).toHaveBeenCalledWith('session-123');
      expect(transcript).toEqual([]);
    });

    it('should return transcript with instructions entry', async () => {
      const mockTranscript: TranscriptEntry[] = [
        { type: 'instructions', content: 'You are a helpful assistant' },
      ];
      mockModule.getTranscript.mockResolvedValue(mockTranscript);

      const transcript = await FoundationModels.getTranscript('session-123');

      expect(transcript).toHaveLength(1);
      expect(transcript[0].type).toBe('instructions');
      const entry = transcript[0];
      if (entry.type === 'instructions') {
        expect(entry.content).toBe('You are a helpful assistant');
      }
    });

    it('should return transcript with prompt and response entries', async () => {
      const mockTranscript: TranscriptEntry[] = [
        { type: 'instructions', content: 'Be helpful' },
        { type: 'prompt', content: 'Hello!' },
        { type: 'response', content: 'Hi there! How can I help?' },
      ];
      mockModule.getTranscript.mockResolvedValue(mockTranscript);

      const transcript = await FoundationModels.getTranscript('session-123');

      expect(transcript).toHaveLength(3);
      expect(transcript[1].type).toBe('prompt');
      expect(transcript[2].type).toBe('response');
    });

    it('should return transcript with tool call entries', async () => {
      const mockTranscript: TranscriptEntry[] = [
        { type: 'prompt', content: "What's the weather?" },
        {
          type: 'toolCall',
          name: 'getWeather',
          arguments: { city: 'Tokyo' },
          callId: 'call-123',
        },
        { type: 'toolOutput', content: '{"temperature": 25}', callId: 'call-123' },
        { type: 'response', content: 'The weather in Tokyo is 25°C.' },
      ];
      mockModule.getTranscript.mockResolvedValue(mockTranscript);

      const transcript = await FoundationModels.getTranscript('session-123');

      expect(transcript).toHaveLength(4);
      expect(transcript[1].type).toBe('toolCall');
      expect((transcript[1] as any).name).toBe('getWeather');
      expect(transcript[2].type).toBe('toolOutput');
    });

    it('should throw error when session ID is empty', async () => {
      await expect(FoundationModels.getTranscript('')).rejects.toThrow(FoundationModelsError);

      const error = await FoundationModels.getTranscript('').catch((e) => e);
      expect(error.type).toBe('sessionNotFound');
    });

    it('should throw error when session not found', async () => {
      mockModule.getTranscript.mockRejectedValue(new Error('Session not found'));

      await expect(FoundationModels.getTranscript('invalid-session')).rejects.toThrow(
        FoundationModelsError
      );
    });

    it('should throw error on non-iOS platform', async () => {
      (Platform as any).OS = 'android';

      await expect(FoundationModels.getTranscript('session-123')).rejects.toThrow(
        FoundationModelsError
      );

      const error = await FoundationModels.getTranscript('session-123').catch((e) => e);
      expect(error.type).toBe('notAvailable');
    });
  });

  describe('prewarm', () => {
    it('should prewarm session without options', async () => {
      mockModule.prewarm.mockResolvedValue(undefined);

      await FoundationModels.prewarm('session-123');

      expect(mockModule.prewarm).toHaveBeenCalledWith('session-123', null);
    });

    it('should prewarm session with prompt prefix', async () => {
      mockModule.prewarm.mockResolvedValue(undefined);

      const options: PrewarmOptions = {
        promptPrefix: 'You are an expert in programming.',
      };

      await FoundationModels.prewarm('session-123', options);

      expect(mockModule.prewarm).toHaveBeenCalledWith('session-123', options);
    });

    it('should throw error when session ID is empty', async () => {
      await expect(FoundationModels.prewarm('')).rejects.toThrow(FoundationModelsError);

      const error = await FoundationModels.prewarm('').catch((e) => e);
      expect(error.type).toBe('sessionNotFound');
    });

    it('should throw error when session not found', async () => {
      mockModule.prewarm.mockRejectedValue(new Error('Session not found'));

      await expect(FoundationModels.prewarm('invalid-session')).rejects.toThrow(
        FoundationModelsError
      );
    });

    it('should throw error on non-iOS platform', async () => {
      (Platform as any).OS = 'android';

      await expect(FoundationModels.prewarm('session-123')).rejects.toThrow(FoundationModelsError);

      const error = await FoundationModels.prewarm('session-123').catch((e) => e);
      expect(error.type).toBe('notAvailable');
    });
  });

  describe('createSessionWithTranscript', () => {
    it('should create session with initial transcript entries', async () => {
      const mockSessionId = 'session-with-history';
      mockModule.createSessionWithTranscript.mockResolvedValue(mockSessionId);

      const initialTranscript: TranscriptEntry[] = [
        { type: 'prompt', content: 'Hello!' },
        { type: 'response', content: 'Hi! How can I help you?' },
      ];

      const result = await FoundationModels.createSessionWithTranscript(initialTranscript);

      expect(mockModule.createSessionWithTranscript).toHaveBeenCalledWith({
        transcriptEntries: initialTranscript,
      });
      expect(result).toBe(mockSessionId);
    });

    it('should create session with transcript and instructions', async () => {
      const mockSessionId = 'session-with-all';
      mockModule.createSessionWithTranscript.mockResolvedValue(mockSessionId);

      const initialTranscript: TranscriptEntry[] = [
        { type: 'prompt', content: 'Previous question' },
        { type: 'response', content: 'Previous answer' },
      ];

      const result = await FoundationModels.createSessionWithTranscript(
        initialTranscript,
        'You are a helpful assistant'
      );

      expect(mockModule.createSessionWithTranscript).toHaveBeenCalledWith({
        transcriptEntries: initialTranscript,
        instructions: 'You are a helpful assistant',
      });
      expect(result).toBe(mockSessionId);
    });

    it('should throw error when transcript is empty', async () => {
      await expect(FoundationModels.createSessionWithTranscript([])).rejects.toThrow(
        FoundationModelsError
      );
    });

    it('should throw error when transcript is not an array', async () => {
      await expect(
        FoundationModels.createSessionWithTranscript(null as any)
      ).rejects.toThrow(FoundationModelsError);
    });

    it('should throw error on non-iOS platform', async () => {
      (Platform as any).OS = 'android';

      const transcript: TranscriptEntry[] = [
        { type: 'prompt', content: 'Hello' },
      ];

      await expect(FoundationModels.createSessionWithTranscript(transcript)).rejects.toThrow(
        FoundationModelsError
      );

      const error = await FoundationModels.createSessionWithTranscript(transcript).catch((e) => e);
      expect(error.type).toBe('notAvailable');
    });
  });

  describe('Conversation Flow with Transcript', () => {
    it('should maintain conversation history across multiple turns', async () => {
      // Create session
      mockModule.createSession.mockResolvedValue('session-multi-turn');
      const sessionId = await FoundationModels.createSession('Be helpful');

      // First turn
      mockModule.respond.mockResolvedValueOnce('Hello! How can I assist you?');
      await FoundationModels.respond(sessionId, 'Hi there');

      // Second turn
      mockModule.respond.mockResolvedValueOnce("I'm ready to help with that.");
      await FoundationModels.respond(sessionId, 'I need help with coding');

      // Get transcript
      const mockTranscript: TranscriptEntry[] = [
        { type: 'instructions', content: 'Be helpful' },
        { type: 'prompt', content: 'Hi there' },
        { type: 'response', content: 'Hello! How can I assist you?' },
        { type: 'prompt', content: 'I need help with coding' },
        { type: 'response', content: "I'm ready to help with that." },
      ];
      mockModule.getTranscript.mockResolvedValue(mockTranscript);

      const transcript = await FoundationModels.getTranscript(sessionId);

      expect(transcript).toHaveLength(5);
      expect(transcript.filter((e) => e.type === 'prompt')).toHaveLength(2);
      expect(transcript.filter((e) => e.type === 'response')).toHaveLength(2);
    });
  });
});

describe('TranscriptEntry Types', () => {
  it('should support instructions entry type', () => {
    const entry: TranscriptEntry = {
      type: 'instructions',
      content: 'System instructions here',
    };

    expect(entry.type).toBe('instructions');
    expect(entry.content).toBe('System instructions here');
  });

  it('should support prompt entry type', () => {
    const entry: TranscriptEntry = {
      type: 'prompt',
      content: 'User message here',
    };

    expect(entry.type).toBe('prompt');
  });

  it('should support response entry type', () => {
    const entry: TranscriptEntry = {
      type: 'response',
      content: 'Assistant response here',
    };

    expect(entry.type).toBe('response');
  });

  it('should support toolCall entry type', () => {
    const entry: TranscriptEntry = {
      type: 'toolCall',
      name: 'getWeather',
      arguments: { city: 'London' },
      callId: 'call-abc',
    };

    expect(entry.type).toBe('toolCall');
    expect((entry as any).name).toBe('getWeather');
  });

  it('should support toolOutput entry type', () => {
    const entry: TranscriptEntry = {
      type: 'toolOutput',
      content: '{"result": "sunny"}',
      callId: 'call-abc',
    };

    expect(entry.type).toBe('toolOutput');
    expect((entry as any).callId).toBe('call-abc');
  });
});

describe('PrewarmOptions Type', () => {
  it('should support promptPrefix option', () => {
    const options: PrewarmOptions = {
      promptPrefix: 'Context: You are helping with a React project.',
    };

    expect(options.promptPrefix).toBeDefined();
  });

  it('should be optional', () => {
    const options: PrewarmOptions = {};

    expect(options.promptPrefix).toBeUndefined();
  });
});
