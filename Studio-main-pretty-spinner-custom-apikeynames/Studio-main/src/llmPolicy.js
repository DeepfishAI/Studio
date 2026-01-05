/**
 * LLM Policy — per-agent allowlist + primary/secondary/backup selection.
 * 
 * Sources:
 * - Agent config: agents/{id}.agent.json → llmPolicy.allowedBackends + llmPolicy.selection
 * - God Mode config: oracle/godmode.json → llmBackends[] (definitions)
 * 
 * Oracle / humans define what's allowed; runtime enforces it.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const GODMODE_PATH = join(ROOT, 'oracle', 'godmode.json');

let cached = null;

function loadGodmode() {
  if (cached) return cached;
  if (!existsSync(GODMODE_PATH)) return null;
  try {
    cached = JSON.parse(readFileSync(GODMODE_PATH, 'utf8'));
    return cached;
  } catch {
    return null;
  }
}

/**
 * Resolve a backend id like "anthropic:claude-sonnet-4-20250514"
 * into an options object { provider, model, maxTokens, temperature }.
 */
export function resolveBackendId(backendId) {
  if (!backendId || typeof backendId !== 'string') return null;

  const god = loadGodmode();
  const defs = Array.isArray(god?.llmBackends) ? god.llmBackends : [];
  const found = defs.find(d => d?.id === backendId);

  if (found) {
    const { provider, model, maxTokens, temperature } = found;
    return {
      provider,
      model,
      maxTokens: typeof maxTokens === 'number' ? maxTokens : 1024,
      temperature: typeof temperature === 'number' ? temperature : 0.3
    };
  }

  // Fallback: parse "provider:model"
  const parts = backendId.split(':');
  if (parts.length >= 2) {
    const provider = parts[0];
    const model = parts.slice(1).join(':');
    return { provider, model, maxTokens: 1024, temperature: 0.3 };
  }
  return null;
}

/**
 * Build execution plan from llmPolicy selection.
 */
export function buildPlanFromLlmPolicy(agentConfig) {
  const policy = agentConfig?.llmPolicy;
  if (!policy) return null;

  const allowed = Array.isArray(policy.allowedBackends) ? policy.allowedBackends.filter(Boolean) : [];
  const sel = policy.selection || {};

  // Must have allowlist
  if (!allowed.length) return null;

  const pick = (x, fallbackIndex) => {
    if (x && allowed.includes(x)) return x;
    return allowed[Math.min(fallbackIndex, allowed.length - 1)];
  };

  const primaryId = pick(sel.primary, 0);
  const secondaryId = pick(sel.secondary, 1);
  const backupId = pick(sel.backup, 2);

  const ids = [primaryId, secondaryId, backupId].filter(Boolean);
  const plan = [];
  for (let i = 0; i < ids.length; i++) {
    const opt = resolveBackendId(ids[i]);
    if (!opt) continue;
    plan.push({ tier: i === 0 ? 'primary' : (i === 1 ? 'secondary' : 'backup'), config: opt, backendId: ids[i] });
  }

  return plan.length ? { allowedBackends: allowed, executionPlan: plan } : null;
}
