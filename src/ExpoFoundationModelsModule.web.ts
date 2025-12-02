import { registerWebModule, NativeModule } from 'expo';

import { ExpoFoundationModelsModuleEvents } from './ExpoFoundationModels.types';

class ExpoFoundationModelsModule extends NativeModule<ExpoFoundationModelsModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
}

export default registerWebModule(ExpoFoundationModelsModule, 'ExpoFoundationModelsModule');
