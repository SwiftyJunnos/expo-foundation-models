import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import {
  CoreML,
  CoreMLError,
  FoundationModels,
  FoundationModelsError,
} from 'expo-foundation-models';

// Example model name - replace with your actual model
const MODEL_NAME = 'ExampleClassifier';

type Tab = 'coreml' | 'foundationmodels';

interface PredictionResult {
  [key: string]: string | number | number[];
}

function CoreMLDemo() {
  const [modelId, setModelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadModel = useCallback(async () => {
    if (Platform.OS !== 'ios') {
      setError('CoreML is only available on iOS');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const id = await CoreML.loadModel(MODEL_NAME);
      setModelId(id);
      console.log('Model loaded with ID:', id);
    } catch (err) {
      const message = err instanceof CoreMLError ? err.message : String(err);
      setError(`Failed to load model: ${message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const runPrediction = useCallback(async () => {
    if (!modelId) {
      setError('No model loaded');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Example input - adjust based on your model's requirements
      const input = {
        input: [1.0, 2.0, 3.0, 4.0],
      };

      const prediction = await CoreML.predict(modelId, input);
      setResult(prediction);
      console.log('Prediction result:', prediction);
    } catch (err) {
      const message = err instanceof CoreMLError ? err.message : String(err);
      setError(`Prediction failed: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [modelId]);

  const unloadModel = useCallback(async () => {
    if (!modelId) return;

    setLoading(true);
    setError(null);

    try {
      await CoreML.unloadModel(modelId);
      setModelId(null);
      setResult(null);
      console.log('Model unloaded');
    } catch (err) {
      const message = err instanceof CoreMLError ? err.message : String(err);
      setError(`Failed to unload model: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [modelId]);

  const checkModelStatus = useCallback(() => {
    if (!modelId) {
      console.log('No model ID set');
      return;
    }

    const loaded = CoreML.isModelLoaded(modelId);
    console.log(`Model ${modelId} is loaded: ${loaded}`);

    const allModels = CoreML.getLoadedModels();
    console.log('All loaded models:', allModels);
  }, [modelId]);

  return (
    <>
      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>Model Status:</Text>
        <Text style={[styles.statusValue, modelId ? styles.loaded : styles.notLoaded]}>
          {modelId ? `Loaded (${modelId.slice(0, 8)}...)` : 'Not Loaded'}
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, modelId && styles.buttonDisabled]}
          onPress={loadModel}
          disabled={loading || !!modelId}
        >
          <Text style={styles.buttonText}>Load Model</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, !modelId && styles.buttonDisabled]}
          onPress={runPrediction}
          disabled={loading || !modelId}
        >
          <Text style={styles.buttonText}>Run Prediction</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary]}
          onPress={checkModelStatus}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Check Status</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonDanger, !modelId && styles.buttonDisabled]}
          onPress={unloadModel}
          disabled={loading || !modelId}
        >
          <Text style={styles.buttonText}>Unload Model</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {result && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultTitle}>Prediction Result:</Text>
          <Text style={styles.resultText}>{JSON.stringify(result, null, 2)}</Text>
        </View>
      )}
    </>
  );
}

function FoundationModelsDemo() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState('What is the capital of France?');
  const [response, setResponse] = useState<string | null>(null);
  const [streamingResponse, setStreamingResponse] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isAvailable = Platform.OS === 'ios' && FoundationModels.isAvailable();

  const createSession = useCallback(async () => {
    if (Platform.OS !== 'ios') {
      setError('Foundation Models is only available on iOS');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const id = await FoundationModels.createSession('You are a helpful assistant.');
      setSessionId(id);
      console.log('Session created with ID:', id);
    } catch (err) {
      const message = err instanceof FoundationModelsError ? err.message : String(err);
      setError(`Failed to create session: ${message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const generateResponse = useCallback(async () => {
    if (!sessionId) {
      setError('No session created');
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const result = await FoundationModels.respond(sessionId, prompt, {
        temperature: 0.7,
        maxTokens: 500,
      });
      setResponse(result);
      console.log('Response:', result);
    } catch (err) {
      const message = err instanceof FoundationModelsError ? err.message : String(err);
      setError(`Generation failed: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [sessionId, prompt]);

  const streamResponseHandler = useCallback(async () => {
    if (!sessionId) {
      setError('No session created');
      return;
    }

    setLoading(true);
    setError(null);
    setStreamingResponse('');
    setResponse(null);

    try {
      const result = await FoundationModels.streamResponse(
        sessionId,
        prompt,
        (token) => {
          setStreamingResponse((prev) => prev + token);
        },
        {
          temperature: 0.7,
          maxTokens: 500,
        }
      );
      setResponse(result);
      console.log('Stream complete:', result);
    } catch (err) {
      const message = err instanceof FoundationModelsError ? err.message : String(err);
      setError(`Streaming failed: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [sessionId, prompt]);

  const closeSession = useCallback(async () => {
    if (!sessionId) return;

    setLoading(true);
    setError(null);

    try {
      await FoundationModels.closeSession(sessionId);
      setSessionId(null);
      setResponse(null);
      setStreamingResponse('');
      console.log('Session closed');
    } catch (err) {
      const message = err instanceof FoundationModelsError ? err.message : String(err);
      setError(`Failed to close session: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  if (!isAvailable) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>
          Foundation Models requires iOS 26.0+ with Apple Intelligence enabled.
        </Text>
      </View>
    );
  }

  return (
    <>
      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>Session Status:</Text>
        <Text style={[styles.statusValue, sessionId ? styles.loaded : styles.notLoaded]}>
          {sessionId ? `Active (${sessionId.slice(0, 8)}...)` : 'No Session'}
        </Text>
      </View>

      <TextInput
        style={styles.textInput}
        value={prompt}
        onChangeText={setPrompt}
        placeholder="Enter your prompt..."
        multiline
        numberOfLines={3}
      />

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, sessionId && styles.buttonDisabled]}
          onPress={createSession}
          disabled={loading || !!sessionId}
        >
          <Text style={styles.buttonText}>Create Session</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, !sessionId && styles.buttonDisabled]}
          onPress={generateResponse}
          disabled={loading || !sessionId}
        >
          <Text style={styles.buttonText}>Generate Response</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary, !sessionId && styles.buttonDisabled]}
          onPress={streamResponseHandler}
          disabled={loading || !sessionId}
        >
          <Text style={styles.buttonText}>Stream Response</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonDanger, !sessionId && styles.buttonDisabled]}
          onPress={closeSession}
          disabled={loading || !sessionId}
        >
          <Text style={styles.buttonText}>Close Session</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {streamingResponse && !response && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultTitle}>Streaming...</Text>
          <Text style={styles.resultText}>{streamingResponse}</Text>
        </View>
      )}

      {response && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultTitle}>Response:</Text>
          <Text style={styles.resultText}>{response}</Text>
        </View>
      )}
    </>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('foundationmodels');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Expo Foundation Models</Text>
      <Text style={styles.subtitle}>
        {Platform.OS === 'ios' ? 'iOS' : 'Android (Not Supported)'}
      </Text>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'coreml' && styles.tabActive]}
          onPress={() => setActiveTab('coreml')}
        >
          <Text style={[styles.tabText, activeTab === 'coreml' && styles.tabTextActive]}>
            CoreML
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'foundationmodels' && styles.tabActive]}
          onPress={() => setActiveTab('foundationmodels')}
        >
          <Text style={[styles.tabText, activeTab === 'foundationmodels' && styles.tabTextActive]}>
            Foundation Models
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'coreml' ? <CoreMLDemo /> : <FoundationModelsDemo />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    color: '#666',
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    borderRadius: 10,
    backgroundColor: '#e0e0e0',
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#fff',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#007AFF',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  statusLabel: {
    fontSize: 16,
    color: '#333',
    marginRight: 8,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  loaded: {
    color: '#34C759',
  },
  notLoaded: {
    color: '#8E8E93',
  },
  textInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  buttonContainer: {
    gap: 12,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonSecondary: {
    backgroundColor: '#5856D6',
  },
  buttonDanger: {
    backgroundColor: '#FF3B30',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  errorContainer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
  },
  errorText: {
    color: '#C62828',
    fontSize: 14,
  },
  resultContainer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 8,
  },
  resultText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    color: '#1B5E20',
  },
});
