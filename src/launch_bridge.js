import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Detect command: 'python' for Windows, 'python3' for Linux/Mac
const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';

console.log(`[Bridge Launcher] 🚀 Launching bridge_server.py using: ${pythonCommand}`);

const bridgeProcess = spawn(pythonCommand, ['src/bridge_server.py'], {
    stdio: 'inherit', // Pipe output directly to console
    shell: true
});

bridgeProcess.on('error', (err) => {
    console.error(`[Bridge Launcher] ❌ Failed to start bridge:`, err);
});

bridgeProcess.on('close', (code) => {
    console.log(`[Bridge Launcher] Bridge process exited with code ${code}`);
    process.exit(code);
});
