import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RECEIPTS_DIR = path.resolve(__dirname, '..', 'oracle', 'receipts');
const PUSHLOG_PATH = path.join(RECEIPTS_DIR, 'pushlog.jsonl');

/**
 * Oracle push-push log.
 * Stores ONLY distilled knowledge clips + routing metadata (no raw transcripts/media).
 * Designed to be human-auditable and to drive Mei's knowledge map computation.
 */
export function appendPushLog(entry) {
  try { fs.mkdirSync(RECEIPTS_DIR, { recursive: true }); } catch {}

  const safe = {
    id: entry?.id || `pl_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    createdAt: entry?.createdAt || new Date().toISOString(),
    source: entry?.source || null,            // { kind, url, creator, publishedAt, title? }
    targets: entry?.targets || [],            // agent ids
    topicTags: entry?.topicTags || [],         // normalized tags
    bullets: entry?.bullets || [],             // distilled bullet points ONLY
    clipIds: entry?.clipIds || [],             // optional ids if you keep them elsewhere
    notes: entry?.notes || null                // optional metadata, must not include raw content
  };

  // Guardrail: prevent accidental raw dumps
  const joined = JSON.stringify(safe);
  if (joined.length > 10000) {
    safe.notes = (safe.notes ? String(safe.notes).slice(0, 500) : null);
    safe.bullets = Array.isArray(safe.bullets) ? safe.bullets.slice(0, 20).map(b => String(b).slice(0, 300)) : [];
  }

  fs.appendFileSync(PUSHLOG_PATH, JSON.stringify(safe) + '\n', 'utf-8');
  return safe;
}

export function readPushLog({ limit = 100, sinceId = null } = {}) {
  try {
    const raw = fs.readFileSync(PUSHLOG_PATH, 'utf-8');
    const lines = raw.split(/\r?\n/).filter(Boolean);
    const items = lines.map(l => {
      try { return JSON.parse(l); } catch { return null; }
    }).filter(Boolean);

    let filtered = items;
    if (sinceId) {
      const idx = items.findIndex(x => x.id === sinceId);
      filtered = idx >= 0 ? items.slice(idx + 1) : items;
    }
    if (limit && filtered.length > limit) filtered = filtered.slice(filtered.length - limit);
    return filtered;
  } catch {
    return [];
  }
}
