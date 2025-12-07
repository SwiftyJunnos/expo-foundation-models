# Feedback

Log feedback about response quality for analytics and improvement.

## Overview

The Feedback API allows you to:
- Record user satisfaction with responses
- Report specific issues
- Suggest better responses
- Generate feedback attachments for bug reports

## Basic Usage

### Positive Feedback

```typescript
import { FoundationModels } from 'expo-foundation-models';

await FoundationModels.logFeedback(sessionId, {
  sentiment: 'positive',
});
```

### Neutral Feedback

```typescript
await FoundationModels.logFeedback(sessionId, {
  sentiment: 'neutral',
});
```

### Negative Feedback

```typescript
await FoundationModels.logFeedback(sessionId, {
  sentiment: 'negative',
});
```

## Reporting Issues

Provide details about what went wrong.

### With Issues

```typescript
await FoundationModels.logFeedback(sessionId, {
  sentiment: 'negative',
  issues: [
    { category: 'incorrect' },
    { category: 'tooVerbose' },
  ],
});
```

### With Explanations

```typescript
await FoundationModels.logFeedback(sessionId, {
  sentiment: 'negative',
  issues: [
    { 
      category: 'incorrect', 
      explanation: 'The date mentioned was wrong. The event happened in 2020, not 2019.' 
    },
    { 
      category: 'didNotFollowInstructions', 
      explanation: 'I asked for a short answer but got a long explanation.' 
    },
  ],
});
```

## Issue Categories

| Category | Description |
|----------|-------------|
| `incorrect` | Factual errors or wrong information |
| `didNotFollowInstructions` | Didn't follow user's instructions |
| `tooVerbose` | Unnecessarily long or repetitive |
| `unhelpful` | Didn't address user's needs |
| `stereotypeOrBias` | Contains stereotypes or bias |
| `suggestiveOrSexual` | Suggestive or sexual content |
| `vulgarOrOffensive` | Vulgar or offensive content |
| `triggeredGuardrailUnexpectedly` | Safety filter triggered incorrectly |

## Desired Response

Suggest what the response should have been:

```typescript
await FoundationModels.logFeedback(sessionId, {
  sentiment: 'negative',
  issues: [
    { category: 'incorrect', explanation: 'Wrong capital city' },
  ],
  desiredResponse: 'The capital of Australia is Canberra, not Sydney.',
});
```

## Feedback Result

The result includes a serialized feedback attachment:

```typescript
const result = await FoundationModels.logFeedback(sessionId, {
  sentiment: 'negative',
  issues: [{ category: 'incorrect' }],
});

console.log(result);
// {
//   success: true,
//   feedbackAttachment: "base64encodeddata..."
// }
```

### Using the Attachment

The attachment can be included in bug reports:

```typescript
if (result.success && result.feedbackAttachment) {
  // Save for bug report
  await saveFeedbackAttachment(result.feedbackAttachment);
  
  // Or send to your analytics
  await sendToAnalytics({
    type: 'model_feedback',
    attachment: result.feedbackAttachment,
  });
}
```

## Complete Example

### Feedback UI Component

```typescript
import { useState } from 'react';
import { View, TouchableOpacity, Text, TextInput } from 'react-native';
import { FoundationModels, type FeedbackIssueCategory } from 'expo-foundation-models';

interface FeedbackProps {
  sessionId: string;
  onSubmit: () => void;
}

function FeedbackForm({ sessionId, onSubmit }: FeedbackProps) {
  const [sentiment, setSentiment] = useState<'positive' | 'neutral' | 'negative' | null>(null);
  const [selectedIssues, setSelectedIssues] = useState<FeedbackIssueCategory[]>([]);
  const [explanation, setExplanation] = useState('');
  const [desiredResponse, setDesiredResponse] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const issueOptions: { value: FeedbackIssueCategory; label: string }[] = [
    { value: 'incorrect', label: 'Incorrect information' },
    { value: 'didNotFollowInstructions', label: 'Didn\'t follow instructions' },
    { value: 'tooVerbose', label: 'Too long/verbose' },
    { value: 'unhelpful', label: 'Not helpful' },
  ];

  const handleSubmit = async () => {
    if (!sentiment) return;
    
    setIsSubmitting(true);
    
    try {
      await FoundationModels.logFeedback(sessionId, {
        sentiment,
        issues: selectedIssues.map((category) => ({
          category,
          explanation: explanation || undefined,
        })),
        desiredResponse: desiredResponse || undefined,
      });
      
      onSubmit();
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View>
      {/* Sentiment buttons */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {(['positive', 'neutral', 'negative'] as const).map((s) => (
          <TouchableOpacity
            key={s}
            onPress={() => setSentiment(s)}
            style={{
              padding: 10,
              backgroundColor: sentiment === s ? '#007AFF' : '#ddd',
              borderRadius: 8,
            }}
          >
            <Text style={{ color: sentiment === s ? '#fff' : '#333' }}>
              {s === 'positive' ? '👍' : s === 'negative' ? '👎' : '😐'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Issue checkboxes (shown for negative) */}
      {sentiment === 'negative' && (
        <View style={{ marginTop: 16 }}>
          <Text>What went wrong?</Text>
          {issueOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              onPress={() => {
                setSelectedIssues((prev) =>
                  prev.includes(option.value)
                    ? prev.filter((i) => i !== option.value)
                    : [...prev, option.value]
                );
              }}
              style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderWidth: 1,
                  borderRadius: 4,
                  backgroundColor: selectedIssues.includes(option.value)
                    ? '#007AFF'
                    : '#fff',
                }}
              />
              <Text style={{ marginLeft: 8 }}>{option.label}</Text>
            </TouchableOpacity>
          ))}

          <TextInput
            placeholder="More details (optional)"
            value={explanation}
            onChangeText={setExplanation}
            style={{ marginTop: 16, borderWidth: 1, padding: 10, borderRadius: 8 }}
            multiline
          />

          <TextInput
            placeholder="What should it have said? (optional)"
            value={desiredResponse}
            onChangeText={setDesiredResponse}
            style={{ marginTop: 8, borderWidth: 1, padding: 10, borderRadius: 8 }}
            multiline
          />
        </View>
      )}

      <TouchableOpacity
        onPress={handleSubmit}
        disabled={!sentiment || isSubmitting}
        style={{
          marginTop: 16,
          padding: 12,
          backgroundColor: sentiment ? '#007AFF' : '#ccc',
          borderRadius: 8,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#fff' }}>
          {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
```

## Analytics Integration

Track feedback in your analytics:

```typescript
async function submitFeedbackWithAnalytics(
  sessionId: string,
  sentiment: 'positive' | 'neutral' | 'negative',
  issues?: Array<{ category: string; explanation?: string }>
) {
  const result = await FoundationModels.logFeedback(sessionId, {
    sentiment,
    issues,
  });

  // Send to your analytics service
  await analytics.track('model_feedback', {
    sentiment,
    issues: issues?.map((i) => i.category),
    hasExplanation: issues?.some((i) => i.explanation),
    success: result.success,
  });

  return result;
}
```

## Best Practices

1. **Make feedback easy** - Simple thumbs up/down for quick feedback
2. **Optional details** - Don't require explanations for every feedback
3. **Context matters** - Log feedback close to the response
4. **Track patterns** - Analyze feedback to improve prompts
5. **Save attachments** - Keep for debugging issues

## Next Steps

- [CoreML](./coreml.md) - Custom ML models
- [Error Handling](./error-handling.md) - Handle errors
