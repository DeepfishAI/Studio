/**
 * LLM Service
 * Wraps LLM API calls with multi-provider abstraction
 * 
 * Supports:
 * - Anthropic Claude (primary)
 * - Google Gemini
 * - NVIDIA NIM (via OpenAI-compatible API)
 * - MOCK (Fallback for testing)
 */

import Anthropic from '@anthropic-ai/sdk';
import { getApiKey, isProviderEnabled } from './config.js';

// Client instances
let anthropicClient = null;

function getAnthropicClient() {
    if (anthropicClient) return anthropicClient;

    const apiKey = getApiKey('anthropic');
    if (!apiKey) {
        throw new Error('Anthropic API key not configured');
    }

    anthropicClient = new Anthropic({ apiKey });
    return anthropicClient;
}

/**
 * Send a message to the LLM and get a response
 * @param {string} systemPrompt - The system context
 * @param {string} userMessage - The user's message
 * @param {object} options - Additional options
 */
export async function chat(systemPrompt, userMessage, options = {}) {
    const {
        model = 'claude-sonnet-4-20250514',
        maxTokens = 1024,
        provider = 'anthropic'
    } = options;

    // Try requested provider, fall back to any available, then MOCK
    const providers = [provider, 'anthropic', 'gemini', 'nvidia', 'mock'];

    console.log(`[LLM] Starting chat. Checking providers in order: ${providers.join(', ')}`);

    for (const p of providers) {
        const available = isProviderAvailable(p);
        console.log(`[LLM] Provider ${p}: available=${available}`);

        if (available) {
            try {
                console.log(`[LLM] Attempting call with provider: ${p}`);
                const result = await chatWithProvider(p, systemPrompt, userMessage, { model, maxTokens });
                console.log(`[LLM] Success with provider: ${p}`);
                return result;
            } catch (err) {
                console.error(`[LLM] ${p} failed:`, err.message);
                continue;
            }
        }
    }

    throw new Error('No LLM provider available');
}

/**
 * Check if a provider is available
 */
function isProviderAvailable(provider) {
    if (provider === 'mock') return true;
    return !!getApiKey(provider) || isProviderEnabled(provider);
}

/**
 * Chat with a specific provider
 */
async function chatWithProvider(provider, systemPrompt, userMessage, options) {
    switch (provider) {
        case 'anthropic':
            return chatAnthropic(systemPrompt, userMessage, options);
        case 'gemini':
        case 'google':
            return chatGemini(systemPrompt, userMessage, options);
        case 'nvidia':
            return chatNvidia(systemPrompt, userMessage, options);
        case 'mock':
            return chatMock(systemPrompt, userMessage, options);
        default:
            throw new Error(`Provider ${provider} not supported`);
    }
}

/**
 * Mock Provider for Testing
 */
async function chatMock(systemPrompt, userMessage, options) {
    // Extract identity from system prompt if possible
    const match = systemPrompt.match(/You are (.+?),/);
    const identity = match ? match[1] : 'Unknown Agent';

    return `[MOCK RESPONSE from ${identity}]
    
I have received your request regarding: "${userMessage.substring(0, 50)}..."

Since I am a mock instance running in test mode, I cannot generate real content.
However, I confirm that:
1. My identity was correctly injected: ${identity}
2. I successfully intercepted the request.
3. I am ready to process this as a parallel instance.

[End Mock Output]`;
}

/**
 * Anthropic Claude
 */
async function chatAnthropic(systemPrompt, userMessage, options) {
    const client = getAnthropicClient();

    try {
        const response = await client.messages.create({
            model: options.model || 'claude-sonnet-4-20250514',
            max_tokens: options.maxTokens,
            system: systemPrompt,
            messages: [
                { role: 'user', content: userMessage }
            ]
        });

        // Extract text from response
        const textBlocks = response.content.filter(block => block.type === 'text');
        return textBlocks.map(block => block.text).join('\n');
    } catch (err) {
        console.error('[LLM:Anthropic] Error:', err.message);
        throw err;
    }
}

/**
 * Google Gemini
 */
async function chatGemini(systemPrompt, userMessage, options) {
    const apiKey = getApiKey('gemini');
    if (!apiKey) throw new Error('Gemini API key not configured');

    const model = options.model || 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: systemPrompt }] },
                contents: [{ parts: [{ text: userMessage }] }],
                generationConfig: {
                    maxOutputTokens: options.maxTokens,
                    temperature: 0.7
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status}`);
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (err) {
        console.error('[LLM:Gemini] Error:', err.message);
        throw err;
    }
}

/**
 * NVIDIA NIM (OpenAI-compatible API)
 */
async function chatNvidia(systemPrompt, userMessage, options) {
    const apiKey = getApiKey('nvidia');
    if (!apiKey) throw new Error('NVIDIA API key not configured');

    // Default to Llama 70B
    const model = options.model || 'meta/llama-3.1-70b-instruct';
    const url = 'https://integrate.api.nvidia.com/v1/chat/completions';

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                max_tokens: options.maxTokens,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage }
                ],
                temperature: 0.7,
                stream: false
            })
        });

        if (!response.ok) {
            throw new Error(`NVIDIA API error: ${response.status}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
    } catch (err) {
        console.error('[LLM:NVIDIA] Error:', err.message);
        throw err;
    }
}

/**
 * Check if any LLM is available
 */
export function isLlmAvailable() {
    return isProviderAvailable('anthropic') ||
        isProviderAvailable('gemini') ||
        isProviderAvailable('nvidia') ||
        true; // Always allow (Mock fallback)
}

/**
 * Get list of available providers
 */
export function getAvailableProviders() {
    const providers = [];
    if (isProviderAvailable('anthropic')) providers.push('anthropic');
    if (isProviderAvailable('gemini')) providers.push('gemini');
    if (isProviderAvailable('nvidia')) providers.push('nvidia');
    providers.push('mock');
    return providers;
}
