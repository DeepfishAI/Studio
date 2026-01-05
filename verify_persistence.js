
import fs from 'fs';

// Node 18+ has native fetch. No import needed.

async function testPersistence() {
    console.log("🔍 Testing User Overlay Persistence...");

    const originalConfig = JSON.parse(fs.readFileSync('agents/mei.user.json', 'utf-8'));

    // 1. Modify User Config directly
    const newSkin = "cyberpunk_" + Date.now();
    console.log(`📝 setting activeSkin to: ${newSkin}`);

    const hackedConfig = { ...originalConfig };
    if (!hackedConfig.preferences) hackedConfig.preferences = {};
    if (!hackedConfig.preferences.skin) hackedConfig.preferences.skin = {};
    hackedConfig.preferences.skin.activeSkin = newSkin;

    fs.writeFileSync('agents/mei.user.json', JSON.stringify(hackedConfig, null, 4));

    // 2. Fetch from API
    try {
        console.log("📡 Fetching from API...");
        const response = await fetch('http://localhost:3001/api/chat/agents');
        if (!response.ok) throw new Error(`HTTP Error ${response.status}`);

        const data = await response.json();
        const mei = data.agents.find(a => a.id === 'mei');

        console.log(`📡 API returned skin: ${mei ? mei.skin : 'UNKNOWN'}`);

        if (mei && mei.skin === newSkin) {
            console.log("✅ SUCCESS: API reflects user.json changes!");
        } else {
            console.log("❌ FAILURE: API did not reflect changes.");
            console.log("   (This is expected if the server was not restarted. Vesper loads agents on startup.)");
        }

    } catch (e) {
        console.log("⚠️ API fetch failed:", e.message);
    }

    // Restore
    fs.writeFileSync('agents/mei.user.json', JSON.stringify(originalConfig, null, 4));
    console.log("🧹 Restored original config.");
}

testPersistence();
