import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { readPushLog } from '../../domain/knowledge/pushlog.js';
import { recomputeMeiKnowledgeMap } from '../../domain/agents/mei_autonomy.js';
import { listProviderKeys, setProviderKey, deleteProviderKey } from '../../infra/provider_keys.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, '..', '..');
const ORACLE_DIR = path.join(ROOT, 'oracle');
const RECEIPTS_DIR = path.join(ORACLE_DIR, 'receipts');
const GODMODE_PATH = path.join(ORACLE_DIR, 'godmode.json');

const AGENTS_DIR = path.join(ROOT, 'agents');

function safeReadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
}

function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf-8');
}

export function godRoutes() {
  const router = express.Router();

  // God mode config
  router.get('/config', (req, res) => {
    const cfg = safeReadJson(GODMODE_PATH) || {};
    res.json(cfg);
  });

  router.put('/config', (req, res) => {
    const body = req.body || {};
    body.updatedAt = new Date().toISOString();
    writeJson(GODMODE_PATH, body);
    res.json({ ok: true });
  });

  // Agents index
  router.get('/agents', (req, res) => {
    try {
      const files = fs.readdirSync(AGENTS_DIR).filter(f => f.endsWith('.json'));
      // group by agentId
      const byId = {};
      for (const f of files) {
        const m = f.match(/^(.*)\.(agent|user|personality)\.json$/);
        if (!m) continue;
        const id = m[1];
        byId[id] = byId[id] || { id };
        byId[id][m[2]] = f;
      }
      res.json(Object.values(byId).sort((a,b)=>a.id.localeCompare(b.id)));
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.get('/agents/:agentId', (req, res) => {
    const id = req.params.agentId;
    const out = {
      id,
      agent: safeReadJson(path.join(AGENTS_DIR, `${id}.agent.json`)),
      user: safeReadJson(path.join(AGENTS_DIR, `${id}.user.json`)),
      personality: safeReadJson(path.join(AGENTS_DIR, `${id}.personality.json`)),
    };
    res.json(out);
  });

  router.put('/agents/:agentId', (req, res) => {
    const id = req.params.agentId;
    const body = req.body || {};
    // allow updating any subset
    if (body.agent) writeJson(path.join(AGENTS_DIR, `${id}.agent.json`), body.agent);
    if (body.user) writeJson(path.join(AGENTS_DIR, `${id}.user.json`), body.user);
    if (body.personality) writeJson(path.join(AGENTS_DIR, `${id}.personality.json`), body.personality);
    res.json({ ok: true });
  });

  // Oracle push-push log
  router.get('/pushlog', (req, res) => {
    const limit = Number(req.query.limit || 100);
    const items = readPushLog({ limit });
    res.json(items);
  });

  // Mei knowledge map
  router.get('/mei-knowledge-map', (req, res) => {
    const p = path.join(RECEIPTS_DIR, 'mei_knowledge_map.json');
    const map = safeReadJson(p) || {};
    res.json(map);
  });

  // Manual recompute trigger
  router.post('/mei-review', (req, res) => {
    try {
      const map = recomputeMeiKnowledgeMap({ full: Boolean(req.body?.full) });
      res.json({ ok: true, map });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e) });
    }
  });

  // =============================
  // API Keys (admin-only via requireAdmin middleware in server.js)
  // =============================
  router.get('/api-keys', async (req, res) => {
    try {
      const items = await listProviderKeys();
      res.json({ ok: true, items });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e) });
    }
  });

  router.put('/api-keys/:provider', async (req, res) => {
    try {
      const provider = req.params.provider;
      const apiKey = req.body?.apiKey;
      const name = req.body?.name;

      // Allow updating name without changing key.
      if ((apiKey == null || String(apiKey).trim() === '') && name === undefined) {
        return res.status(400).json({ ok: false, error: 'apiKey or name required' });
      }

      await setProviderKey(provider, apiKey, name);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e) });
    }
  });

  router.delete('/api-keys/:provider', async (req, res) => {
    try {
      const provider = req.params.provider;
      await deleteProviderKey(provider);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e) });
    }
  });

  return router;
}
