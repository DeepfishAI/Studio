import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { readPushLog } from './oracle_pushlog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ORACLE_DIR = path.resolve(__dirname, '..', 'oracle');
const RECEIPTS_DIR = path.join(ORACLE_DIR, 'receipts');
const GODMODE_PATH = path.join(ORACLE_DIR, 'godmode.json');
const MEI_MAP_PATH = path.join(RECEIPTS_DIR, 'mei_knowledge_map.json');
const MEI_CURSOR_PATH = path.join(RECEIPTS_DIR, 'mei_pushlog_cursor.json');

function loadGodMode() {
  try {
    const raw = fs.readFileSync(GODMODE_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function loadCursor() {
  try { return JSON.parse(fs.readFileSync(MEI_CURSOR_PATH, 'utf-8')); } catch { return { lastId: null }; }
}

function saveCursor(lastId) {
  try { fs.mkdirSync(RECEIPTS_DIR, { recursive: true }); } catch {}
  fs.writeFileSync(MEI_CURSOR_PATH, JSON.stringify({ lastId, updatedAt: new Date().toISOString() }, null, 2), 'utf-8');
}

/**
 * Recompute Mei's "who knows what" map from Oracle's push log + God Mode curriculum map.
 * This map is used for routing decisions (hard requirement).
 */
export function recomputeMeiKnowledgeMap({ full = false, limit = 5000 } = {}) {
  try { fs.mkdirSync(RECEIPTS_DIR, { recursive: true }); } catch {}

  const god = loadGodMode() || {};
  const cfg = god.oracle || {};
  const halfLifeDays = Number(cfg.knowledgeHalfLifeDays || 14);
  const now = Date.now();

  const cursor = loadCursor();
  const sinceId = full ? null : cursor.lastId;

  const pushes = readPushLog({ limit, sinceId });
  const curriculum = god.curriculumMap || {};
  const baseWhoDoesWhat = god.routingKeywords?.whoDoesWhat || {};

  // Load existing map as baseline if present
  let map;
  try { map = JSON.parse(fs.readFileSync(MEI_MAP_PATH, 'utf-8')); } catch { map = { version: 1, agents: {} }; }
  if (!map.agents) map.agents = {};

  // Ensure agents exist in map (from curriculum + known keywords)
  const agentIds = new Set([...Object.keys(curriculum), ...Object.keys(baseWhoDoesWhat), ...Object.keys(map.agents)]);
  for (const id of agentIds) {
    if (!map.agents[id]) map.agents[id] = { roles: [id], keywords: {}, updatedAt: new Date().toISOString() };
    if (!Array.isArray(map.agents[id].roles) || map.agents[id].roles.length === 0) map.agents[id].roles = [id];
    if (!map.agents[id].keywords) map.agents[id].keywords = {};
  }

  function decayWeight(createdAtIso) {
    try {
      const t = Date.parse(createdAtIso);
      const ageDays = Math.max(0, (now - t) / (1000 * 60 * 60 * 24));
      // Exponential decay with half-life
      return Math.pow(0.5, ageDays / halfLifeDays);
    } catch {
      return 1;
    }
  }

  for (const p of pushes) {
    const weight = decayWeight(p.createdAt);
    const targets = Array.isArray(p.targets) ? p.targets : [];
    const tags = (Array.isArray(p.topicTags) ? p.topicTags : []).map(t => String(t).toLowerCase());

    for (const agentId of targets) {
      if (!map.agents[agentId]) map.agents[agentId] = { roles: [agentId], keywords: {}, updatedAt: new Date().toISOString() };
      const entry = map.agents[agentId];
      for (const tag of tags) {
        entry.keywords[tag] = (entry.keywords[tag] || 0) + (1 * weight);
      }
      entry.updatedAt = new Date().toISOString();
    }
  }

  map.generatedAt = new Date().toISOString();
  map.note = 'Computed from Oracle push-push log (bullets only) + God Mode curriculum map.';
  fs.writeFileSync(MEI_MAP_PATH, JSON.stringify(map, null, 2), 'utf-8');

  // update cursor
  if (pushes.length) {
    const lastId = pushes[pushes.length - 1].id;
    saveCursor(lastId);
  }

  return map;
}

export function startMeiDailyReviewScheduler() {
  // Run once at start, then daily.
  try { recomputeMeiKnowledgeMap({ full: false }); } catch {}
  const oneDay = 24 * 60 * 60 * 1000;
  setInterval(() => {
    try { recomputeMeiKnowledgeMap({ full: false }); } catch {}
  }, oneDay);
}
