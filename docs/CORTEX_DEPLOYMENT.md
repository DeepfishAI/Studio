# CORTEX Deployment Guide

## Overview

The **AI Cortex** is DeepFish's Python sidecar providing RAG (Retrieval-Augmented Generation) and Safety features powered by NVIDIA APIs.

## Architecture

```
┌─────────────────────────────┐    ┌─────────────────────────────┐
│  Node.js (Port 3001)        │    │  Python (Port 8000)         │
│  ────────────────────────   │    │  ────────────────────────   │
│  • Express API              │◄──►│  • bridge_server.py         │
│  • Agent Orchestrator       │    │  • RAG Client               │
│  • Twilio/Voice             │    │  • Safety Client            │
│  • React Frontend           │    │  • NVIDIA API calls         │
└─────────────────────────────┘    └─────────────────────────────┘
```

## Local Development

```bash
# Terminal 1: Start Node.js server
npm run server

# Terminal 2: Start Python bridge
python src/bridge_server.py
```

Or use the combined command:
```bash
npm start  # Runs both via concurrently
```

## Production (Railway)

> **Note**: Railway only exposes ONE port per service. The current architecture is designed for **local development only**.

### Current Behavior
- The CORTEX runs on `localhost:8000` which doesn't exist in Railway
- Agents gracefully degrade without RAG/Safety features
- Dashboard shows "AI Cortex: Offline" (expected)

### Future Options

1. **Separate Service** - Deploy Python as its own Railway service with public URL, set `BRIDGE_URL` env var
2. **Serverless Functions** - Convert to Vercel/Netlify functions
3. **Embedded Logic** - Rewrite RAG/Safety in JavaScript

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BRIDGE_URL` | `http://localhost:8000` | URL of Python bridge server |
| `NVIDIA_API_KEY` | - | Required for RAG/Safety APIs |
| `ENABLE_SAFETY` | `true` | Enable/disable safety checks |

## Endpoints

### Status
```
GET /api/bridge/status
→ { "status": "online", "services": ["rag", "safety"] }
```

### RAG Query
```
POST /api/bridge/rag/query
Body: { "query": "...", "collection": "default" }
→ { "chunk": "..." }
```

### Safety Check
```
POST /api/bridge/safety/check
Body: { "text": "...", "mode": "input|output" }
→ { "safe": true|false }
```
