---
description: Connect to the Railway project for this repo.
---

1. Check if logged in. If this fails with "Unauthorized", please run `railway login` in your terminal.
railway list

2. Link the DeepfishAI project (ID: f963172f-253c-42b2-9406-04167aaf4c5a).
railway link f963172f-253c-42b2-9406-04167aaf4c5a

3. Verify connection by fetching logs.
railway logs --build
