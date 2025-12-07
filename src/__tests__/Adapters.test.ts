import { Platform } from 'react-native';
import { FoundationModels, FoundationModelsError } from '../index';
import type {
  AdapterInfo,
  AdapterDownloadStatus,
  LoadAdapterOptions,
} from '../ExpoFoundationModels.types';
import ExpoFoundationModelsModule from '../ExpoFoundationModelsModule';

// Get the mocked module
const mockModule = ExpoFoundationModelsModule as jest.Mocked<typeof ExpoFoundationModelsModule>;

describe('FoundationModels - Adapters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = 'ios';
  });

  describe('loadAdapter', () => {
    it('should load adapter by name from background assets', async () => {
      const mockAdapterInfo: AdapterInfo = {
        id: 'adapter-123',
        name: 'myCustomAdapter',
        isReady: true,
        isCompiled: false,
        metadata: { version: '1.0' },
      };
      mockModule.loadAdapter.mockResolvedValue(mockAdapterInfo);

      const adapter = await FoundationModels.loadAdapter('myCustomAdapter');

      expect(mockModule.loadAdapter).toHaveBeenCalledWith('myCustomAdapter', null);
      expect(adapter.id).toBe('adapter-123');
      expect(adapter.name).toBe('myCustomAdapter');
      expect(adapter.isReady).toBe(true);
    });

    it('should load adapter with compile option', async () => {
      const mockAdapterInfo: AdapterInfo = {
        id: 'adapter-456',
        name: 'compiledAdapter',
        isReady: true,
        isCompiled: true,
      };
      mockModule.loadAdapter.mockResolvedValue(mockAdapterInfo);

      const options: LoadAdapterOptions = { compile: true };
      const adapter = await FoundationModels.loadAdapter('compiledAdapter', options);

      expect(mockModule.loadAdapter).toHaveBeenCalledWith('compiledAdapter', options);
      expect(adapter.isCompiled).toBe(true);
    });

    it('should throw error when adapter name is empty', async () => {
      await expect(FoundationModels.loadAdapter('')).rejects.toThrow(FoundationModelsError);

      const error = await FoundationModels.loadAdapter('').catch((e) => e);
      expect(error.type).toBe('generationFailed');
    });

    it('should throw error when adapter not found', async () => {
      mockModule.loadAdapter.mockRejectedValue(new Error('No compatible adapter found'));

      await expect(FoundationModels.loadAdapter('nonexistent')).rejects.toThrow(
        FoundationModelsError
      );
    });

    it('should throw error on non-iOS platform', async () => {
      (Platform as any).OS = 'android';

      await expect(FoundationModels.loadAdapter('myAdapter')).rejects.toThrow(
        FoundationModelsError
      );

      const error = await FoundationModels.loadAdapter('myAdapter').catch((e) => e);
      expect(error.type).toBe('notAvailable');
    });
  });

  describe('loadAdapterFromFile', () => {
    it('should load adapter from local file URL', async () => {
      const mockAdapterInfo: AdapterInfo = {
        id: 'adapter-local',
        name: 'localAdapter',
        isReady: true,
        isCompiled: false,
      };
      mockModule.loadAdapterFromFile.mockResolvedValue(mockAdapterInfo);

      const adapter = await FoundationModels.loadAdapterFromFile(
        '/path/to/my_adapter.fmadapter'
      );

      expect(mockModule.loadAdapterFromFile).toHaveBeenCalledWith(
        '/path/to/my_adapter.fmadapter',
        null
      );
      expect(adapter.id).toBe('adapter-local');
      expect(adapter.isReady).toBe(true);
    });

    it('should load adapter from file with compile option', async () => {
      const mockAdapterInfo: AdapterInfo = {
        id: 'adapter-local-compiled',
        name: 'localAdapter',
        isReady: true,
        isCompiled: true,
      };
      mockModule.loadAdapterFromFile.mockResolvedValue(mockAdapterInfo);

      const options: LoadAdapterOptions = { compile: true };
      const adapter = await FoundationModels.loadAdapterFromFile(
        '/path/to/adapter.fmadapter',
        options
      );

      expect(mockModule.loadAdapterFromFile).toHaveBeenCalledWith(
        '/path/to/adapter.fmadapter',
        options
      );
      expect(adapter.isCompiled).toBe(true);
    });

    it('should throw error when file path is empty', async () => {
      await expect(FoundationModels.loadAdapterFromFile('')).rejects.toThrow(
        FoundationModelsError
      );
    });

    it('should throw error when file not found', async () => {
      mockModule.loadAdapterFromFile.mockRejectedValue(new Error('File not found'));

      await expect(
        FoundationModels.loadAdapterFromFile('/invalid/path.fmadapter')
      ).rejects.toThrow(FoundationModelsError);
    });

    it('should throw error on non-iOS platform', async () => {
      (Platform as any).OS = 'android';

      await expect(
        FoundationModels.loadAdapterFromFile('/path/to/adapter.fmadapter')
      ).rejects.toThrow(FoundationModelsError);
    });
  });

  describe('compileAdapter', () => {
    it('should compile an adapter for faster inference', async () => {
      mockModule.compileAdapter.mockResolvedValue(undefined);

      await FoundationModels.compileAdapter('adapter-123');

      expect(mockModule.compileAdapter).toHaveBeenCalledWith('adapter-123');
    });

    it('should throw error when adapter ID is empty', async () => {
      await expect(FoundationModels.compileAdapter('')).rejects.toThrow(
        FoundationModelsError
      );
    });

    it('should throw error when adapter not found', async () => {
      mockModule.compileAdapter.mockRejectedValue(new Error('Adapter not found'));

      await expect(FoundationModels.compileAdapter('invalid-id')).rejects.toThrow(
        FoundationModelsError
      );
    });

    it('should throw error on non-iOS platform', async () => {
      (Platform as any).OS = 'android';

      await expect(FoundationModels.compileAdapter('adapter-123')).rejects.toThrow(
        FoundationModelsError
      );
    });
  });

  describe('unloadAdapter', () => {
    it('should unload an adapter', async () => {
      mockModule.unloadAdapter.mockResolvedValue(undefined);

      await FoundationModels.unloadAdapter('adapter-123');

      expect(mockModule.unloadAdapter).toHaveBeenCalledWith('adapter-123');
    });

    it('should throw error when adapter ID is empty', async () => {
      await expect(FoundationModels.unloadAdapter('')).rejects.toThrow(
        FoundationModelsError
      );
    });

    it('should throw error on non-iOS platform', async () => {
      (Platform as any).OS = 'android';

      await expect(FoundationModels.unloadAdapter('adapter-123')).rejects.toThrow(
        FoundationModelsError
      );
    });
  });

  describe('getAdapterDownloadStatus', () => {
    it('should return not started status', async () => {
      const mockStatus: AdapterDownloadStatus = { state: 'notStarted' };
      mockModule.getAdapterDownloadStatus.mockResolvedValue(mockStatus);

      const status = await FoundationModels.getAdapterDownloadStatus('myAdapter');

      expect(status.state).toBe('notStarted');
    });

    it('should return downloading status with progress', async () => {
      const mockStatus: AdapterDownloadStatus = { state: 'downloading', progress: 0.5 };
      mockModule.getAdapterDownloadStatus.mockResolvedValue(mockStatus);

      const status = await FoundationModels.getAdapterDownloadStatus('myAdapter');

      expect(status.state).toBe('downloading');
      if (status.state === 'downloading') {
        expect(status.progress).toBe(0.5);
      }
    });

    it('should return completed status', async () => {
      const mockStatus: AdapterDownloadStatus = { state: 'completed' };
      mockModule.getAdapterDownloadStatus.mockResolvedValue(mockStatus);

      const status = await FoundationModels.getAdapterDownloadStatus('myAdapter');

      expect(status.state).toBe('completed');
    });

    it('should return failed status with error', async () => {
      const mockStatus: AdapterDownloadStatus = {
        state: 'failed',
        error: 'Network error',
      };
      mockModule.getAdapterDownloadStatus.mockResolvedValue(mockStatus);

      const status = await FoundationModels.getAdapterDownloadStatus('myAdapter');

      expect(status.state).toBe('failed');
      if (status.state === 'failed') {
        expect(status.error).toBe('Network error');
      }
    });

    it('should throw error on non-iOS platform', async () => {
      (Platform as any).OS = 'android';

      await expect(
        FoundationModels.getAdapterDownloadStatus('myAdapter')
      ).rejects.toThrow(FoundationModelsError);
    });
  });

  describe('removeObsoleteAdapters', () => {
    it('should remove all obsolete adapters', async () => {
      mockModule.removeObsoleteAdapters.mockResolvedValue(undefined);

      await FoundationModels.removeObsoleteAdapters();

      expect(mockModule.removeObsoleteAdapters).toHaveBeenCalled();
    });

    it('should throw error on non-iOS platform', async () => {
      (Platform as any).OS = 'android';

      await expect(FoundationModels.removeObsoleteAdapters()).rejects.toThrow(
        FoundationModelsError
      );
    });
  });

  describe('isAdapterCompatible', () => {
    it('should return true for compatible adapter', async () => {
      mockModule.isAdapterCompatible.mockResolvedValue(true);

      const isCompatible = await FoundationModels.isAdapterCompatible('myAdapter');

      expect(mockModule.isAdapterCompatible).toHaveBeenCalledWith('myAdapter');
      expect(isCompatible).toBe(true);
    });

    it('should return false for incompatible adapter', async () => {
      mockModule.isAdapterCompatible.mockResolvedValue(false);

      const isCompatible = await FoundationModels.isAdapterCompatible('oldAdapter');

      expect(isCompatible).toBe(false);
    });

    it('should throw error on non-iOS platform', async () => {
      (Platform as any).OS = 'android';

      await expect(FoundationModels.isAdapterCompatible('myAdapter')).rejects.toThrow(
        FoundationModelsError
      );
    });
  });

  describe('createSession with adapter', () => {
    it('should create session with adapter ID', async () => {
      const mockSessionId = 'session-with-adapter';
      mockModule.createSessionWithConfig.mockResolvedValue(mockSessionId);

      const sessionId = await FoundationModels.createSession({
        adapterId: 'adapter-123',
        instructions: 'Use the custom model',
      });

      expect(mockModule.createSessionWithConfig).toHaveBeenCalledWith({
        adapterId: 'adapter-123',
        instructions: 'Use the custom model',
      });
      expect(sessionId).toBe(mockSessionId);
    });

    it('should create session with adapter and guardrails', async () => {
      const mockSessionId = 'session-adapter-guardrails';
      mockModule.createSessionWithConfig.mockResolvedValue(mockSessionId);

      const sessionId = await FoundationModels.createSession({
        adapterId: 'adapter-123',
        guardrails: 'permissiveContentTransformations',
      });

      expect(mockModule.createSessionWithConfig).toHaveBeenCalledWith({
        adapterId: 'adapter-123',
        guardrails: 'permissiveContentTransformations',
      });
      expect(sessionId).toBe(mockSessionId);
    });
  });
});

describe('AdapterInfo Type', () => {
  it('should support all required fields', () => {
    const adapter: AdapterInfo = {
      id: 'test-id',
      name: 'testAdapter',
      isReady: true,
      isCompiled: false,
    };

    expect(adapter.id).toBe('test-id');
    expect(adapter.name).toBe('testAdapter');
    expect(adapter.isReady).toBe(true);
    expect(adapter.isCompiled).toBe(false);
  });

  it('should support optional metadata', () => {
    const adapter: AdapterInfo = {
      id: 'test-id',
      name: 'testAdapter',
      isReady: true,
      isCompiled: true,
      metadata: {
        version: '2.0',
        author: 'Test Author',
      },
    };

    expect(adapter.metadata?.version).toBe('2.0');
  });
});

describe('AdapterDownloadStatus Type', () => {
  it('should support notStarted state', () => {
    const status: AdapterDownloadStatus = { state: 'notStarted' };
    expect(status.state).toBe('notStarted');
  });

  it('should support downloading state with progress', () => {
    const status: AdapterDownloadStatus = { state: 'downloading', progress: 0.75 };
    expect(status.state).toBe('downloading');
    if (status.state === 'downloading') {
      expect(status.progress).toBe(0.75);
    }
  });

  it('should support paused state', () => {
    const status: AdapterDownloadStatus = { state: 'paused' };
    expect(status.state).toBe('paused');
  });

  it('should support completed state', () => {
    const status: AdapterDownloadStatus = { state: 'completed' };
    expect(status.state).toBe('completed');
  });

  it('should support failed state with error', () => {
    const status: AdapterDownloadStatus = {
      state: 'failed',
      error: 'Download interrupted',
    };
    expect(status.state).toBe('failed');
    if (status.state === 'failed') {
      expect(status.error).toBe('Download interrupted');
    }
  });
});

describe('LoadAdapterOptions Type', () => {
  it('should support empty options', () => {
    const options: LoadAdapterOptions = {};
    expect(options.compile).toBeUndefined();
  });

  it('should support compile option', () => {
    const options: LoadAdapterOptions = { compile: true };
    expect(options.compile).toBe(true);
  });
});
