import { useState, useCallback } from 'react';
import { getCodexReviewSettings, getAgentSystemPrompt } from '../utils/codexReview';
import { exportDiff } from '../utils/parser';
import { REVIEW_AGENT_TOOLS, formatToolResult, type ToolCall } from '../utils/agentTools';
import type { Annotation, Block } from '../types';

export interface ProgressEntry {
  type: 'tool_call' | 'tool_result' | 'thinking' | 'complete';
  message: string;
  timestamp: number;
}

export interface UseCodexReviewResult {
  isReviewing: boolean;
  progress: ProgressEntry[];
  error: string | null;
  reviewPlan: (markdown: string, blocks: Block[], annotations: Annotation[], globalAttachments?: string[]) => Promise<string | null>;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      role: 'assistant';
      content?: string | null;
      tool_calls?: ToolCall[];
    };
    finish_reason: string;
  }>;
}

const executeToolCall = async (toolCall: ToolCall): Promise<string> => {
  const { name, arguments: argsStr } = toolCall.function;

  let args: Record<string, string>;
  try {
    args = JSON.parse(argsStr);
  } catch {
    return `Error: Invalid arguments - ${argsStr}`;
  }

  try {
    switch (name) {
      case 'read_file': {
        const res = await fetch(`/api/codebase/read?path=${encodeURIComponent(args.path)}`);
        const data = await res.json();
        if (data.error) return `Error: ${data.error}`;
        return data.content;
      }
      case 'list_directory': {
        const res = await fetch(`/api/codebase/list?path=${encodeURIComponent(args.path || '.')}`);
        const data = await res.json();
        if (data.error) return `Error: ${data.error}`;
        const entries = data.entries as Array<{ name: string; type: string }>;
        return entries
          .map((e) => `${e.type === 'directory' ? '📁' : '📄'} ${e.name}`)
          .join('\n');
      }
      case 'search_code': {
        const params = new URLSearchParams({ pattern: args.pattern });
        if (args.glob) params.set('glob', args.glob);
        const res = await fetch(`/api/codebase/search?${params}`);
        const data = await res.json();
        if (data.error) return `Error: ${data.error}`;
        const results = data.results as Array<{ file: string; line: number; content: string }>;
        if (results.length === 0) return 'No matches found';
        return results
          .map((r) => `${r.file}:${r.line}: ${r.content}`)
          .join('\n');
      }
      default:
        return `Error: Unknown tool ${name}`;
    }
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : 'Tool execution failed'}`;
  }
};

export const useCodexReview = (): UseCodexReviewResult => {
  const [isReviewing, setIsReviewing] = useState(false);
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const addProgress = (type: ProgressEntry['type'], message: string) => {
    setProgress((prev) => [...prev, { type, message, timestamp: Date.now() }]);
  };

  const reviewPlan = useCallback(async (
    markdown: string,
    blocks: Block[],
    annotations: Annotation[],
    globalAttachments: string[] = []
  ): Promise<string | null> => {
    const settings = getCodexReviewSettings();

    setIsReviewing(true);
    setProgress([]);
    setError(null);

    try {
      let userContent = `## Plan to Review\n\n${markdown}`;

      if (annotations.length > 0 || globalAttachments.length > 0) {
        const existingFeedback = exportDiff(blocks, annotations, globalAttachments);
        userContent += `\n\n## Existing User Annotations\n\n${existingFeedback}`;
      }

      const messages: ChatMessage[] = [
        { role: 'system', content: getAgentSystemPrompt() },
        { role: 'user', content: userContent },
      ];

      addProgress('thinking', 'Starting codebase analysis...');

      for (let turn = 0; turn < settings.maxTurns; turn++) {
        const response = await fetch(`${settings.proxyUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: settings.model,
            messages,
            tools: REVIEW_AGENT_TOOLS,
            tool_choice: 'auto',
            max_tokens: 4000,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || `API error: ${response.status}`);
        }

        const data: ChatCompletionResponse = await response.json();
        const assistantMessage = data.choices?.[0]?.message;

        if (!assistantMessage) {
          throw new Error('No response received from model');
        }

        if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
          addProgress('complete', 'Review complete');
          return assistantMessage.content || null;
        }

        messages.push({
          role: 'assistant',
          content: assistantMessage.content,
          tool_calls: assistantMessage.tool_calls,
        });

        for (const toolCall of assistantMessage.tool_calls) {
          const args = JSON.parse(toolCall.function.arguments);
          const toolName = toolCall.function.name;

          let progressMessage = '';
          if (toolName === 'read_file') {
            progressMessage = `Reading ${args.path}`;
          } else if (toolName === 'list_directory') {
            progressMessage = `Listing ${args.path || '.'}`;
          } else if (toolName === 'search_code') {
            progressMessage = `Searching for "${args.pattern}"${args.glob ? ` in ${args.glob}` : ''}`;
          }
          addProgress('tool_call', progressMessage);

          const result = await executeToolCall(toolCall);
          const toolResult = formatToolResult(toolCall.id, result);

          addProgress('tool_result', result.startsWith('Error:') ? result : 'Done');

          messages.push({
            role: 'tool',
            tool_call_id: toolResult.tool_call_id,
            content: toolResult.content,
          });
        }
      }

      throw new Error('Agent exceeded maximum turns without completing review');
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
    progress,
    error,
    reviewPlan,
  };
};
