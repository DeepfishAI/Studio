/**
 * Antigravity STT Module
 * Speech-to-Text using Windows Speech Recognition
 * 
 * Usage: node antigravity-stt.js
 * 
 * Zero dependencies - uses Windows built-in speech recognition.
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { writeFileSync, unlinkSync, existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import * as readline from 'readline';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// PowerShell script for speech recognition
const PS_SCRIPT = `
param([int]$Timeout = 10)

Add-Type -AssemblyName System.Speech

$recognizer = New-Object System.Speech.Recognition.SpeechRecognitionEngine
$recognizer.SetInputToDefaultAudioDevice()

$grammar = New-Object System.Speech.Recognition.DictationGrammar
$recognizer.LoadGrammar($grammar)

try {
    $result = $recognizer.Recognize([TimeSpan]::FromSeconds($Timeout))
    if ($result -and $result.Text) {
        Write-Output $result.Text
    } else {
        Write-Output "[NO_SPEECH]"
    }
} catch {
    Write-Output "[ERROR] $($_.Exception.Message)"
} finally {
    $recognizer.Dispose()
}
`;

/**
 * Listen for speech and convert to text
 * @param {number} timeoutSeconds - How long to listen (default 10s)
 * @returns {Promise<{success: boolean, text?: string, error?: string}>}
 */
export async function listen(timeoutSeconds = 10) {
    console.log(`[STT] 🎤 Listening for ${timeoutSeconds}s... (speak now)`);

    // Write script to temp file
    const scriptPath = join(__dirname, 'output', '_stt_temp.ps1');
    writeFileSync(scriptPath, PS_SCRIPT);

    try {
        const startTime = Date.now();

        // Execute PowerShell script file
        const { stdout, stderr } = await execAsync(
            `powershell -ExecutionPolicy Bypass -File "${scriptPath}" -Timeout ${timeoutSeconds}`,
            { timeout: (timeoutSeconds + 10) * 1000 }
        );

        const elapsed = Date.now() - startTime;
        const text = stdout.trim();

        // Clean up
        try { unlinkSync(scriptPath); } catch { }

        if (text === '[NO_SPEECH]' || text === '') {
            console.log(`[STT] No speech detected (${elapsed}ms)`);
            return { success: false, error: 'No speech detected' };
        }

        if (text.startsWith('[ERROR]')) {
            console.log(`[STT] Error: ${text}`);
            return { success: false, error: text };
        }

        console.log(`[STT] ✓ Recognized: "${text}" (${elapsed}ms)`);
        return { success: true, text, elapsed };

    } catch (err) {
        // Clean up on error
        try { unlinkSync(scriptPath); } catch { }

        if (err.killed) {
            return { success: false, error: 'Timeout - no speech detected' };
        }
        return { success: false, error: err.message };
    }
}

/**
 * Quick test 
 */
export async function testSTT() {
    return listen(5);
}

// CLI usage
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const timeout = parseInt(process.argv[2]) || 10;

    listen(timeout).then(result => {
        if (result.success) {
            // Output just the text for piping
            console.log(`\n📝 "${result.text}"`);
        } else {
            console.error(`[STT] ✗ ${result.error}`);
            process.exit(1);
        }
    });
}
