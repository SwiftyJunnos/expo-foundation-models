import { Platform } from 'react-native';
import { FoundationModels, FoundationModelsError } from '../index';
import type {
  FeedbackSentiment,
  FeedbackIssueCategory,
  FeedbackIssue,
  FeedbackOptions,
  FeedbackResult,
} from '../ExpoFoundationModels.types';
import ExpoFoundationModelsModule from '../ExpoFoundationModelsModule';

// Get the mocked module
const mockModule = ExpoFoundationModelsModule as jest.Mocked<typeof ExpoFoundationModelsModule> & {
  logFeedback: jest.Mock;
};

describe('FoundationModels - Feedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = 'ios';
  });

  describe('logFeedback', () => {
    it('should log positive feedback successfully', async () => {
      const mockResult: FeedbackResult = {
        success: true,
        feedbackAttachment: 'base64encodeddata==',
      };
      mockModule.logFeedback.mockResolvedValue(mockResult);

      const result = await FoundationModels.logFeedback('session-123', {
        sentiment: 'positive',
      });

      expect(mockModule.logFeedback).toHaveBeenCalledWith('session-123', {
        sentiment: 'positive',
      });
      expect(result.success).toBe(true);
      expect(result.feedbackAttachment).toBe('base64encodeddata==');
    });

    it('should log neutral feedback successfully', async () => {
      const mockResult: FeedbackResult = {
        success: true,
        feedbackAttachment: 'neutralfeedback==',
      };
      mockModule.logFeedback.mockResolvedValue(mockResult);

      const result = await FoundationModels.logFeedback('session-123', {
        sentiment: 'neutral',
      });

      expect(mockModule.logFeedback).toHaveBeenCalledWith('session-123', {
        sentiment: 'neutral',
      });
      expect(result.success).toBe(true);
    });

    it('should log negative feedback with issues', async () => {
      const mockResult: FeedbackResult = {
        success: true,
        feedbackAttachment: 'negativefeedback==',
      };
      mockModule.logFeedback.mockResolvedValue(mockResult);

      const options: FeedbackOptions = {
        sentiment: 'negative',
        issues: [
          { category: 'incorrect', explanation: 'Wrong date provided' },
          { category: 'tooVerbose' },
        ],
      };

      const result = await FoundationModels.logFeedback('session-123', options);

      expect(mockModule.logFeedback).toHaveBeenCalledWith('session-123', options);
      expect(result.success).toBe(true);
    });

    it('should log feedback with desired response', async () => {
      const mockResult: FeedbackResult = {
        success: true,
        feedbackAttachment: 'withdesired==',
      };
      mockModule.logFeedback.mockResolvedValue(mockResult);

      const options: FeedbackOptions = {
        sentiment: 'negative',
        issues: [{ category: 'incorrect' }],
        desiredResponse: 'The correct answer is 42',
      };

      const result = await FoundationModels.logFeedback('session-123', options);

      expect(mockModule.logFeedback).toHaveBeenCalledWith('session-123', options);
      expect(result.success).toBe(true);
    });

    it('should throw error when session ID is empty', async () => {
      await expect(
        FoundationModels.logFeedback('', { sentiment: 'positive' })
      ).rejects.toThrow(FoundationModelsError);

      try {
        await FoundationModels.logFeedback('', { sentiment: 'positive' });
      } catch (e) {
        expect(e).toBeInstanceOf(FoundationModelsError);
        expect((e as FoundationModelsError).type).toBe('sessionNotFound');
      }
    });

    it('should throw error when session not found', async () => {
      mockModule.logFeedback.mockRejectedValue(new Error('Session not found'));

      await expect(
        FoundationModels.logFeedback('invalid-session', { sentiment: 'positive' })
      ).rejects.toThrow(FoundationModelsError);
    });

    it('should throw error on non-iOS platform', async () => {
      (Platform as any).OS = 'android';

      await expect(
        FoundationModels.logFeedback('session-123', { sentiment: 'positive' })
      ).rejects.toThrow(FoundationModelsError);

      try {
        await FoundationModels.logFeedback('session-123', { sentiment: 'positive' });
      } catch (e) {
        expect(e).toBeInstanceOf(FoundationModelsError);
        expect((e as FoundationModelsError).type).toBe('notAvailable');
      }
    });
  });

  describe('logFeedback with all issue categories', () => {
    const issueCategories: FeedbackIssueCategory[] = [
      'incorrect',
      'didNotFollowInstructions',
      'tooVerbose',
      'unhelpful',
      'stereotypeOrBias',
      'suggestiveOrSexual',
      'vulgarOrOffensive',
      'triggeredGuardrailUnexpectedly',
    ];

    issueCategories.forEach((category) => {
      it(`should log feedback with ${category} issue`, async () => {
        const mockResult: FeedbackResult = { success: true };
        mockModule.logFeedback.mockResolvedValue(mockResult);

        const options: FeedbackOptions = {
          sentiment: 'negative',
          issues: [{ category }],
        };

        const result = await FoundationModels.logFeedback('session-123', options);

        expect(mockModule.logFeedback).toHaveBeenCalledWith('session-123', options);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('logFeedback with issue explanations', () => {
    it('should log feedback with issue explanation', async () => {
      const mockResult: FeedbackResult = { success: true };
      mockModule.logFeedback.mockResolvedValue(mockResult);

      const issue: FeedbackIssue = {
        category: 'incorrect',
        explanation: 'The model said Paris is in Germany, but it is in France',
      };

      const result = await FoundationModels.logFeedback('session-123', {
        sentiment: 'negative',
        issues: [issue],
      });

      expect(result.success).toBe(true);
    });

    it('should log feedback with multiple issues with explanations', async () => {
      const mockResult: FeedbackResult = { success: true };
      mockModule.logFeedback.mockResolvedValue(mockResult);

      const issues: FeedbackIssue[] = [
        { category: 'incorrect', explanation: 'Wrong factual information' },
        { category: 'tooVerbose', explanation: 'Repeated the same point 3 times' },
        { category: 'didNotFollowInstructions' }, // No explanation
      ];

      const result = await FoundationModels.logFeedback('session-123', {
        sentiment: 'negative',
        issues,
      });

      expect(result.success).toBe(true);
    });
  });
});

describe('FeedbackSentiment Type', () => {
  it('should support positive sentiment', () => {
    const sentiment: FeedbackSentiment = 'positive';
    expect(sentiment).toBe('positive');
  });

  it('should support neutral sentiment', () => {
    const sentiment: FeedbackSentiment = 'neutral';
    expect(sentiment).toBe('neutral');
  });

  it('should support negative sentiment', () => {
    const sentiment: FeedbackSentiment = 'negative';
    expect(sentiment).toBe('negative');
  });
});

describe('FeedbackIssueCategory Type', () => {
  it('should support all issue categories', () => {
    const categories: FeedbackIssueCategory[] = [
      'incorrect',
      'didNotFollowInstructions',
      'tooVerbose',
      'unhelpful',
      'stereotypeOrBias',
      'suggestiveOrSexual',
      'vulgarOrOffensive',
      'triggeredGuardrailUnexpectedly',
    ];

    expect(categories).toHaveLength(8);
    categories.forEach((cat) => {
      expect(typeof cat).toBe('string');
    });
  });
});

describe('FeedbackIssue Type', () => {
  it('should support issue with only category', () => {
    const issue: FeedbackIssue = {
      category: 'incorrect',
    };
    expect(issue.category).toBe('incorrect');
    expect(issue.explanation).toBeUndefined();
  });

  it('should support issue with category and explanation', () => {
    const issue: FeedbackIssue = {
      category: 'tooVerbose',
      explanation: 'The response was unnecessarily long',
    };
    expect(issue.category).toBe('tooVerbose');
    expect(issue.explanation).toBe('The response was unnecessarily long');
  });
});

describe('FeedbackOptions Type', () => {
  it('should support options with only sentiment', () => {
    const options: FeedbackOptions = {
      sentiment: 'positive',
    };
    expect(options.sentiment).toBe('positive');
    expect(options.issues).toBeUndefined();
    expect(options.desiredResponse).toBeUndefined();
  });

  it('should support options with sentiment and issues', () => {
    const options: FeedbackOptions = {
      sentiment: 'negative',
      issues: [{ category: 'incorrect' }],
    };
    expect(options.sentiment).toBe('negative');
    expect(options.issues).toHaveLength(1);
  });

  it('should support options with all fields', () => {
    const options: FeedbackOptions = {
      sentiment: 'negative',
      issues: [
        { category: 'incorrect', explanation: 'Wrong info' },
        { category: 'unhelpful' },
      ],
      desiredResponse: 'This is what the response should have been',
    };
    expect(options.sentiment).toBe('negative');
    expect(options.issues).toHaveLength(2);
    expect(options.desiredResponse).toBe('This is what the response should have been');
  });
});

describe('FeedbackResult Type', () => {
  it('should support result with success only', () => {
    const result: FeedbackResult = {
      success: true,
    };
    expect(result.success).toBe(true);
    expect(result.feedbackAttachment).toBeUndefined();
  });

  it('should support result with feedback attachment', () => {
    const result: FeedbackResult = {
      success: true,
      feedbackAttachment: 'SGVsbG8gV29ybGQ=',
    };
    expect(result.success).toBe(true);
    expect(result.feedbackAttachment).toBe('SGVsbG8gV29ybGQ=');
  });

  it('should support failed result', () => {
    const result: FeedbackResult = {
      success: false,
    };
    expect(result.success).toBe(false);
  });
});
