---
description: Boot script for Railway sync and initialization
---

// turbo-all

1. Ensure Railway CLI is logged in
```powershell
railway.cmd login
```

2. Sync Railway API keys to local configuration (Primary Data Source)
```powershell
npm run secrets:sync
```
