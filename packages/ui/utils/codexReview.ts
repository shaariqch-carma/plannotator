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

const DEFAULT_PROXY_URL = 'http://localhost:8317';
const DEFAULT_MODEL = 'gpt-4o';
const DEFAULT_PROMPT = `You are reviewing an implementation plan for a software project. Analyze the plan and provide constructive feedback on:

1. **Completeness**: Are there missing steps or considerations?
2. **Feasibility**: Are there any steps that seem unrealistic or overly complex?
3. **Risks**: What potential issues or edge cases should be addressed?
4. **Clarity**: Are any sections ambiguous or need more detail?

Keep your response concise and actionable. Focus on the most important improvements.`;

export interface CodexReviewSettings {
  enabled: boolean;
  proxyUrl: string;
  model: string;
  customPrompt: string;
}

export const CODEX_MODEL_OPTIONS = [
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
];

export const getCodexReviewSettings = (): CodexReviewSettings => ({
  enabled: storage.getItem(STORAGE_KEY_ENABLED) === 'true',
  proxyUrl: storage.getItem(STORAGE_KEY_PROXY_URL) || DEFAULT_PROXY_URL,
  model: storage.getItem(STORAGE_KEY_MODEL) || DEFAULT_MODEL,
  customPrompt: storage.getItem(STORAGE_KEY_PROMPT) || DEFAULT_PROMPT,
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
};

export const getDefaultPrompt = (): string => DEFAULT_PROMPT;
