/**
 * Input/output types for CoreML predictions.
 */
export type MLValue = number | number[] | string;
export type MLDictionary = { [key: string]: MLValue };

/**
 * Generation options for Foundation Models.
 */
export type GenerationOptions = {
  temperature?: number;
  maxTokens?: number;
};

/**
 * Token event emitted during streaming generation.
 */
export type TokenEvent = {
  token: string;
  sessionId: string;
};

/**
 * Events emitted by the ExpoFoundationModels module.
 */
export type ExpoFoundationModelsModuleEvents = {
  onToken: (event: TokenEvent) => void;
};
