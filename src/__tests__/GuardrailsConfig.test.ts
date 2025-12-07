import { Platform } from 'react-native';
import { FoundationModels, FoundationModelsError } from '../index';
import type {
  GuardrailsMode,
  ModelUseCase,
  ExtendedSessionOptions,
} from '../ExpoFoundationModels.types';
import ExpoFoundationModelsModule from '../ExpoFoundationModelsModule';

// Get the mocked module
const mockModule = ExpoFoundationModelsModule as jest.Mocked<typeof ExpoFoundationModelsModule>;

describe('FoundationModels - Guardrails Configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = 'ios';
  });

  describe('createSession with guardrails', () => {
    it('should create session with default guardrails', async () => {
      const mockSessionId = 'session-default-guardrails';
      mockModule.createSessionWithConfig.mockResolvedValue(mockSessionId);

      const options: ExtendedSessionOptions = {
        guardrails: 'default',
      };

      const sessionId = await FoundationModels.createSession(options);

      expect(mockModule.createSessionWithConfig).toHaveBeenCalledWith({
        guardrails: 'default',
      });
      expect(sessionId).toBe(mockSessionId);
    });

    it('should create session with permissive guardrails', async () => {
      const mockSessionId = 'session-permissive';
      mockModule.createSessionWithConfig.mockResolvedValue(mockSessionId);

      const options: ExtendedSessionOptions = {
        guardrails: 'permissiveContentTransformations',
      };

      const sessionId = await FoundationModels.createSession(options);

      expect(mockModule.createSessionWithConfig).toHaveBeenCalledWith({
        guardrails: 'permissiveContentTransformations',
      });
      expect(sessionId).toBe(mockSessionId);
    });

    it('should create session with guardrails and instructions', async () => {
      const mockSessionId = 'session-guardrails-instructions';
      mockModule.createSessionWithConfig.mockResolvedValue(mockSessionId);

      const options: ExtendedSessionOptions = {
        instructions: 'You are a content moderator',
        guardrails: 'permissiveContentTransformations',
      };

      const sessionId = await FoundationModels.createSession(options);

      expect(mockModule.createSessionWithConfig).toHaveBeenCalledWith({
        instructions: 'You are a content moderator',
        guardrails: 'permissiveContentTransformations',
      });
      expect(sessionId).toBe(mockSessionId);
    });

    it('should throw error on non-iOS platform with guardrails', async () => {
      (Platform as any).OS = 'android';

      const options: ExtendedSessionOptions = {
        guardrails: 'default',
      };

      await expect(FoundationModels.createSession(options)).rejects.toThrow(
        FoundationModelsError
      );

      const error = await FoundationModels.createSession(options).catch((e) => e);
      expect(error.type).toBe('notAvailable');
    });
  });

  describe('createSession with useCase', () => {
    it('should create session with general use case', async () => {
      const mockSessionId = 'session-general';
      mockModule.createSessionWithConfig.mockResolvedValue(mockSessionId);

      const options: ExtendedSessionOptions = {
        useCase: 'general',
      };

      const sessionId = await FoundationModels.createSession(options);

      expect(mockModule.createSessionWithConfig).toHaveBeenCalledWith({
        useCase: 'general',
      });
      expect(sessionId).toBe(mockSessionId);
    });

    it('should create session with contentTagging use case', async () => {
      const mockSessionId = 'session-tagging';
      mockModule.createSessionWithConfig.mockResolvedValue(mockSessionId);

      const options: ExtendedSessionOptions = {
        useCase: 'contentTagging',
      };

      const sessionId = await FoundationModels.createSession(options);

      expect(mockModule.createSessionWithConfig).toHaveBeenCalledWith({
        useCase: 'contentTagging',
      });
      expect(sessionId).toBe(mockSessionId);
    });

    it('should create session with useCase and instructions', async () => {
      const mockSessionId = 'session-usecase-instructions';
      mockModule.createSessionWithConfig.mockResolvedValue(mockSessionId);

      const options: ExtendedSessionOptions = {
        instructions: 'Tag the content appropriately',
        useCase: 'contentTagging',
      };

      const sessionId = await FoundationModels.createSession(options);

      expect(mockModule.createSessionWithConfig).toHaveBeenCalledWith({
        instructions: 'Tag the content appropriately',
        useCase: 'contentTagging',
      });
      expect(sessionId).toBe(mockSessionId);
    });
  });

  describe('createSession with guardrails and useCase combined', () => {
    it('should create session with both guardrails and useCase', async () => {
      const mockSessionId = 'session-combined';
      mockModule.createSessionWithConfig.mockResolvedValue(mockSessionId);

      const options: ExtendedSessionOptions = {
        instructions: 'Process content for tagging',
        guardrails: 'permissiveContentTransformations',
        useCase: 'contentTagging',
      };

      const sessionId = await FoundationModels.createSession(options);

      expect(mockModule.createSessionWithConfig).toHaveBeenCalledWith({
        instructions: 'Process content for tagging',
        guardrails: 'permissiveContentTransformations',
        useCase: 'contentTagging',
      });
      expect(sessionId).toBe(mockSessionId);
    });

    it('should create session with all options including tools', async () => {
      const mockSessionId = 'session-full-config';
      mockModule.createSessionWithConfig.mockResolvedValue(mockSessionId);

      const options: ExtendedSessionOptions = {
        instructions: 'Help with weather queries',
        guardrails: 'default',
        useCase: 'general',
        tools: [
          {
            name: 'getWeather',
            description: 'Get weather for a city',
            parameters: {
              type: 'object',
              properties: {
                city: { type: 'string' },
              },
              required: ['city'],
            },
          },
        ],
      };

      const sessionId = await FoundationModels.createSession(options);

      expect(mockModule.createSessionWithConfig).toHaveBeenCalledWith(options);
      expect(sessionId).toBe(mockSessionId);
    });
  });

  describe('backward compatibility', () => {
    it('should still support string-only instructions (legacy API)', async () => {
      const mockSessionId = 'session-legacy';
      mockModule.createSession.mockResolvedValue(mockSessionId);

      const sessionId = await FoundationModels.createSession('You are helpful');

      expect(mockModule.createSession).toHaveBeenCalledWith('You are helpful');
      expect(sessionId).toBe(mockSessionId);
    });

    it('should still support undefined instructions (legacy API)', async () => {
      const mockSessionId = 'session-no-instructions';
      mockModule.createSession.mockResolvedValue(mockSessionId);

      const sessionId = await FoundationModels.createSession();

      expect(mockModule.createSession).toHaveBeenCalledWith(null);
      expect(sessionId).toBe(mockSessionId);
    });
  });
});

describe('GuardrailsMode Type', () => {
  it('should support default mode', () => {
    const mode: GuardrailsMode = 'default';
    expect(mode).toBe('default');
  });

  it('should support permissiveContentTransformations mode', () => {
    const mode: GuardrailsMode = 'permissiveContentTransformations';
    expect(mode).toBe('permissiveContentTransformations');
  });
});

describe('ModelUseCase Type', () => {
  it('should support general use case', () => {
    const useCase: ModelUseCase = 'general';
    expect(useCase).toBe('general');
  });

  it('should support contentTagging use case', () => {
    const useCase: ModelUseCase = 'contentTagging';
    expect(useCase).toBe('contentTagging');
  });
});

describe('ExtendedSessionOptions Type', () => {
  it('should support all optional fields', () => {
    const options: ExtendedSessionOptions = {};
    expect(options.instructions).toBeUndefined();
    expect(options.guardrails).toBeUndefined();
    expect(options.useCase).toBeUndefined();
    expect(options.tools).toBeUndefined();
  });

  it('should support full configuration', () => {
    const options: ExtendedSessionOptions = {
      instructions: 'Be helpful',
      guardrails: 'default',
      useCase: 'general',
      tools: [
        {
          name: 'testTool',
          description: 'A test tool',
        },
      ],
    };

    expect(options.instructions).toBe('Be helpful');
    expect(options.guardrails).toBe('default');
    expect(options.useCase).toBe('general');
    expect(options.tools).toHaveLength(1);
  });
});
