
import { getAgent } from '../domain/agent.js';
import { tools } from '../domain/tools/fs.js';

// Helper to delay for dramatic effect
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function runSimulation() {
    console.log("🎬 Starting Tetris 'Frogs to Blocks' Simulation...\n");

    const mei = getAgent('mei');
    const hanna = getAgent('hanna');
    const it = getAgent('it');

    // --- STEP 1: INITIALIZATION ---
    console.log("\n--- [STEP 1] MEI INITIALIZES PROJECT ---");
    // Mei creates the initial state
    await mei.process("Start the Tetris project. Create 'workspace/tetris/state.json' with initial requirements for a Python Tetris game using Pygame. Set turn to 'hanna'.");

    await delay(3000);

    // --- STEP 2: HANNA'S MISTAKE ---
    console.log("\n--- [STEP 2] HANNA'S MISTAKE (THE FROGS) ---");
    // We explicitly confuse Hanna to force the error
    await hanna.process(`
        It is your turn. Read 'workspace/tetris/state.json'. 
        [DIRECTOR'S NOTE: You are confused. You think "Tetris" is a game about frogs crossing the street. 
        Generate 8-bit FROG assets instead of blocks. Update state.json to set turn to 'it' and status to 'assets_ready'.]
    `);

    await delay(3000);

    // --- STEP 3: IT REJECTS ---
    console.log("\n--- [STEP 3] IT REJECTS THE ASSETS ---");
    await it.process(`
        It is your turn. Read 'workspace/tetris/state.json'. Check the assets Hanna made.
        [DIRECTOR'S NOTE: You see FROGS. Tetris does not have frogs. REJECT the work. 
        Update state.json to set turn to 'hanna' and status to 'rejected' with a distinct critique.]
    `);

    await delay(3000);

    // --- STEP 4: HANNA FIXES ---
    console.log("\n--- [STEP 4] HANNA FIXES (BLOCKS) ---");
    await hanna.process(`
        It is your turn. Read 'workspace/tetris/state.json'. 
        Oh no! You made frogs. Fix it. Generate proper neon-style Tetris block assets using Nano Banana.
        Update state.json to set turn to 'it' and status to 'assets_fixed'.
    `);

    await delay(3000);

    // --- STEP 5: IT CODES (JUJUBEE) ---
    console.log("\n--- [STEP 5] IT CODES (JUJUBEE) ---");
    await it.process(`
        It is your turn. Read 'workspace/tetris/state.json'. Assets look good. 
        Write the complete Python Tetris game code into 'workspace/tetris/game.py' using your 'best' model (Jujubee 2).
        Be sure to use the 'write_file' tool.
        Update state.json to set status to 'code_complete'.
    `);

    console.log("\n🎬 Simulation Complete. Check 'workspace/tetris/game.py'.");
}

// Run if called directly
runSimulation().catch(console.error);
