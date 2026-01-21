/**
 * Codex Review Settings Utility
 *
 * Manages settings for AI-powered plan review via VibeProxy.
 * Uses cookies for persistence across random port hook invocations.
 */

import { storage } from './storage';

const STORAGE_KEY_ENABLED = 'plannotator-codex-enabled';
const STORAGE_KEY_MODEL = 'plannotator-codex-model';
const STORAGE_KEY_PROMPT = 'plannotator-codex-prompt';
const STORAGE_KEY_PROXY_URL = 'plannotator-codex-proxy-url';
const STORAGE_KEY_MAX_TURNS = 'plannotator-codex-max-turns';

const DEFAULT_PROXY_URL = 'http://localhost:8317';
const DEFAULT_MODEL = 'gpt-5-codex';
const DEFAULT_MAX_TURNS = 10;
const DEFAULT_PROMPT = `You are reviewing an implementation plan for a software project. Analyze the plan and provide constructive feedback on:

1. **Completeness**: Are there missing steps or considerations?
2. **Feasibility**: Are there any steps that seem unrealistic or overly complex?
3. **Risks**: What potential issues or edge cases should be addressed?
4. **Clarity**: Are any sections ambiguous or need more detail?

Keep your response concise and actionable. Focus on the most important improvements.`;

const AGENT_SYSTEM_PROMPT = `You are an AI code reviewer with access to the project's codebase. You have tools to explore the code.

## Your Task
Review the implementation plan provided below. Use your tools to understand the codebase and provide informed feedback.

## Available Tools
- **read_file(path)**: Read a file's contents. Use this to understand existing code that the plan will modify.
- **list_directory(path)**: List directory contents. Use '.' for root. Good for understanding project structure.
- **search_code(pattern, glob?)**: Search for patterns like grep. Find where functions/classes are used.

## Review Process
1. First, explore the project structure with list_directory
2. Read files mentioned in the plan or related to it
3. Search for existing patterns the plan should follow
4. Provide feedback based on what you learned

## Feedback Focus
- Does the plan align with existing code patterns and architecture?
- Are there existing utilities or patterns the plan should reuse?
- What files will likely need changes that aren't mentioned?
- Are there risks or edge cases based on how the current code works?

Be concise and reference specific files/code you found. Keep exploration focused - don't read files unrelated to the plan.`;

export interface CodexReviewSettings {
  enabled: boolean;
  proxyUrl: string;
  model: string;
  customPrompt: string;
  maxTurns: number;
}

export const FALLBACK_MODEL_OPTIONS = [
  { value: 'gpt-5-codex', label: 'GPT-5 Codex' },
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
];

export interface ModelOption {
  value: string;
  label: string;
}

export const fetchAvailableModels = async (proxyUrl: string): Promise<ModelOption[]> => {
  try {
    const response = await fetch(`${proxyUrl}/v1/models`);
    if (!response.ok) return FALLBACK_MODEL_OPTIONS;

    const data = await response.json();
    if (!data.data || !Array.isArray(data.data)) return FALLBACK_MODEL_OPTIONS;

    return data.data.map((model: { id: string; owned_by?: string }) => ({
      value: model.id,
      label: model.id,
    }));
  } catch {
    return FALLBACK_MODEL_OPTIONS;
  }
};

export const getCodexReviewSettings = (): CodexReviewSettings => ({
  enabled: storage.getItem(STORAGE_KEY_ENABLED) === 'true',
  proxyUrl: storage.getItem(STORAGE_KEY_PROXY_URL) || DEFAULT_PROXY_URL,
  model: storage.getItem(STORAGE_KEY_MODEL) || DEFAULT_MODEL,
  customPrompt: storage.getItem(STORAGE_KEY_PROMPT) || DEFAULT_PROMPT,
  maxTurns: parseInt(storage.getItem(STORAGE_KEY_MAX_TURNS) || '', 10) || DEFAULT_MAX_TURNS,
});

export const saveCodexReviewSettings = (settings: Partial<CodexReviewSettings>): void => {
  if (settings.enabled !== undefined) {
    storage.setItem(STORAGE_KEY_ENABLED, String(settings.enabled));
  }
  if (settings.proxyUrl !== undefined) {
    storage.setItem(STORAGE_KEY_PROXY_URL, settings.proxyUrl);
  }
  if (settings.model !== undefined) {
    storage.setItem(STORAGE_KEY_MODEL, settings.model);
  }
  if (settings.customPrompt !== undefined) {
    storage.setItem(STORAGE_KEY_PROMPT, settings.customPrompt);
  }
  if (settings.maxTurns !== undefined) {
    storage.setItem(STORAGE_KEY_MAX_TURNS, String(settings.maxTurns));
  }
};

export const getDefaultPrompt = (): string => DEFAULT_PROMPT;

export const getAgentSystemPrompt = (): string => AGENT_SYSTEM_PROMPT;
