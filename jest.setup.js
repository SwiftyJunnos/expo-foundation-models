// Jest setup file

// Mock react-native Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((options) => options.ios),
  },
}));

// Mock the native module
jest.mock('./src/ExpoFoundationModelsModule', () => ({
  __esModule: true,
  default: {
    // CoreML functions
    loadModel: jest.fn(),
    unloadModel: jest.fn(),
    predict: jest.fn(),
    isModelLoaded: jest.fn(),
    getLoadedModels: jest.fn(),

    // Foundation Models functions
    isAvailable: jest.fn(),
    getAvailability: jest.fn(),
    createSession: jest.fn(),
    closeSession: jest.fn(),
    respond: jest.fn(),
    streamResponse: jest.fn(),

    // Structured Output functions
    respondWithSchema: jest.fn(),
    respondWithChoices: jest.fn(),
    streamWithSchema: jest.fn(),

    // Tool Calling functions
    createSessionWithTools: jest.fn(),
    respondWithTools: jest.fn(),
    submitToolResult: jest.fn(),
    streamWithTools: jest.fn(),

    // Event listener
    addListener: jest.fn(() => ({
      remove: jest.fn(),
    })),
  },
}));
