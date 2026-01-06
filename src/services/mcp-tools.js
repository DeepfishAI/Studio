/**
 * MCP Tools Module
 * Unified interface for all MCP tools: dispatch, browse, bus, invoke_skill
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { skills } from '../domain/skills.js';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// Load config
function loadConfig() {
    try {
        const configPath = join(ROOT, 'virtual_office.json');
        return JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch (err) {
        return { _config: { routing: { rules: [] }, agents: [] } };
    }
}

// Bus state
const busState = {
    messages: [],
    taskContexts: new Map()
};

/**
 * DISPATCH Tool
 * Route a task to the appropriate agent based on keywords
 */
export async function dispatch(task, keywords = null) {
    const config = loadConfig();
    const rules = config._config?.routing?.rules || [];

    // Extract keywords if not provided
    const taskLower = task.toLowerCase();
    const extractedKeywords = keywords || taskLower.split(/\s+/).filter(w => w.length > 2);

    // Find matching rule
    let matchedRule = null;
    let matchedKeyword = null;

    for (const rule of rules) {
        const triggers = rule.trigger || [];
        for (const trigger of triggers) {
            if (taskLower.includes(trigger.toLowerCase())) {
                matchedRule = rule;
                matchedKeyword = trigger;
                break;
            }
        }
        if (matchedRule) break;
    }

    if (!matchedRule) {
        return {
            success: true,
            tool: 'dispatch',
            result: {
                task,
                route: 'mei',
                delegate: null,
                reason: 'No specific keyword match, defaulting to Mei',
                keywords: extractedKeywords
            }
        };
    }

    return {
        success: true,
        tool: 'dispatch',
        result: {
            task,
            route: matchedRule.route,
            delegate: matchedRule.delegate || null,
            routeSequence: matchedRule.route_sequence || null,
            matchedKeyword,
            reason: `Matched keyword: "${matchedKeyword}"`
        }
    };
}

/**
 * BROWSE Tool
 * Interface to browser capabilities (stub - would connect to Antigravity browser)
 */
export async function browse(action, target) {
    const validActions = ['navigate', 'click', 'type', 'screenshot', 'read_dom'];

    if (!validActions.includes(action)) {
        return {
            success: false,
            tool: 'browse',
            error: `Invalid action: ${action}. Valid: ${validActions.join(', ')}`
        };
    }

    // Stub implementation - would connect to actual browser
    return {
        success: true,
        tool: 'browse',
        result: {
            action,
            target,
            status: 'simulated',
            message: `Would ${action} on: ${target}`,
            note: 'Browser integration requires Antigravity browser runtime'
        }
    };
}

import { BusOps, eventBus, createTaskContext } from '../infra/bus.js';

/**
 * BUS Tool
 * Algebraic communication bus for inter-agent coordination
 * Wraps the unified bus logic in src/bus.js
 */
export async function bus(operation, payload, taskId = null) {
    const validOps = ['ASSERT', 'QUERY', 'VALIDATE', 'CORRECT', 'ACK', 'COMPLETE', 'BLOCKER'];

    if (!validOps.includes(operation)) {
        return {
            success: false,
            tool: 'bus',
            error: `Invalid operation: ${operation}. Valid: ${validOps.join(', ')}`
        };
    }

    // Generate task context if none exists (usually created by Mei)
    let contextTaskId = taskId;
    if (!contextTaskId) {
        const context = await createTaskContext(typeof payload === 'string' ? payload : JSON.stringify(payload));
        contextTaskId = context.taskId;
    }

    // Execute through unified BusOps
    const opFunc = BusOps[operation];
    if (!opFunc) {
        return { success: false, error: `Operation ${operation} not implemented in BusOps` };
    }

    // Agent ID is usually inferred from the context of who is calling the tool
    // but for the tool call we just use 'system' or the caller
    const agentId = 'agent';

    const message = await opFunc(agentId, contextTaskId, payload);

    return {
        success: true,
        tool: 'bus',
        result: {
            operation,
            messageId: message.timestamp,
            taskId: contextTaskId,
            status: 'delivered'
        }
    };
}

/**
 * Get bus status and recent messages
 */
export async function getBusStatus() {
    const { getTaskSummaries, getAllLogs } = await import('../infra/bus.js');
    return {
        tasks: getTaskSummaries(),
        recentLogs: getAllLogs(10)
    };
}

/**
 * Clear bus for a task
 * No longer directly clears memory - relies on the orchestrator lifecycle
 */
export function clearBus(taskId = null) {
    return { success: true, message: "Use the orchestrator to manage task lifecycle" };
}

/**
 * INVOKE_SKILL Tool
 * Invoke a modular skill by ID
 */
export async function invokeSkill(skillId, inputs = {}) {
    return skills.invoke(skillId, inputs);
}

/**
 * List available skills
 */
export function listAvailableSkills() {
    const skillsDir = join(ROOT, 'tools');
    try {
        const files = readdirSync(skillsDir);
        return files
            .filter(f => f.endsWith('.json') && !f.includes('.user.'))
            .map(f => {
                const skillId = f.replace('.json', '');
                const skill = skills.get(skillId);
                return {
                    id: skillId,
                    name: skill?.skill_id || skillId,
                    description: skill?.description || 'No description'
                };
            });
    } catch (err) {
        return [];
    }
}

// Export all tools
export const mcpTools = {
    dispatch,
    browse,
    bus,
    invokeSkill,
    getBusStatus,
    clearBus,
    listSkills: listAvailableSkills
};
