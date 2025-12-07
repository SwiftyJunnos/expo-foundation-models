import { Platform } from 'react-native';
import { CoreML, CoreMLError } from '../index';
import ExpoFoundationModelsModule from '../ExpoFoundationModelsModule';

// Get the mocked module
const mockModule = ExpoFoundationModelsModule as jest.Mocked<typeof ExpoFoundationModelsModule>;

describe('CoreML', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset Platform.OS to iOS for most tests
    (Platform as any).OS = 'ios';
  });

  describe('loadModel', () => {
    it('should load a model and return model ID', async () => {
      const mockModelId = 'TestModel_abc123';
      mockModule.loadModel.mockResolvedValue(mockModelId);

      const result = await CoreML.loadModel('TestModel');

      expect(mockModule.loadModel).toHaveBeenCalledWith('TestModel');
      expect(result).toBe(mockModelId);
    });

    it('should throw CoreMLError when model name is empty', async () => {
      await expect(CoreML.loadModel('')).rejects.toThrow(CoreMLError);
      await expect(CoreML.loadModel('')).rejects.toThrow('Model name must be a non-empty string');
    });

    it('should throw CoreMLError on non-iOS platform', async () => {
      (Platform as any).OS = 'android';

      await expect(CoreML.loadModel('TestModel')).rejects.toThrow(CoreMLError);
      await expect(CoreML.loadModel('TestModel')).rejects.toThrow('CoreML is only available on iOS');
    });

    it('should throw CoreMLError when native module fails', async () => {
      mockModule.loadModel.mockRejectedValue(new Error('Model not found'));

      await expect(CoreML.loadModel('NonExistentModel')).rejects.toThrow(CoreMLError);
      await expect(CoreML.loadModel('NonExistentModel')).rejects.toThrow('Failed to load model');
    });
  });

  describe('unloadModel', () => {
    it('should unload a model successfully', async () => {
      mockModule.unloadModel.mockResolvedValue(undefined);

      await CoreML.unloadModel('TestModel_abc123');

      expect(mockModule.unloadModel).toHaveBeenCalledWith('TestModel_abc123');
    });

    it('should throw CoreMLError when model ID is empty', async () => {
      await expect(CoreML.unloadModel('')).rejects.toThrow(CoreMLError);
      await expect(CoreML.unloadModel('')).rejects.toThrow('Model ID must be a non-empty string');
    });

    it('should throw CoreMLError on non-iOS platform', async () => {
      (Platform as any).OS = 'android';

      await expect(CoreML.unloadModel('TestModel_abc123')).rejects.toThrow(CoreMLError);
    });
  });

  describe('predict', () => {
    it('should run prediction and return output', async () => {
      const mockOutput = { prediction: 0.95, label: 'cat' };
      mockModule.predict.mockResolvedValue(mockOutput);

      const input = { image: [1.0, 2.0, 3.0] };
      const result = await CoreML.predict('TestModel_abc123', input);

      expect(mockModule.predict).toHaveBeenCalledWith('TestModel_abc123', input);
      expect(result).toEqual(mockOutput);
    });

    it('should throw CoreMLError when model ID is empty', async () => {
      await expect(CoreML.predict('', { input: 1 })).rejects.toThrow(CoreMLError);
    });

    it('should throw CoreMLError when input is not an object', async () => {
      await expect(CoreML.predict('TestModel_abc123', null as any)).rejects.toThrow(CoreMLError);
      await expect(CoreML.predict('TestModel_abc123', null as any)).rejects.toThrow('Input must be an object');
    });

    it('should throw CoreMLError on non-iOS platform', async () => {
      (Platform as any).OS = 'android';

      await expect(CoreML.predict('TestModel_abc123', { input: 1 })).rejects.toThrow(CoreMLError);
    });
  });

  describe('isModelLoaded', () => {
    it('should return true when model is loaded', () => {
      mockModule.isModelLoaded.mockReturnValue(true);

      const result = CoreML.isModelLoaded('TestModel_abc123');

      expect(mockModule.isModelLoaded).toHaveBeenCalledWith('TestModel_abc123');
      expect(result).toBe(true);
    });

    it('should return false when model ID is empty', () => {
      const result = CoreML.isModelLoaded('');

      expect(result).toBe(false);
    });

    it('should return false on non-iOS platform', () => {
      (Platform as any).OS = 'android';

      const result = CoreML.isModelLoaded('TestModel_abc123');

      expect(result).toBe(false);
    });
  });

  describe('getLoadedModels', () => {
    it('should return list of loaded model IDs', () => {
      const mockModels = ['Model1_abc', 'Model2_def'];
      mockModule.getLoadedModels.mockReturnValue(mockModels);

      const result = CoreML.getLoadedModels();

      expect(mockModule.getLoadedModels).toHaveBeenCalled();
      expect(result).toEqual(mockModels);
    });

    it('should return empty array on non-iOS platform', () => {
      (Platform as any).OS = 'android';

      const result = CoreML.getLoadedModels();

      expect(result).toEqual([]);
    });
  });
});
