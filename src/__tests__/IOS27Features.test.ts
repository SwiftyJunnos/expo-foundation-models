import { Platform } from 'react-native';
import { FoundationModels, FoundationModelsError } from '../index';
import type {
  Availability,
  FoundationModelsFeatures,
  GenerationOptions,
  PromptImage,
  PromptWithAttachments,
} from '../ExpoFoundationModels.types';
import ExpoFoundationModelsModule from '../ExpoFoundationModelsModule';

// Get the mocked module
const mockModule = ExpoFoundationModelsModule as jest.Mocked<typeof ExpoFoundationModelsModule>;

const ALL_FEATURES_FALSE: FoundationModelsFeatures = {
  privateCloudCompute: false,
  imageAttachments: false,
  contextOptions: false,
  toolCallingMode: false,
  tokenCounting: false,
  modelVariant: false,
};

/** Build a native-style rejection carrying a normalized error code. */
function nativeErrorWithCode(message: string, code: string): Error {
  return Object.assign(new Error(message), { code });
}

describe('FoundationModels iOS 27 features', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = 'ios';
  });

  describe('getFeatures', () => {
    it('should propagate native feature flags', async () => {
      const features: FoundationModelsFeatures = {
        privateCloudCompute: true,
        imageAttachments: true,
        contextOptions: true,
        toolCallingMode: true,
        tokenCounting: true,
        modelVariant: true,
      };
      mockModule.getFeatures.mockResolvedValue(features);

      const result = await FoundationModels.getFeatures();

      expect(mockModule.getFeatures).toHaveBeenCalled();
      expect(result).toEqual(features);
    });

    it('should report all features unavailable on non-iOS', async () => {
      (Platform as any).OS = 'android';

      const result = await FoundationModels.getFeatures();

      expect(mockModule.getFeatures).not.toHaveBeenCalled();
      expect(result).toEqual(ALL_FEATURES_FALSE);
    });

    it('should report all features unavailable when native call fails', async () => {
      mockModule.getFeatures.mockRejectedValue(new Error('boom'));

      const result = await FoundationModels.getFeatures();

      expect(result).toEqual(ALL_FEATURES_FALSE);
    });
  });

  describe('getTokenCount', () => {
    it('should return the token count from the native module', async () => {
      mockModule.getTokenCount.mockResolvedValue(42);

      const result = await FoundationModels.getTokenCount('Hello world');

      expect(mockModule.getTokenCount).toHaveBeenCalledWith('Hello world');
      expect(result).toBe(42);
    });

    it('should throw FoundationModelsError for empty text', async () => {
      await expect(FoundationModels.getTokenCount('')).rejects.toThrow(FoundationModelsError);
      expect(mockModule.getTokenCount).not.toHaveBeenCalled();
    });

    it('should wrap native errors in FoundationModelsError with normalized code', async () => {
      mockModule.getTokenCount.mockRejectedValue(
        nativeErrorWithCode('Token counting requires iOS 26.4', 'featureUnavailable')
      );

      const error = await FoundationModels.getTokenCount('text').catch((e) => e);

      expect(error).toBeInstanceOf(FoundationModelsError);
      expect(error.errorCode).toBe('featureUnavailable');
      expect(error.type).toBe('notAvailable');
    });
  });

  describe('getContextSize', () => {
    it('should return the context size', async () => {
      mockModule.getContextSize.mockResolvedValue(4096);

      const result = await FoundationModels.getContextSize();

      expect(mockModule.getContextSize).toHaveBeenCalled();
      expect(result).toBe(4096);
    });

    it('should return null on OS versions without contextSize support', async () => {
      mockModule.getContextSize.mockResolvedValue(null);

      const result = await FoundationModels.getContextSize();

      expect(result).toBeNull();
    });
  });

  describe('getModelVariant', () => {
    it('should return model variant info', async () => {
      mockModule.getModelVariant.mockResolvedValue({ displayName: 'on-device-4b' });

      const result = await FoundationModels.getModelVariant();

      expect(result).toEqual({ displayName: 'on-device-4b' });
    });

    it('should return null below iOS 27', async () => {
      mockModule.getModelVariant.mockResolvedValue(null);

      const result = await FoundationModels.getModelVariant();

      expect(result).toBeNull();
    });
  });

  describe('generation options pass-through', () => {
    it('should pass iOS 27 generation options to the native module', async () => {
      mockModule.respond.mockResolvedValue('ok');
      const options: GenerationOptions = {
        temperature: 0.7,
        toolCallingMode: 'required',
        contextOptions: { reasoningLevel: 'deep', includeSchemaInPrompt: true },
      };

      await FoundationModels.respond('session-123', 'Hello!', options);

      expect(mockModule.respond).toHaveBeenCalledWith('session-123', 'Hello!', options);
    });
  });

  describe('prompt attachments validation', () => {
    it('should accept a prompt object with uri images and pass it through', async () => {
      mockModule.respond.mockResolvedValue('ok');
      const prompt: PromptWithAttachments = {
        text: 'What is in this image?',
        images: [{ uri: 'file:///tmp/photo.jpg' }],
      };

      await FoundationModels.respond('session-123', prompt);

      expect(mockModule.respond).toHaveBeenCalledWith('session-123', prompt, null);
    });

    it('should accept base64 images', async () => {
      mockModule.respond.mockResolvedValue('ok');
      const prompt: PromptWithAttachments = {
        text: 'Describe this',
        images: [{ base64: 'aGVsbG8=' }],
      };

      await FoundationModels.respond('session-123', prompt);

      expect(mockModule.respond).toHaveBeenCalledWith('session-123', prompt, null);
    });

    it('should reject an image carrying both uri and base64', async () => {
      // Runtime-invalid shape on purpose: the facade must reject it.
      const invalidImage = { uri: 'file:///tmp/a.jpg', base64: 'aGVsbG8=' } as unknown as PromptImage;

      await expect(
        FoundationModels.respond('session-123', {
          text: 'Hi',
          images: [invalidImage],
        })
      ).rejects.toThrow(/exactly one/);
      expect(mockModule.respond).not.toHaveBeenCalled();
    });

    it('should reject an image carrying neither uri nor base64', async () => {
      // Runtime-invalid shape on purpose: the facade must reject it.
      const emptyImage = {} as unknown as PromptImage;

      await expect(
        FoundationModels.respond('session-123', {
          text: 'Hi',
          images: [emptyImage],
        })
      ).rejects.toThrow(FoundationModelsError);
      expect(mockModule.respond).not.toHaveBeenCalled();
    });

    it('should reject a prompt object with empty text', async () => {
      await expect(
        FoundationModels.respond('session-123', { text: '', images: [{ uri: 'x' }] })
      ).rejects.toThrow(FoundationModelsError);
      expect(mockModule.respond).not.toHaveBeenCalled();
    });

    it('should reject a prompt that is neither string nor object', async () => {
      // Runtime-invalid input on purpose: the facade must reject it.
      const numericPrompt = 42 as unknown as string;

      await expect(FoundationModels.respond('session-123', numericPrompt)).rejects.toThrow(
        FoundationModelsError
      );
      expect(mockModule.respond).not.toHaveBeenCalled();
    });
  });

  describe('error code normalization', () => {
    it('should preserve normalized native error codes', async () => {
      mockModule.respond.mockRejectedValue(
        nativeErrorWithCode('Prompt exceeds context size', 'contextSizeExceeded')
      );

      const error = await FoundationModels.respond('session-123', 'long prompt').catch((e) => e);

      expect(error).toBeInstanceOf(FoundationModelsError);
      expect(error.errorCode).toBe('contextSizeExceeded');
    });

    it('should map featureUnavailable to a notAvailable error with OS guidance', async () => {
      mockModule.respond.mockRejectedValue(
        nativeErrorWithCode('Image attachments are unavailable on this OS version', 'featureUnavailable')
      );

      const error = await FoundationModels.respond('session-123', {
        text: 'Hi',
        images: [{ uri: 'file:///tmp/a.jpg' }],
      }).catch((e) => e);

      expect(error).toBeInstanceOf(FoundationModelsError);
      expect(error.type).toBe('notAvailable');
      expect(error.errorCode).toBe('featureUnavailable');
      expect(error.suggestions.join(' ')).toContain('iOS 27');
    });

    it('should surface osVersion and features from getAvailability', () => {
      const availability: Availability = {
        available: true,
        status: 'available',
        osVersion: '27.0',
        features: {
          privateCloudCompute: true,
          imageAttachments: true,
          contextOptions: true,
          toolCallingMode: true,
          tokenCounting: true,
          modelVariant: true,
        },
      };
      mockModule.getAvailability.mockReturnValue(availability);

      const result = FoundationModels.getAvailability();

      expect(result.osVersion).toBe('27.0');
      expect(result.features?.privateCloudCompute).toBe(true);
    });
  });

  describe('createSession with model specifier', () => {
    it('should route PCC model specifier through createSessionWithConfig', async () => {
      mockModule.createSessionWithConfig.mockResolvedValue('session-pcc');

      const sessionId = await FoundationModels.createSession({
        instructions: 'You are helpful',
        model: { type: 'privateCloudCompute' },
      });

      expect(mockModule.createSessionWithConfig).toHaveBeenCalledWith({
        instructions: 'You are helpful',
        guardrails: undefined,
        useCase: undefined,
        tools: undefined,
        adapterId: undefined,
        model: { type: 'privateCloudCompute' },
      });
      expect(sessionId).toBe('session-pcc');
    });

    it('should keep simple instruction sessions on plain createSession', async () => {
      mockModule.createSession.mockResolvedValue('session-simple');

      await FoundationModels.createSession({ instructions: 'You are helpful' });

      expect(mockModule.createSessionWithConfig).not.toHaveBeenCalled();
      expect(mockModule.createSession).toHaveBeenCalledWith('You are helpful');
    });
  });
});
