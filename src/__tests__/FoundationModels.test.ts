import { Platform } from 'react-native';
import { FoundationModels, FoundationModelsError } from '../index';
import type { Availability, GenerationOptions } from '../ExpoFoundationModels.types';
import ExpoFoundationModelsModule from '../ExpoFoundationModelsModule';

// Get the mocked module
const mockModule = ExpoFoundationModelsModule as jest.Mocked<typeof ExpoFoundationModelsModule>;

describe('FoundationModels', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = 'ios';
  });

  describe('isAvailable', () => {
    it('should return true when Foundation Models is available', () => {
      mockModule.isAvailable.mockReturnValue(true);

      const result = FoundationModels.isAvailable();

      expect(mockModule.isAvailable).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when Foundation Models is not available', () => {
      mockModule.isAvailable.mockReturnValue(false);

      const result = FoundationModels.isAvailable();

      expect(result).toBe(false);
    });

    it('should return false on non-iOS platform', () => {
      (Platform as any).OS = 'android';

      const result = FoundationModels.isAvailable();

      expect(result).toBe(false);
      expect(mockModule.isAvailable).not.toHaveBeenCalled();
    });
  });

  describe('getAvailability', () => {
    it('should return available status when model is ready', () => {
      const mockAvailability: Availability = {
        available: true,
        status: 'available',
      };
      mockModule.getAvailability.mockReturnValue(mockAvailability);

      const result = FoundationModels.getAvailability();

      expect(mockModule.getAvailability).toHaveBeenCalled();
      expect(result).toEqual(mockAvailability);
    });

    it('should return unavailable with deviceNotEligible reason', () => {
      const mockAvailability: Availability = {
        available: false,
        status: 'unavailable',
        reason: 'deviceNotEligible',
      };
      mockModule.getAvailability.mockReturnValue(mockAvailability);

      const result = FoundationModels.getAvailability();

      expect(result.available).toBe(false);
      expect(result.reason).toBe('deviceNotEligible');
    });

    it('should return unavailable with appleIntelligenceNotEnabled reason', () => {
      const mockAvailability: Availability = {
        available: false,
        status: 'unavailable',
        reason: 'appleIntelligenceNotEnabled',
      };
      mockModule.getAvailability.mockReturnValue(mockAvailability);

      const result = FoundationModels.getAvailability();

      expect(result.reason).toBe('appleIntelligenceNotEnabled');
    });

    it('should return unavailable with modelNotReady reason', () => {
      const mockAvailability: Availability = {
        available: false,
        status: 'unavailable',
        reason: 'modelNotReady',
      };
      mockModule.getAvailability.mockReturnValue(mockAvailability);

      const result = FoundationModels.getAvailability();

      expect(result.reason).toBe('modelNotReady');
    });

    it('should return platformNotSupported on non-iOS', () => {
      (Platform as any).OS = 'android';

      const result = FoundationModels.getAvailability();

      expect(result).toEqual({
        available: false,
        status: 'unavailable',
        reason: 'platformNotSupported',
        osVersion: expect.any(String),
        features: {
          privateCloudCompute: false,
          imageAttachments: false,
          contextOptions: false,
          toolCallingMode: false,
          tokenCounting: false,
          modelVariant: false,
        },
      });
      expect(mockModule.getAvailability).not.toHaveBeenCalled();
    });
  });

  describe('createSession', () => {
    it('should create session and return session ID', async () => {
      const mockSessionId = 'session-uuid-123';
      mockModule.createSession.mockResolvedValue(mockSessionId);

      const result = await FoundationModels.createSession();

      expect(mockModule.createSession).toHaveBeenCalledWith(null);
      expect(result).toBe(mockSessionId);
    });

    it('should create session with instructions', async () => {
      const mockSessionId = 'session-uuid-123';
      const instructions = 'You are a helpful assistant.';
      mockModule.createSession.mockResolvedValue(mockSessionId);

      const result = await FoundationModels.createSession(instructions);

      expect(mockModule.createSession).toHaveBeenCalledWith(instructions);
      expect(result).toBe(mockSessionId);
    });

    it('should throw FoundationModelsError on non-iOS platform', async () => {
      (Platform as any).OS = 'android';

      await expect(FoundationModels.createSession()).rejects.toThrow(FoundationModelsError);

      const error = await FoundationModels.createSession().catch((e) => e);
      expect(error.type).toBe('notAvailable');
    });

    it('should throw FoundationModelsError when native module fails', async () => {
      mockModule.createSession.mockRejectedValue(new Error('Model not available'));

      await expect(FoundationModels.createSession()).rejects.toThrow(FoundationModelsError);
    });
  });

  describe('closeSession', () => {
    it('should close session successfully', async () => {
      mockModule.closeSession.mockResolvedValue(undefined);

      await FoundationModels.closeSession('session-uuid-123');

      expect(mockModule.closeSession).toHaveBeenCalledWith('session-uuid-123');
    });

    it('should throw FoundationModelsError when session ID is empty', async () => {
      await expect(FoundationModels.closeSession('')).rejects.toThrow(FoundationModelsError);

      const error = await FoundationModels.closeSession('').catch((e) => e);
      expect(error.type).toBe('sessionNotFound');
    });

    it('should throw FoundationModelsError when session not found', async () => {
      mockModule.closeSession.mockRejectedValue(new Error('Session not found'));

      await expect(FoundationModels.closeSession('invalid-session')).rejects.toThrow(FoundationModelsError);
    });
  });

  describe('respond', () => {
    it('should generate response for prompt', async () => {
      const mockResponse = 'Hello! How can I help you today?';
      mockModule.respond.mockResolvedValue(mockResponse);

      const result = await FoundationModels.respond('session-123', 'Hello!');

      expect(mockModule.respond).toHaveBeenCalledWith('session-123', 'Hello!', null);
      expect(result).toBe(mockResponse);
    });

    it('should pass generation options to native module', async () => {
      const mockResponse = 'Creative response here';
      mockModule.respond.mockResolvedValue(mockResponse);

      const options: GenerationOptions = {
        temperature: 1.5,
        sampling: { type: 'topP', probabilityThreshold: 0.9 },
        maximumResponseTokens: 500,
      };

      await FoundationModels.respond('session-123', 'Write a story', options);

      expect(mockModule.respond).toHaveBeenCalledWith('session-123', 'Write a story', options);
    });

    it('should throw FoundationModelsError when session ID is empty', async () => {
      await expect(FoundationModels.respond('', 'Hello')).rejects.toThrow(FoundationModelsError);

      const error = await FoundationModels.respond('', 'Hello').catch((e) => e);
      expect(error.type).toBe('sessionNotFound');
    });

    it('should throw FoundationModelsError when prompt is empty', async () => {
      await expect(FoundationModels.respond('session-123', '')).rejects.toThrow(FoundationModelsError);

      const error = await FoundationModels.respond('session-123', '').catch((e) => e);
      expect(error.type).toBe('generationFailed');
    });

    it('should throw FoundationModelsError with guardrailViolation type', async () => {
      mockModule.respond.mockRejectedValue(new Error('Content blocked by safety guardrails'));

      const error = await FoundationModels.respond('session-123', 'bad prompt').catch((e) => e);

      expect(error).toBeInstanceOf(FoundationModelsError);
      expect(error.type).toBe('guardrailViolation');
      expect(error.isGuardrailViolation()).toBe(true);
    });

    it('should throw FoundationModelsError with refusal type', async () => {
      mockModule.respond.mockRejectedValue(new Error('Model refused to generate'));

      const error = await FoundationModels.respond('session-123', 'refused prompt').catch((e) => e);

      expect(error).toBeInstanceOf(FoundationModelsError);
      expect(error.type).toBe('refusal');
      expect(error.isRefusal()).toBe(true);
    });
  });

  describe('streamResponse', () => {
    it('should stream response and call onToken for each token', async () => {
      const mockResponse = 'Hello world';
      mockModule.streamResponse.mockResolvedValue(mockResponse);

      const onToken = jest.fn();
      const result = await FoundationModels.streamResponse('session-123', 'Hello!', onToken);

      expect(mockModule.streamResponse).toHaveBeenCalledWith('session-123', 'Hello!', null);
      expect(mockModule.addListener).toHaveBeenCalledWith('onToken', expect.any(Function));
      expect(result).toBe(mockResponse);
    });

    it('should pass generation options to native module', async () => {
      mockModule.streamResponse.mockResolvedValue('Response');

      const options: GenerationOptions = {
        temperature: 0.5,
        sampling: { type: 'greedy' },
      };

      await FoundationModels.streamResponse('session-123', 'Hello!', jest.fn(), options);

      expect(mockModule.streamResponse).toHaveBeenCalledWith('session-123', 'Hello!', options);
    });

    it('should throw FoundationModelsError when session ID is empty', async () => {
      await expect(FoundationModels.streamResponse('', 'Hello', jest.fn())).rejects.toThrow(FoundationModelsError);

      const error = await FoundationModels.streamResponse('', 'Hello', jest.fn()).catch((e) => e);
      expect(error.type).toBe('sessionNotFound');
    });

    it('should throw FoundationModelsError when prompt is empty', async () => {
      await expect(FoundationModels.streamResponse('session-123', '', jest.fn())).rejects.toThrow(FoundationModelsError);

      const error = await FoundationModels.streamResponse('session-123', '', jest.fn()).catch((e) => e);
      expect(error.type).toBe('streamingFailed');
    });

    it('should remove listener after completion', async () => {
      const mockRemove = jest.fn();
      mockModule.addListener.mockReturnValue({ remove: mockRemove });
      mockModule.streamResponse.mockResolvedValue('Response');

      await FoundationModels.streamResponse('session-123', 'Hello!', jest.fn());

      expect(mockRemove).toHaveBeenCalled();
    });

    it('should remove listener even on error', async () => {
      const mockRemove = jest.fn();
      mockModule.addListener.mockReturnValue({ remove: mockRemove });
      mockModule.streamResponse.mockRejectedValue(new Error('Stream failed'));

      await expect(FoundationModels.streamResponse('session-123', 'Hello!', jest.fn())).rejects.toThrow();

      expect(mockRemove).toHaveBeenCalled();
    });
  });

  describe('FoundationModelsError', () => {
    it('should have correct properties', () => {
      const error = new FoundationModelsError('Test error', {
        type: 'guardrailViolation',
        code: 'TEST_CODE',
        context: 'test context',
      });

      expect(error.name).toBe('FoundationModelsError');
      expect(error.message).toBe('Test error');
      expect(error.type).toBe('guardrailViolation');
      expect(error.code).toBe('TEST_CODE');
      expect(error.context).toBe('test context');
    });

    it('should serialize to JSON correctly', () => {
      const error = new FoundationModelsError('Refusal error', {
        type: 'refusal',
        refusalExplanation: 'Cannot generate harmful content',
      });

      const json = error.toJSON();

      expect(json).toEqual({
        type: 'refusal',
        message: 'Refusal error',
        refusalExplanation: 'Cannot generate harmful content',
        context: undefined,
        cause: undefined,
        causeExplanation: 'An unknown error occurred.',
        diagnostics: undefined,
        suggestions: [],
      });
    });

    it('isGuardrailViolation should return correct value', () => {
      const guardrailError = new FoundationModelsError('Error', { type: 'guardrailViolation' });
      const otherError = new FoundationModelsError('Error', { type: 'generationFailed' });

      expect(guardrailError.isGuardrailViolation()).toBe(true);
      expect(otherError.isGuardrailViolation()).toBe(false);
    });

    it('isRefusal should return correct value', () => {
      const refusalError = new FoundationModelsError('Error', { type: 'refusal' });
      const otherError = new FoundationModelsError('Error', { type: 'generationFailed' });

      expect(refusalError.isRefusal()).toBe(true);
      expect(otherError.isRefusal()).toBe(false);
    });
  });
});
