/**
 * Config Loader
 * 
 * PRIORITY ORDER:
 * 1. Environment variables (always checked first - works with Railway/Heroku/etc)
 * 2. config.secrets.json (local development fallback)
 * 
 * Railway automatically injects env vars at runtime - no special API needed.
 * Just set your keys in Railway dashboard → Variables tab.
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '../..');

let config = null;

// Detect if running on Railway
const isRailway = () => !!process.env.RAILWAY_ENVIRONMENT || !!process.env.RAILWAY_PROJECT_ID;

// Runtime-managed keys (God Mode)
import { getProviderKey, isProviderEnabledRuntime, setProviderKey } from '../infra/provider_keys.js';

export function loadConfig() {
    if (config) return config;

    // Always build config from environment variables first
    config = {
        redis_url: process.env.REDIS_URL || process.env.REDIS_PUBLIC_URL || '',
        llm_providers: {
            openai: {
                api_key: process.env.OPENAI_API_KEY || '',
                enabled: !!process.env.OPENAI_API_KEY
            },
            anthropic: {
                api_key: process.env.ANTHROPIC_API_KEY || '',
                enabled: !!process.env.ANTHROPIC_API_KEY
            },
            google: {
                gemini_api_key: process.env.GEMINI_API_KEY || '',
                enabled: !!process.env.GEMINI_API_KEY
            },
            nvidia: {
                api_key: process.env.NVIDIA_API_KEY || '',
                enabled: !!process.env.NVIDIA_API_KEY
            },
            openrouter: {
                api_key: process.env.OPENROUTER_API_KEY || '',
                enabled: !!process.env.OPENROUTER_API_KEY
            }
        },
        twilio: {
            account_sid: process.env.TWILIO_ACCOUNT_SID || '',
            auth_token: process.env.TWILIO_AUTH_TOKEN || '',
            phone_number: process.env.TWILIO_PHONE_NUMBER || '',
            enabled: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
        },
        elevenlabs: {
            api_key: process.env.ELEVENLABS_API_KEY || '',
            enabled: !!process.env.ELEVENLABS_API_KEY
        },
        stripe: {
            secret_key: process.env.STRIPE_SECRET_KEY || '',
            publishable_key: process.env.STRIPE_PUBLISHABLE_KEY || '',
            webhook_secret: process.env.STRIPE_WEBHOOK_SECRET || '',
            enabled: !!process.env.STRIPE_SECRET_KEY
        },
        tier: process.env.TIER || 'starter'
    };

    // If on Railway, we're done - env vars are the source of truth
    if (isRailway()) {
        console.log('[Config] 🚂 Railway detected - using environment variables');
        return config;
    }

    // Local development: merge with config.secrets.json if it exists
    const secretsPath = join(ROOT, 'config.secrets.json');
    if (existsSync(secretsPath)) {
        try {
            const content = readFileSync(secretsPath, 'utf-8');
            const secrets = JSON.parse(content);

            // Merge secrets into config
            // Handle nested structure (Legacy) OR Flat structure (Railway JSON export)


            // Anthropic
            const anthropicKey = secrets.llm_providers?.anthropic?.api_key || secrets.ANTHROPIC_API_KEY;
            if (anthropicKey) { // Hydrate Cache
                setProviderKey('anthropic', anthropicKey);
                config.llm_providers.anthropic.api_key = anthropicKey;
                config.llm_providers.anthropic.enabled = true;
            }

            // Google / Gemini
            const geminiKey = secrets.llm_providers?.google?.gemini_api_key || secrets.GEMINI_API_KEY || secrets.GOOGLE_AI_API_KEY;
            if (geminiKey) { // Hydrate Cache
                setProviderKey('gemini', geminiKey);
                config.llm_providers.google.gemini_api_key = geminiKey;
                config.llm_providers.google.enabled = true;
            }

            // NVIDIA
            const nvidiaKey = secrets.llm_providers?.nvidia?.api_key || secrets.NVIDIA_API_KEY;
            if (nvidiaKey) { // Hydrate Cache
                setProviderKey('nvidia', nvidiaKey);
                config.llm_providers.nvidia.api_key = nvidiaKey;
                config.llm_providers.nvidia.enabled = true;
            }

            // OpenRouter
            const openrouterKey = secrets.llm_providers?.openrouter?.api_key || secrets.OPENROUTER_API_KEY;
            if (openrouterKey) { // Hydrate Cache
                setProviderKey('openrouter', openrouterKey);
                config.llm_providers.openrouter.api_key = openrouterKey;
                config.llm_providers.openrouter.enabled = true;
            }

            // OpenAI
            const openaiKey = secrets.llm_providers?.openai?.api_key || secrets.OPENAI_API_KEY;
            if (openaiKey) { // Hydrate Cache
                setProviderKey('openai', openaiKey);
                config.llm_providers.openai.api_key = openaiKey;
                config.llm_providers.openai.enabled = true;
            }

            // Twilio
            const twilioSid = secrets.twilio?.account_sid || secrets.TWILIO_ACCOUNT_SID;
            if (twilioSid && !config.twilio.account_sid) {
                config.twilio.account_sid = twilioSid;
                config.twilio.auth_token = secrets.twilio?.auth_token || secrets.TWILIO_AUTH_TOKEN || '';
                config.twilio.phone_number = secrets.twilio?.phone_number || secrets.TWILIO_PHONE_NUMBER || '';
                config.twilio.enabled = true;
            }

            // ElevenLabs
            const elevenKey = secrets.elevenlabs?.api_key || secrets.ELEVENLABS_API_KEY;
            if (elevenKey && !config.elevenlabs.api_key) {
                config.elevenlabs.api_key = elevenKey;
                config.elevenlabs.enabled = true;
            }

            if (secrets.redis_url && !config.redis_url) {
                config.redis_url = secrets.redis_url;
            }
            if (secrets.REDIS_URL && !config.redis_url) {
                config.redis_url = secrets.REDIS_URL;
            }
            if (secrets.tier) {
                config.tier = secrets.tier;
            }

            console.log('[Config] 📁 Loaded secrets from config.secrets.json (local dev mode)');
        } catch (err) {
            console.warn('[Config] ⚠️ Could not parse config.secrets.json:', err.message);
        }
    } else {
        console.log('[Config] 📦 Using environment variables (no config.secrets.json found)');
    }

    return config;
}

export function getApiKey(provider) {
    // Prefer runtime-managed cache (includes env overrides)
    return getProviderKey(provider);
}

export function isProviderEnabled(provider) {
    return isProviderEnabledRuntime(provider);
}

export function getTier() {
    const cfg = loadConfig();
    return cfg.tier || 'starter';
}

export function getRedisUrl() {
    const cfg = loadConfig();
    return cfg.redis_url || '';
}
