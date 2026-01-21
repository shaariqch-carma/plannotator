import { useState, useCallback } from 'react';
import { getCodexReviewSettings } from '../utils/codexReview';
import { exportDiff } from '../utils/parser';
import type { Annotation, Block } from '../types';

export interface UseCodexReviewResult {
  isReviewing: boolean;
  error: string | null;
  reviewPlan: (markdown: string, blocks: Block[], annotations: Annotation[], globalAttachments?: string[]) => Promise<string | null>;
}

export const useCodexReview = (): UseCodexReviewResult => {
  const [isReviewing, setIsReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reviewPlan = useCallback(async (
    markdown: string,
    blocks: Block[],
    annotations: Annotation[],
    globalAttachments: string[] = []
  ): Promise<string | null> => {
    const settings = getCodexReviewSettings();

    setIsReviewing(true);
    setError(null);

    try {
      let userContent = `## Plan to Review\n\n${markdown}`;

      if (annotations.length > 0 || globalAttachments.length > 0) {
        const existingFeedback = exportDiff(blocks, annotations, globalAttachments);
        userContent += `\n\n## Existing User Annotations\n\n${existingFeedback}`;
      }

      const response = await fetch(`${settings.proxyUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: settings.model,
          messages: [
            { role: 'system', content: settings.customPrompt },
            { role: 'user', content: userContent },
          ],
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API error: ${response.status}`);
      }

      const data = await response.json();
      const reviewText = data.choices?.[0]?.message?.content;

      if (!reviewText) {
        throw new Error('No response received from model');
      }

      return reviewText;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Review failed';
      setError(message);
      return null;
    } finally {
      setIsReviewing(false);
    }
  }, []);

  return {
    isReviewing,
    error,
    reviewPlan,
  };
};
