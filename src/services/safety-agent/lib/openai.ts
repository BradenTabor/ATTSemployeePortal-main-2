/**
 * OpenAI Client for Safety + Compliance Agent
 * 
 * This client handles all LLM interactions for the safety-agent module.
 * Used primarily for generating safety announcements from JSA data.
 * 
 * Supports both Node.js and Deno (Supabase Edge Functions) runtimes.
 */

import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { safetyLogger } from './logger';

// =============================================================================
// TYPES
// =============================================================================

export interface OpenAIConfig {
  /** API key (defaults to OPENAI_API_KEY env var) */
  apiKey?: string;
  /** Model to use (defaults to gpt-4o-mini for cost efficiency) */
  model?: string;
  /** Max tokens for completion */
  maxTokens?: number;
  /** Temperature (0-2, lower = more deterministic) */
  temperature?: number;
}

export interface ChatCompletionOptions {
  /** System prompt */
  systemPrompt?: string;
  /** User message */
  userMessage: string;
  /** Optional model override */
  model?: string;
  /** Temperature override */
  temperature?: number;
  /** Max tokens override */
  maxTokens?: number;
  /** Response format (text or json_object) */
  responseFormat?: 'text' | 'json_object';
}

export interface ChatCompletionResult {
  success: boolean;
  content?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
  error?: string;
}

// =============================================================================
// ENVIRONMENT DETECTION
// =============================================================================

// Declare globals for cross-runtime compatibility
declare const Deno: { env: { get(key: string): string | undefined } } | undefined;
declare const process: { env?: Record<string, string | undefined> } | undefined;

const isDeno = typeof Deno !== 'undefined';

function getEnvVar(name: string): string | undefined {
  if (isDeno) {
    return Deno?.env.get(name);
  }
  if (typeof process !== 'undefined' && process?.env) {
    return process.env[name];
  }
  if (typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: Record<string, string> }).env) {
    return (import.meta as unknown as { env: Record<string, string> }).env[name];
  }
  return undefined;
}

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

const DEFAULT_MODEL = 'gpt-4o-mini'; // Cost-effective for structured outputs
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TEMPERATURE = 0.3; // Lower for more consistent outputs

// =============================================================================
// CLIENT MANAGEMENT
// =============================================================================

let openaiInstance: OpenAI | null = null;
let currentConfig: OpenAIConfig = {};

/**
 * Get or create the OpenAI client.
 * 
 * @param config Optional configuration overrides
 * @returns OpenAI client instance
 * @throws Error if API key is missing
 */
export function getOpenAIClient(config?: OpenAIConfig): OpenAI {
  const apiKey = config?.apiKey || getEnvVar('OPENAI_API_KEY');

  if (!apiKey) {
    throw new Error(
      'Missing OPENAI_API_KEY environment variable. ' +
      'Obtain an API key from https://platform.openai.com/account/api-keys'
    );
  }

  // Create new instance if config changed or not initialized
  if (!openaiInstance || config?.apiKey !== currentConfig.apiKey) {
    openaiInstance = new OpenAI({
      apiKey,
    });
    currentConfig = { ...config };
    safetyLogger.info('OpenAI client initialized');
  }

  return openaiInstance;
}

/**
 * Create a fresh OpenAI client with explicit API key.
 * Useful for testing or when you need isolated instances.
 * 
 * @param apiKey OpenAI API key
 * @returns New OpenAI client instance
 */
export function createOpenAIClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey });
}

// =============================================================================
// CHAT COMPLETION
// =============================================================================

/**
 * Send a chat completion request to OpenAI.
 * 
 * @param options Chat completion options
 * @param config Optional client configuration
 * @returns Chat completion result
 */
export async function chatCompletion(
  options: ChatCompletionOptions,
  config?: OpenAIConfig
): Promise<ChatCompletionResult> {
  const {
    systemPrompt,
    userMessage,
    model = config?.model || DEFAULT_MODEL,
    temperature = config?.temperature || DEFAULT_TEMPERATURE,
    maxTokens = config?.maxTokens || DEFAULT_MAX_TOKENS,
    responseFormat = 'text',
  } = options;

  try {
    const client = getOpenAIClient(config);

    const messages: ChatCompletionMessageParam[] = [];
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: userMessage });

    safetyLogger.info('Sending chat completion request', {
      model,
      temperature,
      maxTokens,
      responseFormat,
      messageCount: messages.length,
    });

    const response = await client.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      response_format: responseFormat === 'json_object' 
        ? { type: 'json_object' } 
        : { type: 'text' },
    });

    const content = response.choices[0]?.message?.content || '';
    const usage = response.usage;

    safetyLogger.info('Chat completion successful', {
      model: response.model,
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
      totalTokens: usage?.total_tokens,
    });

    return {
      success: true,
      content,
      usage: usage ? {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      } : undefined,
      model: response.model,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    safetyLogger.error('Chat completion failed', {
      error: errorMessage,
      model: options.model || config?.model || DEFAULT_MODEL,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

// =============================================================================
// STRUCTURED JSON COMPLETION
// =============================================================================

/**
 * Send a chat completion request expecting JSON output.
 * 
 * @param options Chat completion options
 * @param config Optional client configuration
 * @returns Parsed JSON result or error
 */
export async function jsonCompletion<T = unknown>(
  options: Omit<ChatCompletionOptions, 'responseFormat'>,
  config?: OpenAIConfig
): Promise<{ success: boolean; data?: T; raw?: string; usage?: ChatCompletionResult['usage']; model?: string; error?: string }> {
  const result = await chatCompletion(
    { ...options, responseFormat: 'json_object' },
    config
  );

  if (!result.success) {
    return { success: false, error: result.error };
  }

  try {
    const data = JSON.parse(result.content || '{}') as T;
    return {
      success: true,
      data,
      raw: result.content,
      usage: result.usage,
      model: result.model,
    };
  } catch (parseError) {
    const parseErrorMessage = parseError instanceof Error ? parseError.message : 'Unknown parse error';
    safetyLogger.error('Failed to parse JSON response', {
      error: parseErrorMessage,
      rawContent: result.content?.slice(0, 500), // Log first 500 chars for debugging
    });
    return {
      success: false,
      error: `Failed to parse JSON response: ${parseErrorMessage}`,
      raw: result.content,
    };
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if the OpenAI API key is configured.
 */
export function isOpenAIConfigured(): boolean {
  return !!getEnvVar('OPENAI_API_KEY');
}

/**
 * Get the default model being used.
 */
export function getDefaultModel(): string {
  return DEFAULT_MODEL;
}

/**
 * Reset the cached client instance.
 * Useful for testing or when switching API keys.
 */
export function resetOpenAIClient(): void {
  openaiInstance = null;
  currentConfig = {};
}

export default getOpenAIClient;
