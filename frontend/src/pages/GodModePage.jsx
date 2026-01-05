import React, { useEffect, useMemo, useState } from 'react'
import { LlmTripleSpinner } from '../components/LlmTripleSpinner.jsx'
import '../styles/app.css'

const API_BASE = import.meta.env.VITE_API_URL || ''

function JsonEditor({ label, value, onChange, height = 260 }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          height,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          fontSize: 12,
          padding: 10,
          borderRadius: 10,
          border: '1px solid var(--color-surface-border)',
          background: 'var(--color-surface)',
          color: 'var(--color-text)'
        }}
      />
    </div>
  )
}

export default function GodModePage() {
  const [adminSecret, setAdminSecret] = useState(localStorage.getItem('DF_ADMIN_SECRET') || '')
  const [tab, setTab] = useState('control') // 'control' | 'apiKeys'
  const [cfgText, setCfgText] = useState('')
  const [agentsIndex, setAgentsIndex] = useState([])
  const [selectedAgentId, setSelectedAgentId] = useState('')
  const [agentText, setAgentText] = useState('')
  const [pushlog, setPushlog] = useState([])
  const [meiMap, setMeiMap] = useState(null)
  const [status, setStatus] = useState('')

  // API Keys UI state
  const [apiKeys, setApiKeys] = useState([])
  const [apiKeyDrafts, setApiKeyDrafts] = useState({})
  const [apiNameDrafts, setApiNameDrafts] = useState({})
  const [newProvId, setNewProvId] = useState('')
  const [newProvName, setNewProvName] = useState('')
  const [newProvKey, setNewProvKey] = useState('')

  const headers = useMemo(() => ({
    'Content-Type': 'application/json',
    'x-admin-secret': adminSecret
  }), [adminSecret])


  const cfgObj = useMemo(() => {
    try { return cfgText ? JSON.parse(cfgText) : null } catch { return null }
  }, [cfgText])


  // Enabled providers are derived from which API keys exist (env or runtime keys).
  const enabledProviders = useMemo(() => {
    const set = new Set()
    ;(apiKeys || []).forEach(it => {
      if (it && it.enabled && it.provider) set.add(String(it.provider).toLowerCase())
    })
    return set
  }, [apiKeys])

  const normalizeProvider = (p) => {
    const x = String(p || '').toLowerCase()
    // Our key store may report 'gemini' while some backend ids use 'google'
    if (x === 'google') return 'gemini'
    return x
  }

  const providerFromBackendId = (id) => {
    const raw = String(id || '').split(':')[0]
    return normalizeProvider(raw)
  }
  const providerNameMap = useMemo(() => {
    const m = new Map()
    ;(apiKeys || []).forEach(it => {
      if (!it?.provider) return
      m.set(String(it.provider).toLowerCase(), String(it.name || it.provider))
    })
    return m
  }, [apiKeys])

  const modelPretty = (model) => {
    const s = String(model || '')
    if (!s) return ''
    // Simple prettifier: keep hyphens, but capitalize GPT/Claude/Gemini/O3 etc.
    return s
      .replace(/^gpt/i, 'GPT')
      .replace(/^claude/i, 'Claude')
      .replace(/^gemini/i, 'Gemini')
      .replace(/^o(\d)/i, 'O$1')
  }

  const backendLabel = (backendId) => {
    const id = String(backendId || '')
    if (!id) return '(unset)'
    const [provRaw, modelRaw] = id.split(':')
    const prov = normalizeProvider(provRaw)
    const provName = providerNameMap.get(prov) || (prov ? prov : 'Provider')
    const modelName = modelPretty(modelRaw)
    return modelName ? `${provName} — ${modelName}` : provName
  }



  const agentObj = useMemo(() => {
    try { return agentText ? JSON.parse(agentText) : null } catch { return null }
  }, [agentText])

  const availableBackends = useMemo(() => {
    const list = cfgObj?.llmBackends
    const base = Array.isArray(list) ? list : [
      { id: "openai:gpt-5.2", provider: "openai", model: "gpt-5.2" },
      { id: "anthropic:claude-sonnet-4-20250514", provider: "anthropic", model: "claude-sonnet-4-20250514" },
      { id: "google:gemini-2.0-pro", provider: "google", model: "gemini-2.0-pro" },
      { id: "openrouter:deepseek-r1", provider: "openrouter", model: "deepseek-r1" }
    ]

    // Spinner options should reflect enabled API keys:
    // - If you have N provider keys enabled, the spinner only shows backends whose provider is enabled.
    // - If no keys are enabled, show an empty list (runtime will silently fall back).
    if (!enabledProviders || enabledProviders.size === 0) return []

    return base.filter(b => {
      const prov = normalizeProvider(b?.provider || providerFromBackendId(b?.id))
      return enabledProviders.has(prov)
    })
  }, [cfgObj, enabledProviders])

  const backendIds = useMemo(() => availableBackends.map(b => b.id), [availableBackends])

  function writeAgentObj(next) {
    setAgentText(JSON.stringify(next, null, 2))
  }

  function ensureLlmPolicy(a) {
    const allowed = Array.isArray(a?.llmPolicy?.allowedBackends) ? a.llmPolicy.allowedBackends : []
    const selection = a?.llmPolicy?.selection || { primary: "", secondary: "", backup: "" }
    return {
      ...a,
      llmPolicy: {
        allowedBackends: allowed.length ? allowed : backendIds.slice(0, 3),
        selection: selection
      }
    }
  }

  useEffect(() => {
    localStorage.setItem('DF_ADMIN_SECRET', adminSecret)
  }, [adminSecret])

  async function loadAll() {
    setStatus('Loading…')
    try {
      const [cfgRes, agentsRes, pushRes, mapRes] = await Promise.all([
        fetch(`${API_BASE}/api/god/config`, { headers }),
        fetch(`${API_BASE}/api/god/agents`, { headers }),
        fetch(`${API_BASE}/api/god/pushlog?limit=100`, { headers }),
        fetch(`${API_BASE}/api/god/mei-knowledge-map`, { headers })
      ])
      const cfg = await cfgRes.json()
      const agents = await agentsRes.json()
      const push = await pushRes.json()
      const map = await mapRes.json()
      setCfgText(JSON.stringify(cfg, null, 2))
      setAgentsIndex(Array.isArray(agents) ? agents : [])
      setPushlog(Array.isArray(push) ? push : [])
      setMeiMap(map)
      // Load provider keys (best effort)
      try {
        const kRes = await fetch(`${API_BASE}/api/god/api-keys`, { headers })
        const kData = await kRes.json()
        if (kRes.ok && Array.isArray(kData?.items)) {
          setApiKeys(kData.items)
          const nextKeyDrafts = {}
          const nextNameDrafts = {}
          kData.items.forEach(it => {
            nextKeyDrafts[it.provider] = ''
            nextNameDrafts[it.provider] = it.name || ''
          })
          setApiKeyDrafts(nextKeyDrafts)
          setApiNameDrafts(nextNameDrafts)
        }
      } catch {}
      setStatus('Loaded.')
    } catch (e) {
      setStatus(`Error: ${String(e)}`)
    }
  }

  async function refreshApiKeys() {
    try {
      const kRes = await fetch(`${API_BASE}/api/god/api-keys`, { headers })
      const kData = await kRes.json()
      if (kRes.ok && Array.isArray(kData?.items)) {
        setApiKeys(kData.items)
        setApiNameDrafts((prev) => {
          const next = { ...prev }
          kData.items.forEach(it => {
            if (next[it.provider] === undefined) next[it.provider] = it.name || ''
          })
          return next
        })
      }
    } catch {}
  }

  async function saveProviderKey(provider) {
    const apiKey = (apiKeyDrafts?.[provider] || '').trim()
    const name = String(apiNameDrafts?.[provider] ?? '').trim()

    // Only bail if nothing to save (no new key and name unchanged)
    const current = (apiKeys || []).find(x => x.provider === provider)
    const currentName = String(current?.name || '').trim()
    if (!apiKey && name === currentName) return

    setStatus('Saving…')
    try {
      const payload = {}
      if (apiKey) payload.apiKey = apiKey
      // Always send name if it differs (allows clearing)
      if (name !== currentName) payload.name = name

      const res = await fetch(`${API_BASE}/api/god/api-keys/${encodeURIComponent(provider)}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed')
      setApiKeyDrafts((d) => ({ ...d, [provider]: '' }))
      await refreshApiKeys()
      setStatus('Saved.')
    } catch (e) {
      setStatus(`Save error: ${String(e)}`)
    }
  }

  async function deleteProvider(provider) {
    setStatus('Deleting API key…')
    try {
      const res = await fetch(`${API_BASE}/api/god/api-keys/${encodeURIComponent(provider)}`, {
        method: 'DELETE',
        headers
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed')
      await refreshApiKeys()
      setStatus('Deleted.')
    } catch (e) {
      setStatus(`Delete error: ${String(e)}`)
    }
  }

  
  async function addProvider() {
    const provider = newProvId.trim().toLowerCase()
    const apiKey = newProvKey.trim()
    const name = newProvName.trim()
    if (!provider || !apiKey) return
    setStatus('Adding provider key…')
    try {
      const res = await fetch(`${API_BASE}/api/god/api-keys/${encodeURIComponent(provider)}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ apiKey, name })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed')
      setNewProvId(''); setNewProvName(''); setNewProvKey('')
      await refreshApiKeys()
      setStatus('Added.')
    } catch (e) {
      setStatus(`Add error: ${String(e)}`)
    }
  }

useEffect(() => { if (adminSecret) loadAll() }, []) // eslint-disable-line

  async function saveConfig() {
    setStatus('Saving config…')
    try {
      const obj = JSON.parse(cfgText)
      const res = await fetch(`${API_BASE}/api/god/config`, { method: 'PUT', headers, body: JSON.stringify(obj) })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed')
      setStatus('Config saved.')
      await loadAll()
    } catch (e) {
      setStatus(`Save error: ${String(e)}`)
    }
  }

  async function loadAgent(agentId) {
    setSelectedAgentId(agentId)
    setStatus(`Loading agent ${agentId}…`)
    try {
      const res = await fetch(`${API_BASE}/api/god/agents/${agentId}`, { headers })
      const data = await res.json()
      setAgentText(JSON.stringify(data, null, 2))
      setStatus('Agent loaded.')
    } catch (e) {
      setStatus(`Error: ${String(e)}`)
    }
  }

  async function saveAgent() {
    if (!selectedAgentId) return
    setStatus(`Saving agent ${selectedAgentId}…`)
    try {
      const obj = JSON.parse(agentText)
      const body = { agent: obj.agent, user: obj.user, personality: obj.personality }
      const res = await fetch(`${API_BASE}/api/god/agents/${selectedAgentId}`, { method: 'PUT', headers, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed')
      setStatus('Agent saved.')
      await loadAll()
    } catch (e) {
      setStatus(`Save error: ${String(e)}`)
    }
  }

  async function runMeiReview(full=false) {
    setStatus('Running Mei review…')
    try {
      const res = await fetch(`${API_BASE}/api/god/mei-review`, { method: 'POST', headers, body: JSON.stringify({ full }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed')
      setMeiMap(data.map)
      setStatus('Mei review complete.')
      await loadAll()
    } catch (e) {
      setStatus(`Review error: ${String(e)}`)
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <h2 style={{ marginBottom: 6 }}>🧠 God Mode</h2>
      <div style={{ opacity: 0.8, marginBottom: 16 }}>
        Human control plane for Oracle curriculum + routing keywords + agent profiles. (Admin-only)
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Admin Secret</label>
        <input
          type="password"
          value={adminSecret}
          onChange={(e) => setAdminSecret(e.target.value)}
          placeholder="ADMIN_SECRET"
          style={{
            padding: '8px 10px',
            borderRadius: 10,
            border: '1px solid var(--color-surface-border)',
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
            width: 360
          }}
        />
        <button className="btn" onClick={loadAll}>Reload</button>
        <div style={{ fontSize: 12, opacity: 0.85 }}>{status}</div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button className="btn" onClick={() => setTab('control')} style={{ opacity: tab === 'control' ? 1 : 0.7 }}>
          Control Plane
        </button>
        <button className="btn" onClick={() => setTab('apiKeys')} style={{ opacity: tab === 'apiKeys' ? 1 : 0.7 }}>
          API Keys
        </button>
      </div>

      {tab === 'apiKeys' && (
        <div style={{ maxWidth: 760 }}>
          <div style={{ marginBottom: 10, fontSize: 12, fontWeight: 800 }}>Provider API Keys</div>
          <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 12 }}>
            Adding a key enables that provider for every app/agent. Deleting a key disables it.
          </div>


          <div style={{
            border: '1px solid var(--color-surface-border)',
            borderRadius: 12,
            padding: 12,
            background: 'var(--color-surface)',
            marginBottom: 12
          }}>
            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>Add New Provider Key</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="provider id (e.g. openai, anthropic, gemini)"
                value={newProvId}
                onChange={(e) => setNewProvId(e.target.value)}
                style={{
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: '1px solid var(--color-surface-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  flex: '1 1 220px'
                }}
              />
              <input
                type="text"
                placeholder="display name (optional)"
                value={newProvName}
                onChange={(e) => setNewProvName(e.target.value)}
                style={{
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: '1px solid var(--color-surface-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  flex: '1 1 220px'
                }}
              />
              <input
                type="password"
                placeholder="api key"
                value={newProvKey}
                onChange={(e) => setNewProvKey(e.target.value)}
                style={{
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: '1px solid var(--color-surface-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  flex: '2 1 320px'
                }}
              />
              <button className="btn" onClick={addProvider}>Add</button>
            </div>
          </div>



          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            {apiKeys.map((it) => (
              <div key={it.provider} style={{
                border: '1px solid var(--color-surface-border)',
                borderRadius: 12,
                padding: 12,
                background: 'var(--color-surface)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 900 }}>{it.name || it.provider}</div>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>{it.enabled ? `enabled · ${it.masked}` : 'disabled'}</div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                  <input
                    type="text"
                    placeholder="Display name (optional)"
                    value={apiNameDrafts?.[it.provider] ?? (it.name || '')}
                    onChange={(e) => setApiNameDrafts((d) => ({ ...d, [it.provider]: e.target.value }))}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: '1px solid var(--color-surface-border)',
                      background: 'var(--color-surface)',
                      color: 'var(--color-text)',
                      width: '100%'
                    }}
                  />
                  <button className="btn" onClick={() => saveProviderKey(it.provider)} style={{ opacity: 0.9 }}>Save</button>
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    type="password"
                    placeholder={`Set ${it.provider} API key`}
                    value={apiKeyDrafts?.[it.provider] || ''}
                    onChange={(e) => setApiKeyDrafts((d) => ({ ...d, [it.provider]: e.target.value }))}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: '1px solid var(--color-surface-border)',
                      background: 'var(--color-surface)',
                      color: 'var(--color-text)',
                      width: '100%'
                    }}
                  />
                  <button className="btn" onClick={() => saveProviderKey(it.provider)}>Save Key</button>
                  <button className="btn" onClick={() => deleteProvider(it.provider)} style={{ opacity: 0.85 }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'control' && (

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <div>
          <JsonEditor label="Oracle Curriculum + Routing Config (oracle/godmode.json)" value={cfgText} onChange={setCfgText} height={360} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" onClick={saveConfig}>Save Config</button>
            <button className="btn" onClick={() => runMeiReview(false)}>Run Mei Review</button>
            <button className="btn" onClick={() => runMeiReview(true)}>Full Recompute</button>
          </div>
        </div>

        <div>
          <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 700 }}>Oracle Push-Push Log (last 100)</div>
          <div style={{
            border: '1px solid var(--color-surface-border)',
            borderRadius: 12,
            padding: 10,
            height: 420,
            overflow: 'auto',
            background: 'var(--color-surface)'
          }}>
            {pushlog.length === 0 && <div style={{ opacity: 0.7, fontSize: 12 }}>No pushes logged yet.</div>}
            {pushlog.map((p) => (
              <div key={p.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--color-surface-border)' }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{p.createdAt} · {Array.isArray(p.targets) ? p.targets.join(', ') : ''}</div>
                <div style={{ fontSize: 12, opacity: 0.85 }}>{p.source?.url || ''}</div>
                <ul style={{ marginTop: 6, marginBottom: 0 }}>
                  {(p.bullets || []).slice(0, 6).map((b, i) => <li key={i} style={{ fontSize: 12 }}>{b}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div style={{ gridColumn: '1 / span 2' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 18 }}>
            <div>
              <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 700 }}>Agents</div>
              <div style={{
                border: '1px solid var(--color-surface-border)',
                borderRadius: 12,
                padding: 10,
                height: 320,
                overflow: 'auto',
                background: 'var(--color-surface)'
              }}>
                {agentsIndex.map((a) => (
                  <button
                    key={a.id}
                    className="btn"
                    style={{ width: '100%', marginBottom: 8, justifyContent: 'flex-start' }}
                    onClick={() => loadAgent(a.id)}
                  >
                    {a.id}
                  </button>
                ))}
              </div>

              <div style={{ marginTop: 10 }}>
                <div style={{ marginBottom: 6, fontSize: 12, fontWeight: 700 }}>Mei Knowledge Map (computed)</div>
                <div style={{ fontSize: 12, opacity: 0.85 }}>
                  generatedAt: {meiMap?.generatedAt || '—'}
                </div>
              </div>
            </div>


            <div>
              {selectedAgentId && agentObj && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 8 }}>LLM Policy (per-agent allowlist + 3-slot selection)</div>

                  <div style={{ display: 'flex', gap: 14, marginBottom: 12, flexWrap: 'wrap' }}>
                    <div style={{
                      flex: '1 1 420px',
                      border: '1px solid var(--color-surface-border)',
                      borderRadius: 14,
                      padding: 12,
                      background: 'var(--color-surface)'
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>Allowed Backends</div>
                      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                        <button className="btn" onClick={() => {
                          const next = ensureLlmPolicy(agentObj)
                          next.llmPolicy.allowedBackends = backendIds.slice()
                          // keep selection valid
                          const sel = next.llmPolicy.selection || {}
                          const list = next.llmPolicy.allowedBackends
                          const pick = (x) => list.includes(x) ? x : list[0]
                          next.llmPolicy.selection = {
                            primary: pick(sel.primary),
                            secondary: pick(sel.secondary),
                            backup: pick(sel.backup)
                          }
                          writeAgentObj(next)
                        }}>Select All</button>
                        <button className="btn" onClick={() => {
                          const next = ensureLlmPolicy(agentObj)
                          next.llmPolicy.allowedBackends = []
                          next.llmPolicy.selection = { primary: "", secondary: "", backup: "" }
                          writeAgentObj(next)
                        }}>Clear</button>
                        <div style={{ fontSize: 12, opacity: 0.75, alignSelf: 'center' }}>
                          (These are the only backends this agent may use)
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {backendIds.map((id) => {
                          const next = ensureLlmPolicy(agentObj)
                          const checked = next.llmPolicy.allowedBackends.includes(id)
                          return (
                            <label key={id} style={{
                              display: 'flex',
                              gap: 8,
                              alignItems: 'center',
                              border: '1px solid var(--color-surface-border)',
                              borderRadius: 12,
                              padding: '8px 10px'
                            }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const a = ensureLlmPolicy(agentObj)
                                  const set = new Set(a.llmPolicy.allowedBackends)
                                  if (e.target.checked) set.add(id)
                                  else set.delete(id)
                                  a.llmPolicy.allowedBackends = Array.from(set)
                                  // keep selection valid + unique-ish
                                  const list = a.llmPolicy.allowedBackends
                                  const sel = a.llmPolicy.selection || { primary: "", secondary: "", backup: "" }
                                  const pick = (x) => (list.includes(x) ? x : (list[0] || ""))
                                  a.llmPolicy.selection = {
                                    primary: pick(sel.primary),
                                    secondary: pick(sel.secondary),
                                    backup: pick(sel.backup)
                                  }
                                  writeAgentObj(a)
                                }}
                              />
                              <span style={{ fontSize: 12 }}>{backendLabel(id)}</span>
                            </label>
                          )
                        })}
                      </div>

                      <div style={{ marginTop: 10, fontSize: 11, opacity: 0.75 }}>
                        Tip: set Allowed Backends first, then use the wheel spinners to choose Primary/Secondary/Backup.
                      </div>
                    </div>

                    <div style={{ flex: '1 1 420px' }}>
                      <LlmTripleSpinner
                        allowed={(ensureLlmPolicy(agentObj).llmPolicy.allowedBackends || []).filter(Boolean)}
                        value={ensureLlmPolicy(agentObj).llmPolicy.selection || { primary:'', secondary:'', backup:'' }}
                        enforceUnique={true}
                        label="Primary / Secondary / Backup (wheel spinners)"
                        getLabel={backendLabel}
                        onChange={(sel) => {
                          const a = ensureLlmPolicy(agentObj)
                          // enforce that selections are inside allowlist
                          const list = a.llmPolicy.allowedBackends || []
                          const pick = (x) => (list.includes(x) ? x : (list[0] || ""))
                          a.llmPolicy.selection = {
                            primary: pick(sel.primary),
                            secondary: pick(sel.secondary),
                            backup: pick(sel.backup)
                          }
                          writeAgentObj(a)
                        }}
                      />
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <button className="btn" onClick={() => {
                          const a = ensureLlmPolicy(agentObj)
                          const list = a.llmPolicy.allowedBackends || []
                          a.llmPolicy.selection = {
                            primary: list[0] || "",
                            secondary: list[1] || list[0] || "",
                            backup: list[2] || list[1] || list[0] || ""
                          }
                          writeAgentObj(a)
                        }}>Reset to First 3</button>
                        <div style={{ fontSize: 12, opacity: 0.75, alignSelf: 'center' }}>
                          Shift+Wheel rotates all 3 together.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            <div>
              <JsonEditor
                label={selectedAgentId ? `Edit Agent JSON: ${selectedAgentId}` : 'Select an agent to edit'}
                value={agentText}
                onChange={setAgentText}
                height={320}
              />
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <button className="btn" onClick={saveAgent} disabled={!selectedAgentId}>Save Agent</button>
              </div>

              <JsonEditor
                label="Mei Knowledge Map JSON"
                value={meiMap ? JSON.stringify(meiMap, null, 2) : '{}'}
                onChange={(t) => { try { setMeiMap(JSON.parse(t)) } catch {} }}
                height={260}
              />
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  )
}
