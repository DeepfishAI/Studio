/**
 * Provider Keys (runtime-managed secrets)
 *
 * Goals:
 * - Allow God Mode to add/modify/delete provider API keys at runtime.
 * - Never persist raw keys to repo.
 * - Keys are stored encrypted in Redis (if available).
 * - Synchronous reads for the hot-path (LLM calls) via an in-memory cache.
 *
 * Extras:
 * - Human-defined display names (aliases) per provider.
 *
 * Security model:
 * - Encrypt at rest using AES-256-GCM.
 * - Master key derived from SECRETS_MASTER_KEY (preferred) or JWT_SECRET.
 */

import crypto from 'crypto';

const CACHE_KEY = new Map();   // provider -> apiKey (plaintext)
const CACHE_NAME = new Map();  // provider -> displayName (plaintext)
let redisClient = null;

function normalizeProvider(provider) {
  const p = String(provider || '').toLowerCase().trim();
  // Treat google as gemini in UI/config
  if (p === 'google') return 'gemini';
  return p;
}

function prettyDefault(provider) {
  switch (normalizeProvider(provider)) {
    case 'openai': return 'OpenAI';
    case 'anthropic': return 'Anthropic';
    case 'gemini': return 'Gemini';
    case 'openrouter': return 'OpenRouter';
    case 'nvidia': return 'NVIDIA';
    default: return provider ? String(provider) : 'Provider';
  }
}

function deriveMasterKey() {
  const seed = process.env.SECRETS_MASTER_KEY || process.env.JWT_SECRET || '';
  return crypto.createHash('sha256').update(seed || 'ephemeral').digest();
}

const MASTER_KEY = deriveMasterKey();

function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', MASTER_KEY, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decrypt(b64) {
  const buf = Buffer.from(String(b64), 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', MASTER_KEY, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString('utf8');
}

function redisKeyKey(provider) {
  return `secrets:provider:${normalizeProvider(provider)}`;
}

function redisKeyName(provider) {
  return `secrets:provider_name:${normalizeProvider(provider)}`;
}

export function bindRedis(redis) {
  redisClient = redis;
}

/**
 * Initialize cache from Redis (best effort).
 */
export async function initProviderKeys() {
  if (!redisClient) return;
  try {
    const keyKeys = await redisClient.keys('secrets:provider:*');
    for (const k of keyKeys) {
      // ignore name keys
      if (k.startsWith('secrets:provider_name:')) continue;
      const provider = k.split(':').pop();
      const val = await redisClient.get(k);
      if (!val) continue;
      try {
        const apiKey = decrypt(val);
        CACHE_KEY.set(provider, apiKey);
      } catch {
        // ignore unreadable entries
      }
    }

    const nameKeys = await redisClient.keys('secrets:provider_name:*');
    for (const k of nameKeys) {
      const provider = k.split(':').pop();
      const val = await redisClient.get(k);
      if (!val) continue;
      try {
        const name = decrypt(val);
        if (name) CACHE_NAME.set(provider, name);
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore init failure
  }
}

/**
 * Get a provider key (sync). Env vars still take priority.
 */
export function getProviderKey(provider) {
  const p = normalizeProvider(provider);

  // Env vars override (Railway variables still work)
  if (p === 'anthropic' && process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  if (p === 'gemini' && process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  if (p === 'nvidia' && process.env.NVIDIA_API_KEY) return process.env.NVIDIA_API_KEY;
  if (p === 'openrouter' && process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  if (p === 'openai' && process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;

  return CACHE_KEY.get(p) || '';
}

/**
 * Get the provider display name (sync).
 */
export function getProviderName(provider) {
  const p = normalizeProvider(provider);
  return CACHE_NAME.get(p) || prettyDefault(p);
}

export function isProviderEnabledRuntime(provider) {
  return !!getProviderKey(provider);
}

/**
 * Admin: set provider key and/or display name (async).
 * - If apiKey is falsy, leaves key unchanged.
 * - If name is provided (including empty string), sets it.
 */
export async function setProviderKey(provider, apiKey, name) {
  const p = normalizeProvider(provider);

  const keyStr = apiKey != null ? String(apiKey) : '';
  const nameProvided = name !== undefined;

  if (keyStr) {
    CACHE_KEY.set(p, keyStr);
    if (redisClient) {
      await redisClient.set(redisKeyKey(p), encrypt(keyStr));
    }
  }

  if (nameProvided) {
    const nameStr = String(name || '').trim();
    if (nameStr) CACHE_NAME.set(p, nameStr);
    else CACHE_NAME.delete(p);

    if (redisClient) {
      if (nameStr) await redisClient.set(redisKeyName(p), encrypt(nameStr));
      else await redisClient.del(redisKeyName(p));
    }
  }
}

/**
 * Admin: delete provider key + name (async).
 */
export async function deleteProviderKey(provider) {
  const p = normalizeProvider(provider);
  CACHE_KEY.delete(p);
  CACHE_NAME.delete(p);
  if (redisClient) {
    await redisClient.del(redisKeyKey(p));
    await redisClient.del(redisKeyName(p));
  }
}

/**
 * Admin: list providers (masked) + display names.
 */
export async function listProviderKeys() {
  const known = ['openai','anthropic','gemini','nvidia','openrouter'];
  const providers = new Set(known);

  // Include any custom providers already present in cache
  for (const k of CACHE_KEY.keys()) providers.add(String(k));
  for (const k of CACHE_NAME.keys()) providers.add(String(k));

  // Include any custom providers present in Redis
  if (redisClient) {
    try {
      const k1 = await redisClient.keys('secrets:provider:*');
      const k2 = await redisClient.keys('secrets:provider_name:*');
      [...k1, ...k2].forEach(k => {
        const prov = String(k).split(':').pop();
        if (prov) providers.add(prov);
      });
    } catch {
      // ignore
    }
  }

  const out = [];
  for (const p of Array.from(providers).sort()) {
    const k = getProviderKey(p);
    out.push({
      provider: normalizeProvider(p),
      name: getProviderName(p),
      enabled: !!k,
      masked: k ? `${k.slice(0, 4)}…${k.slice(-4)}` : ''
    });
  }
  return out;
}
