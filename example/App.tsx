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
import { SafeAreaView } from 'react-native';
import {
  CoreML,
  CoreMLError,
  FoundationModels,
  FoundationModelsError,
  type TranscriptEntry,
  type FeedbackOptions,
} from 'expo-foundation-models';

// Demo tabs
type Tab = 'basic' | 'structured' | 'tools' | 'session' | 'feedback' | 'coreml';

// Shared session state
let globalSessionId: string | null = null;

// ============================================================================
// Basic Demo - Text generation and streaming
// ============================================================================
function BasicDemo() {
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState('Write a haiku about coding.');
  const [response, setResponse] = useState<string | null>(null);
  const [streamingResponse, setStreamingResponse] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sessionActive, setSessionActive] = useState(!!globalSessionId);

  const createSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      globalSessionId = await FoundationModels.createSession({
        instructions: 'You are a helpful, creative assistant.',
        guardrails: 'default',
        useCase: 'general',
      });
      setSessionActive(true);
    } catch (err) {
      setError(err instanceof FoundationModelsError ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const generateResponse = useCallback(async () => {
    if (!globalSessionId) return;
    setLoading(true);
    setError(null);
    setResponse(null);
    setStreamingResponse('');

    try {
      const result = await FoundationModels.respond(globalSessionId, prompt, {
        temperature: 1.0,
        sampling: { type: 'topP', probabilityThreshold: 0.9 },
        maximumResponseTokens: 500,
      });
      setResponse(result);
    } catch (err) {
      if (err instanceof FoundationModelsError) {
        if (err.isGuardrailViolation()) {
          setError('Content blocked by safety filters');
        } else if (err.isRefusal()) {
          setError(`Model refused: ${err.refusalExplanation || 'No reason given'}`);
        } else {
          setError(err.message);
        }
      } else {
        setError(String(err));
      }
    } finally {
      setLoading(false);
    }
  }, [prompt]);

  const streamResponse = useCallback(async () => {
    if (!globalSessionId) return;
    setLoading(true);
    setError(null);
    setResponse(null);
    setStreamingResponse('');

    try {
      await FoundationModels.streamResponse(
        globalSessionId,
        prompt,
        (token) => setStreamingResponse((prev) => prev + token),
        { temperature: 1.0, maximumResponseTokens: 500 }
      );
    } catch (err) {
      setError(err instanceof FoundationModelsError ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [prompt]);

  const closeSession = useCallback(async () => {
    if (!globalSessionId) return;
    try {
      await FoundationModels.closeSession(globalSessionId);
      globalSessionId = null;
      setSessionActive(false);
      setResponse(null);
      setStreamingResponse('');
    } catch (err) {
      setError(err instanceof FoundationModelsError ? err.message : String(err));
    }
  }, []);

  return (
    <>
      <StatusBadge label="Session" active={sessionActive} />

      <TextInput
        style={styles.textInput}
        value={prompt}
        onChangeText={setPrompt}
        placeholder="Enter your prompt..."
        multiline
      />

      <View style={styles.buttonRow}>
        {!sessionActive ? (
          <Button title="Create Session" onPress={createSession} disabled={loading} />
        ) : (
          <>
            <Button title="Generate" onPress={generateResponse} disabled={loading} />
            <Button title="Stream" onPress={streamResponse} disabled={loading} color="#5856D6" />
            <Button title="Close" onPress={closeSession} disabled={loading} color="#FF3B30" />
          </>
        )}
      </View>

      {loading && <ActivityIndicator style={styles.loader} size="large" color="#007AFF" />}
      {error && <ErrorBox message={error} />}
      {streamingResponse && !response && <ResultBox title="Streaming..." content={streamingResponse} />}
      {response && <ResultBox title="Response" content={response} />}
    </>
  );
}

// ============================================================================
// Structured Output Demo - JSON Schema and Choices
// ============================================================================
function StructuredDemo() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generatePerson = useCallback(async () => {
    if (!globalSessionId) {
      setError('Create a session first (Basic tab)');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const person = await FoundationModels.respondWithSchema(
        globalSessionId,
        'Generate a fictional character profile for a fantasy RPG game.',
        {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Character name' },
            class: { type: 'string', description: 'Character class (e.g., Warrior, Mage)' },
            level: { type: 'integer', description: 'Character level (1-100)' },
            skills: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of skills',
            },
            stats: {
              type: 'object',
              properties: {
                strength: { type: 'integer' },
                intelligence: { type: 'integer' },
                agility: { type: 'integer' },
              },
            },
          },
          required: ['name', 'class', 'level'],
        }
      );
      setResult(person);
    } catch (err) {
      setError(err instanceof FoundationModelsError ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const classifySentiment = useCallback(async () => {
    if (!globalSessionId) {
      setError('Create a session first (Basic tab)');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const sentiment = await FoundationModels.respondWithChoices(
        globalSessionId,
        'Classify the sentiment of this review: "This product exceeded all my expectations! Absolutely love it!"',
        ['positive', 'negative', 'neutral']
      );
      setResult({ sentiment, explanation: 'The review expresses strong satisfaction.' });
    } catch (err) {
      setError(err instanceof FoundationModelsError ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <>
      <Text style={styles.sectionTitle}>JSON Schema Generation</Text>
      <Text style={styles.description}>
        Generate structured data conforming to a schema.
      </Text>

      <View style={styles.buttonRow}>
        <Button title="Generate Character" onPress={generatePerson} disabled={loading} />
        <Button title="Classify Sentiment" onPress={classifySentiment} disabled={loading} color="#5856D6" />
      </View>

      {loading && <ActivityIndicator style={styles.loader} size="large" color="#007AFF" />}
      {error && <ErrorBox message={error} />}
      {result && <ResultBox title="Result" content={JSON.stringify(result, null, 2)} />}
    </>
  );
}

// ============================================================================
// Tool Calling Demo
// ============================================================================
function ToolsDemo() {
  const [loading, setLoading] = useState(false);
  const [toolSessionId, setToolSessionId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const createToolSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    setConversation([]);

    try {
      const id = await FoundationModels.createSessionWithTools({
        instructions: 'You are a helpful assistant with access to tools.',
        tools: [
          {
            name: 'getWeather',
            description: 'Get current weather for a city',
            parameters: {
              type: 'object',
              properties: {
                city: { type: 'string', description: 'City name' },
                unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
              },
              required: ['city'],
            },
          },
          {
            name: 'calculate',
            description: 'Perform a mathematical calculation',
            parameters: {
              type: 'object',
              properties: {
                expression: { type: 'string', description: 'Math expression to evaluate' },
              },
              required: ['expression'],
            },
          },
        ],
      });
      setToolSessionId(id);
      setConversation(['[Session created with tools: getWeather, calculate]']);
    } catch (err) {
      setError(err instanceof FoundationModelsError ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const askAboutWeather = useCallback(async () => {
    if (!toolSessionId) return;
    setLoading(true);
    setError(null);

    try {
      setConversation((prev) => [...prev, 'User: What is the weather in Tokyo?']);

      const response = await FoundationModels.respondWithTools(toolSessionId, "What's the weather in Tokyo?");

      if (response.type === 'toolCall' && response.toolCall) {
        const { name, arguments: args, id } = response.toolCall;
        setConversation((prev) => [
          ...prev,
          `[Tool Call: ${name}(${JSON.stringify(args)})]`,
        ]);

        // Simulate tool execution
        const weatherData = { temperature: 22, condition: 'Partly Cloudy', humidity: 65 };
        setConversation((prev) => [...prev, `[Tool Result: ${JSON.stringify(weatherData)}]`]);

        // Submit result back
        const finalResponse = await FoundationModels.submitToolResult(toolSessionId, {
          callId: id,
          result: weatherData,
        });

        if (finalResponse.content) {
          setConversation((prev) => [...prev, `Assistant: ${finalResponse.content}`]);
        }
      } else if (response.content) {
        setConversation((prev) => [...prev, `Assistant: ${response.content}`]);
      }
    } catch (err) {
      setError(err instanceof FoundationModelsError ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [toolSessionId]);

  const askCalculation = useCallback(async () => {
    if (!toolSessionId) return;
    setLoading(true);
    setError(null);

    try {
      setConversation((prev) => [...prev, 'User: What is 15 * 7 + 23?']);

      const response = await FoundationModels.respondWithTools(
        toolSessionId,
        'Calculate: 15 * 7 + 23'
      );

      if (response.type === 'toolCall' && response.toolCall) {
        const { name, arguments: args, id } = response.toolCall;
        setConversation((prev) => [
          ...prev,
          `[Tool Call: ${name}(${JSON.stringify(args)})]`,
        ]);

        // Simulate calculation
        const result = { result: 128, expression: '15 * 7 + 23' };
        setConversation((prev) => [...prev, `[Tool Result: ${JSON.stringify(result)}]`]);

        const finalResponse = await FoundationModels.submitToolResult(toolSessionId, {
          callId: id,
          result,
        });

        if (finalResponse.content) {
          setConversation((prev) => [...prev, `Assistant: ${finalResponse.content}`]);
        }
      } else if (response.content) {
        setConversation((prev) => [...prev, `Assistant: ${response.content}`]);
      }
    } catch (err) {
      setError(err instanceof FoundationModelsError ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [toolSessionId]);

  return (
    <>
      <Text style={styles.sectionTitle}>Tool Calling</Text>
      <Text style={styles.description}>
        Let the model call functions you define.
      </Text>

      <StatusBadge label="Tool Session" active={!!toolSessionId} />

      <View style={styles.buttonRow}>
        {!toolSessionId ? (
          <Button title="Create Tool Session" onPress={createToolSession} disabled={loading} />
        ) : (
          <>
            <Button title="Ask Weather" onPress={askAboutWeather} disabled={loading} />
            <Button title="Calculate" onPress={askCalculation} disabled={loading} color="#5856D6" />
          </>
        )}
      </View>

      {loading && <ActivityIndicator style={styles.loader} size="large" color="#007AFF" />}
      {error && <ErrorBox message={error} />}

      {conversation.length > 0 && (
        <View style={styles.conversationBox}>
          {conversation.map((msg, i) => (
            <Text key={i} style={styles.conversationLine}>
              {msg}
            </Text>
          ))}
        </View>
      )}
    </>
  );
}

// ============================================================================
// Session Management Demo
// ============================================================================
function SessionDemo() {
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [prewarmed, setPrewarmed] = useState(false);

  const getTranscript = useCallback(async () => {
    if (!globalSessionId) {
      setError('Create a session first (Basic tab)');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const entries = await FoundationModels.getTranscript(globalSessionId);
      setTranscript(entries);
    } catch (err) {
      setError(err instanceof FoundationModelsError ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const prewarmSession = useCallback(async () => {
    if (!globalSessionId) {
      setError('Create a session first (Basic tab)');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      await FoundationModels.prewarm(globalSessionId, {
        promptPrefix: 'You are helping with programming tasks:',
      });
      setPrewarmed(true);
    } catch (err) {
      setError(err instanceof FoundationModelsError ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const resumeWithHistory = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const newSessionId = await FoundationModels.createSessionWithTranscript(
        [
          { type: 'prompt', content: 'What programming language should I learn first?' },
          { type: 'response', content: 'I recommend starting with Python. It has clean syntax and is great for beginners.' },
        ],
        'You are a programming mentor.'
      );
      globalSessionId = newSessionId;
      setTranscript([
        { type: 'prompt', content: 'What programming language should I learn first?' },
        { type: 'response', content: 'I recommend starting with Python. It has clean syntax and is great for beginners.' },
      ]);
    } catch (err) {
      setError(err instanceof FoundationModelsError ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <>
      <Text style={styles.sectionTitle}>Session Management</Text>
      <Text style={styles.description}>
        Access transcript, prewarm, and resume sessions.
      </Text>

      <View style={styles.statusRow}>
        <StatusBadge label="Session" active={!!globalSessionId} />
        <StatusBadge label="Prewarmed" active={prewarmed} />
      </View>

      <View style={styles.buttonRow}>
        <Button title="Get Transcript" onPress={getTranscript} disabled={loading} />
        <Button title="Prewarm" onPress={prewarmSession} disabled={loading} color="#5856D6" />
        <Button title="Resume History" onPress={resumeWithHistory} disabled={loading} color="#34C759" />
      </View>

      {loading && <ActivityIndicator style={styles.loader} size="large" color="#007AFF" />}
      {error && <ErrorBox message={error} />}

      {transcript.length > 0 && (
        <View style={styles.transcriptBox}>
          <Text style={styles.transcriptTitle}>Transcript ({transcript.length} entries)</Text>
          {transcript.map((entry, i) => (
            <View key={i} style={styles.transcriptEntry}>
              <Text style={styles.transcriptType}>{entry.type}</Text>
              <Text style={styles.transcriptContent}>
                {'content' in entry ? entry.content : JSON.stringify(entry)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </>
  );
}

// ============================================================================
// Feedback Demo
// ============================================================================
function FeedbackDemo() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submitFeedback = useCallback(async (sentiment: 'positive' | 'neutral' | 'negative') => {
    if (!globalSessionId) {
      setError('Create a session first (Basic tab)');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const options: FeedbackOptions = { sentiment };

      if (sentiment === 'negative') {
        options.issues = [
          { category: 'incorrect', explanation: 'The information was outdated' },
          { category: 'tooVerbose' },
        ];
        options.desiredResponse = 'A more concise and accurate response';
      }

      const feedbackResult = await FoundationModels.logFeedback(globalSessionId, options);

      if (feedbackResult.success) {
        const attachmentPreview = feedbackResult.feedbackAttachment
          ? `${feedbackResult.feedbackAttachment.slice(0, 50)}...`
          : 'N/A';
        setResult(`Feedback logged successfully!\n\nSentiment: ${sentiment}\nAttachment: ${attachmentPreview}`);
      }
    } catch (err) {
      setError(err instanceof FoundationModelsError ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <>
      <Text style={styles.sectionTitle}>Feedback & Analytics</Text>
      <Text style={styles.description}>
        Log feedback about response quality for improvement.
      </Text>

      <View style={styles.buttonRow}>
        <Button title="Positive" onPress={() => submitFeedback('positive')} disabled={loading} color="#34C759" />
        <Button title="Neutral" onPress={() => submitFeedback('neutral')} disabled={loading} color="#8E8E93" />
        <Button title="Negative" onPress={() => submitFeedback('negative')} disabled={loading} color="#FF3B30" />
      </View>

      {loading && <ActivityIndicator style={styles.loader} size="large" color="#007AFF" />}
      {error && <ErrorBox message={error} />}
      {result && <ResultBox title="Feedback Result" content={result} />}
    </>
  );
}

// ============================================================================
// CoreML Demo
// ============================================================================
function CoreMLDemo() {
  const [modelId, setModelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadModel = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const id = await CoreML.loadModel('ExampleClassifier');
      setModelId(id);
    } catch (err) {
      setError(err instanceof CoreMLError ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const runPrediction = useCallback(async () => {
    if (!modelId) return;
    setLoading(true);
    setError(null);
    try {
      const prediction = await CoreML.predict(modelId, {
        input: [1.0, 2.0, 3.0, 4.0],
      });
      setResult(prediction);
    } catch (err) {
      setError(err instanceof CoreMLError ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [modelId]);

  const unloadModel = useCallback(async () => {
    if (!modelId) return;
    try {
      await CoreML.unloadModel(modelId);
      setModelId(null);
      setResult(null);
    } catch (err) {
      setError(err instanceof CoreMLError ? err.message : String(err));
    }
  }, [modelId]);

  return (
    <>
      <Text style={styles.sectionTitle}>CoreML</Text>
      <Text style={styles.description}>
        Load and run CoreML models from your app bundle.
      </Text>

      <StatusBadge label="Model" active={!!modelId} />

      <View style={styles.buttonRow}>
        {!modelId ? (
          <Button title="Load Model" onPress={loadModel} disabled={loading} />
        ) : (
          <>
            <Button title="Predict" onPress={runPrediction} disabled={loading} />
            <Button title="Unload" onPress={unloadModel} disabled={loading} color="#FF3B30" />
          </>
        )}
      </View>

      {loading && <ActivityIndicator style={styles.loader} size="large" color="#007AFF" />}
      {error && <ErrorBox message={error} />}
      {result && <ResultBox title="Prediction" content={JSON.stringify(result, null, 2)} />}
    </>
  );
}

// ============================================================================
// Shared Components
// ============================================================================
function Button({ title, onPress, disabled, color = '#007AFF' }: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  color?: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: color }, disabled && styles.buttonDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </TouchableOpacity>
  );
}

function StatusBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <View style={styles.statusBadge}>
      <View style={[styles.statusDot, active ? styles.statusActive : styles.statusInactive]} />
      <Text style={styles.statusLabel}>{label}: {active ? 'Active' : 'Inactive'}</Text>
    </View>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

function ResultBox({ title, content }: { title: string; content: string }) {
  return (
    <View style={styles.resultBox}>
      <Text style={styles.resultTitle}>{title}</Text>
      <ScrollView style={styles.resultScroll} nestedScrollEnabled>
        <Text style={styles.resultText}>{content}</Text>
      </ScrollView>
    </View>
  );
}

// ============================================================================
// Main App
// ============================================================================
export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('basic');

  const isAvailable = Platform.OS === 'ios' && FoundationModels.isAvailable();
  const availability = FoundationModels.getAvailability();

  const tabs: { key: Tab; label: string }[] = [
    { key: 'basic', label: 'Basic' },
    { key: 'structured', label: 'Schema' },
    { key: 'tools', label: 'Tools' },
    { key: 'session', label: 'Session' },
    { key: 'feedback', label: 'Feedback' },
    { key: 'coreml', label: 'CoreML' },
  ];

  const renderContent = () => {
    if (!isAvailable && activeTab !== 'coreml') {
      return (
        <View style={styles.unavailableBox}>
          <Text style={styles.unavailableTitle}>Foundation Models Unavailable</Text>
          <Text style={styles.unavailableReason}>
            Reason: {availability.reason || 'Unknown'}
          </Text>
          <Text style={styles.unavailableHint}>
            Requires iOS 26+ with Apple Intelligence enabled.
          </Text>
        </View>
      );
    }

    switch (activeTab) {
      case 'basic':
        return <BasicDemo />;
      case 'structured':
        return <StructuredDemo />;
      case 'tools':
        return <ToolsDemo />;
      case 'session':
        return <SessionDemo />;
      case 'feedback':
        return <FeedbackDemo />;
      case 'coreml':
        return <CoreMLDemo />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>expo-foundation-models</Text>
        <Text style={styles.version}>v1.0.0</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
          <View style={styles.tabContainer}>
            {tabs.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {renderContent()}
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================================
// Styles
// ============================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#333',
  },
  version: {
    fontSize: 14,
    textAlign: 'center',
    color: '#888',
    marginBottom: 16,
  },
  tabScroll: {
    marginBottom: 20,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#e0e0e0',
    borderRadius: 10,
    padding: 4,
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#fff',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#007AFF',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  textInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    minHeight: 60,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusActive: {
    backgroundColor: '#34C759',
  },
  statusInactive: {
    backgroundColor: '#8E8E93',
  },
  statusLabel: {
    fontSize: 13,
    color: '#333',
  },
  loader: {
    marginVertical: 20,
  },
  errorBox: {
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  errorText: {
    color: '#C62828',
    fontSize: 14,
  },
  resultBox: {
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    maxHeight: 300,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 8,
  },
  resultScroll: {
    maxHeight: 250,
  },
  resultText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    color: '#1B5E20',
  },
  conversationBox: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  conversationLine: {
    fontSize: 13,
    color: '#333',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  transcriptBox: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  transcriptTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  transcriptEntry: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  transcriptType: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  transcriptContent: {
    fontSize: 13,
    color: '#333',
  },
  unavailableBox: {
    backgroundColor: '#FFF3E0',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  unavailableTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E65100',
    marginBottom: 8,
  },
  unavailableReason: {
    fontSize: 14,
    color: '#F57C00',
    marginBottom: 8,
  },
  unavailableHint: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
  },
});
