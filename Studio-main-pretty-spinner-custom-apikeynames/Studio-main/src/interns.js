/**
 * DeepFish Intern System
 * Spawns ephemeral LLM instances ("Clones") of managers, skinned with specific talent.
 * 
 * REFACTORED: Now loads from talent-pool.json and implements "Clone" architecture.
 */

import { chat } from './llm.js';
import { eventBus } from './bus.js';
import crypto from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLIENT_DIR = join(__dirname, '..');
const AGENTS_DIR = join(CLIENT_DIR, 'agents');

// Generate UUID using native crypto
const generateId = () => crypto.randomUUID();

// Active interns tracking
const activeInterns = new Map();

// Cache for talent pool data
let talentPoolCache = null;

/**
 * Load the talent pool configuration
 */
function loadTalentPool() {
    if (talentPoolCache) return talentPoolCache;

    try {
        const path = join(AGENTS_DIR, 'talent-pool.json');
        if (existsSync(path)) {
            const content = readFileSync(path, 'utf-8');
            talentPoolCache = JSON.parse(content);
            return talentPoolCache;
        }
    } catch (err) {
        console.error('Failed to load talent-pool.json:', err);
    }
    return { teams: {}, statusTypes: {} };
}

/**
 * Get the configuration for a specific named intern (e.g. "yuki", "bella")
 */
function getInternConfig(managerId, internId) {
    const pool = loadTalentPool();

    // Find the team for this manager
    let teamKey = null;
    for (const [key, team] of Object.entries(pool.teams)) {
        if (team.manager.toLowerCase() === managerId.toLowerCase()) {
            teamKey = key;
            break;
        }
    }

    if (!teamKey) return null; // Manager has no team

    const team = pool.teams[teamKey];
    const talent = team.talent.find(t => t.id === internId);

    if (!talent) return null;

    // Get status/rank config for token limits
    const statusConfig = pool.statusTypes[talent.status] || { llm_tokens: 1000, label: 'Unknown' };

    return {
        ...talent,
        teamSpecialty: team.specialty,
        tokenLimit: statusConfig.llm_tokens
    };
}

/**
 * Spawn an intern (Manager Clone) to perform a task
 * @param {string} managerId - The ID of the manager spawning the clone (e.g. "creative")
 * @param {string} internId - The ID of the specific talent to skin (e.g. "yuki")
 * @param {string} task - The task description
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} The intern's deliverable
 */
export async function spawnIntern(managerId, internId, task, options = {}) {
    const internConfig = getInternConfig(managerId, internId);

    if (!internConfig) {
        throw new Error(`Intern '${internId}' not found for manager '${managerId}'`);
    }

    const runId = generateId();
    const { context = '' } = options;

    // Register intern instance
    const internInstance = {
        id: runId,
        internId: internConfig.id, // The persistent ID (yuki)
        name: internConfig.name,
        role: internConfig.status,
        managerId,
        task,
        status: 'working',
        startTime: Date.now()
    };
    activeInterns.set(runId, internInstance);

    // Emit spawn event
    eventBus.emit('intern_spawn', {
        runId,
        internId: internConfig.id,
        name: internConfig.name,
        managerId,
        task
    });

    console.log(`[Intern] Spawning clone: ${internConfig.name} (${internConfig.status}) for ${managerId}`);

    try {
        // --- BUILD THE CLONE PROMPT ---
        // 1. Base Identity: "You are [Name], a [Status] under [Manager]."
        // 2. Specialty: "You specialize in [Skills]."
        // 3. Directive: "You are a parallel instance of the [Manager] department."

        let systemPrompt = `You are ${internConfig.name}, a ${internConfig.status.replace('_', ' ')} working for the ${managerId} department.\n`;
        systemPrompt += `Your Core Skills: ${internConfig.skills.join(', ')}.\n`;
        systemPrompt += `Department Specialty: ${internConfig.teamSpecialty}.\n\n`;

        systemPrompt += `PRIME DIRECTIVE:\n`;
        systemPrompt += `- You are a "Clone" instance designed for parallel execution.\n`;
        systemPrompt += `- Execute the user's task specifically using your unique skills.\n`;
        systemPrompt += `- Be concise, professional, and efficient.\n`;

        // Add specific output format based on role (heuristic)
        if (internConfig.skills.includes('code') || internConfig.skills.includes('React') || internConfig.skills.includes('backend')) {
            systemPrompt += `\nOUTPUT FORMAT: Return production-ready code blocks only. No fluff.`;
        } else if (internConfig.skills.includes('design') || internConfig.skills.includes('UI')) {
            systemPrompt += `\nOUTPUT FORMAT: Describe visual assets or return CSS/SVG code if applicable.`;
        }

        // Build user message
        const userMessage = `${context ? context + '\n\n' : ''}Task: ${task}`;

        // Call LLM with token limit based on RANK
        const response = await chat(
            systemPrompt,
            userMessage,
            { maxTokens: internConfig.tokenLimit || 2000 }
        );

        // Build deliverable
        const deliverable = {
            runId,
            internId: internConfig.id,
            name: internConfig.name,
            content: response,
            completedAt: Date.now(),
            duration: Date.now() - internInstance.startTime
        };

        // Update status
        internInstance.status = 'complete';
        internInstance.deliverable = deliverable;

        // Emit completion event
        eventBus.emit('intern_complete', {
            runId,
            internId: internConfig.id,
            managerId,
            deliverable
        });

        console.log(`[Intern] ${internConfig.name} completed in ${deliverable.duration}ms`);

        // Cleanup
        setTimeout(() => {
            activeInterns.delete(runId);
        }, 5000);

        return deliverable;

    } catch (error) {
        internInstance.status = 'failed';
        internInstance.error = error.message;

        eventBus.emit('intern_failed', {
            runId,
            internId: internConfig.id,
            managerId,
            error: error.message
        });

        console.error(`[Intern] ${internConfig.name} failed:`, error.message);
        throw error;
    }
}

/**
 * Spawn multiple interns in parallel
 * @param {Array} tasks - Array of { managerId, internId, task, options }
 * @returns {Promise<Array>} Array of deliverables
 */
export async function spawnInternTeam(tasks) {
    console.log(`[Intern] Spawning team of ${tasks.length} clones...`);

    const promises = tasks.map(({ managerId, internId, task, options }) =>
        spawnIntern(managerId, internId, task, options)
    );

    const results = await Promise.allSettled(promises);

    return results.map((result, i) => ({
        internId: tasks[i].internId,
        success: result.status === 'fulfilled',
        deliverable: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason.message : null
    }));
}

/**
 * Get active interns
 */
export function getActiveInterns() {
    return Array.from(activeInterns.values());
}

/**
 * Get available talent for a manager
 */
export function getAvailableTalent(managerId) {
    const pool = loadTalentPool();
    for (const team of Object.values(pool.teams)) {
        if (team.manager.toLowerCase() === managerId.toLowerCase()) {
            return team.talent;
        }
    }
    return [];
}

export default {
    spawnIntern,
    spawnInternTeam,
    getActiveInterns,
    getAvailableTalent
};
