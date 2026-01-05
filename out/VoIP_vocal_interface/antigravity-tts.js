/**
 * Antigravity TTS Module
 * Fast, low-latency text-to-speech via ElevenLabs
 * 
 * Usage: node antigravity-tts.js "Text to speak"
 * 
 * Optimized for SPEED over quality:
 * - Uses Flash v2.5 model (~75ms latency)
 * - Streaming endpoint for progressive playback
 * - Maximum latency optimization (level 4)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Fast defaults
const MODEL = 'eleven_flash_v2_5';  // Fastest model available
const DEFAULT_VOICE = 'ngiiW8FFLIdMew1cqwSB';  // Mei - clear, efficient, friendly
const OPTIMIZE_LATENCY = 4;  // Max speed (0-4 scale)

// Load API key from config.secrets.json
function getApiKey() {
    try {
        const configPath = join(__dirname, 'config.secrets.json');
        const config = JSON.parse(readFileSync(configPath, 'utf-8'));
        // Try both paths for compatibility
        return config.elevenlabs?.api_key || config.voice?.elevenlabs?.api_key || null;
    } catch (err) {
        console.error('Could not load ElevenLabs API key from config.secrets.json');
        return null;
    }
}

// Ensure output directory exists
function ensureOutputDir() {
    const outputDir = join(__dirname, 'output');
    if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
    }
    return outputDir;
}

/**
 * Convert text to speech and play it
 * @param {string} text - Text to speak
 * @param {string} voiceId - Optional voice ID override
 * @returns {Promise<{success: boolean, audioFile?: string, error?: string}>}
 */
export async function speakText(text, voiceId = DEFAULT_VOICE) {
    const apiKey = getApiKey();
    if (!apiKey) {
        return { success: false, error: 'No ElevenLabs API key configured' };
    }

    if (!text || text.trim().length === 0) {
        return { success: false, error: 'No text provided' };
    }

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?optimize_streaming_latency=${OPTIMIZE_LATENCY}&output_format=mp3_22050_32`;

    try {
        console.log(`[TTS] Generating speech (${text.length} chars)...`);
        const startTime = Date.now();

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'xi-api-key': apiKey,
                'Content-Type': 'application/json',
                'Accept': 'audio/mpeg'
            },
            body: JSON.stringify({
                text: text,
                model_id: MODEL,
                voice_settings: {
                    stability: 0.3,        // Lower = faster generation
                    similarity_boost: 0.5  // Balance speed and quality
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            return { success: false, error: `API error ${response.status}: ${errorText}` };
        }

        // Get audio buffer
        const audioBuffer = await response.arrayBuffer();
        const genTime = Date.now() - startTime;
        console.log(`[TTS] Audio generated in ${genTime}ms`);

        // Save to temp file
        const outputDir = ensureOutputDir();
        const tempFile = join(outputDir, `tts_${Date.now()}.mp3`);
        writeFileSync(tempFile, Buffer.from(audioBuffer));

        // Play audio (Windows)
        console.log(`[TTS] Playing audio...`);
        await playAudio(tempFile);

        return { success: true, audioFile: tempFile, generationTime: genTime };

    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Play audio file on Windows
 */
async function playAudio(filePath) {
    try {
        // Use Windows Media Player COM object for faster startup than SoundPlayer
        const cmd = `powershell -Command "Add-Type -AssemblyName presentationCore; $player = New-Object System.Windows.Media.MediaPlayer; $player.Open('${filePath.replace(/'/g, "''")}'); $player.Play(); Start-Sleep -Milliseconds 100; while ($player.NaturalDuration.HasTimeSpan -eq $false -or $player.Position -lt $player.NaturalDuration.TimeSpan) { Start-Sleep -Milliseconds 100 }; $player.Close()"`;
        await execAsync(cmd, { timeout: 60000 });
    } catch (err) {
        // Fallback: just open with default app
        try {
            await execAsync(`start "" "${filePath}"`, { shell: true });
        } catch (fallbackErr) {
            console.error('[TTS] Could not auto-play audio:', fallbackErr.message);
        }
    }
}

/**
 * Quick test function
 */
export async function testTTS() {
    return speakText("Hello! This is a test of the text to speech system. Can you hear me?");
}

// CLI usage
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const text = process.argv.slice(2).join(' ') || "Hello, I am ready to assist you.";

    speakText(text).then(result => {
        if (result.success) {
            console.log(`[TTS] ✓ Complete (${result.generationTime}ms)`);
        } else {
            console.error(`[TTS] ✗ Failed: ${result.error}`);
            process.exit(1);
        }
    });
}
