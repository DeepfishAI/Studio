---
description: How to fix config.secrets.json loading issues (Twilio, ElevenLabs, LLM keys not loading)
---

# Config Secrets Troubleshooting

## Common Symptoms
- Server shows `Twilio: DISABLED` or `ElevenLabs Voice: DISABLED`
- Server shows `Anthropic Key: NOT SET`
- Error: `Could not parse config.secrets.json`

## Root Causes & Fixes

### 1. UTF-8 BOM (Most Common)
PowerShell adds invisible `﻿` at file start which breaks JSON.parse()

**Diagnose:**
```bash
node -e "const fs = require('fs'); const c = fs.readFileSync('config.secrets.json'); console.log('First byte:', c[0]);"
# If shows 239 (0xEF), you have BOM
```

**Fix - Recreate with Node.js:**
// turbo
```bash
node -e "const fs = require('fs'); const config = { redis_url: '', llm_providers: { anthropic: { api_key: 'YOUR_KEY', enabled: true } }, twilio: { account_sid: 'YOUR_SID', auth_token: 'YOUR_TOKEN', phone_number: 'YOUR_NUMBER', enabled: true }, elevenlabs: { api_key: 'YOUR_KEY', enabled: true }, tier: 'platinum' }; fs.writeFileSync('config.secrets.json', JSON.stringify(config, null, 2));"
```

### 2. Missing Sections in JSON
The `config.js` merge logic requires specific structure:

**Required Structure:**
```json
{
  "llm_providers": { "anthropic": { "api_key": "...", "enabled": true } },
  "twilio": { "account_sid": "...", "auth_token": "...", "phone_number": "...", "enabled": true },
  "elevenlabs": { "api_key": "...", "enabled": true }
}
```

### 3. Railway vs Local
- **On Railway**: Uses `process.env.*` directly (no config.secrets.json needed)
- **Locally**: Reads `config.secrets.json` and merges into config

### 4. Verify Config Loading
// turbo
```bash
node -e "const { loadConfig } = await import('./src/config.js'); const c = loadConfig(); console.log('Twilio enabled:', c.twilio?.enabled); console.log('ElevenLabs enabled:', c.elevenlabs?.enabled);"
```

## Quick Recovery Command
If all else fails, copy from Railway:
```bash
railway variables --json > railway_vars.json
# Then manually add keys to config.secrets.json
```
