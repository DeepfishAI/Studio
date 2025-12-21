/**
 * Tool Registry
 * Loads and exposes all available tools to agents.
 */

import * as fsTools from './fs.js';
import * as imageTools from './images.js';

const allTools = {
    ...fsTools.tools,
    ...imageTools.tools
};

/**
 * Get tool definitions for system prompt
 */
export function getToolDefinitions() {
    return Object.values(allTools).map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters
    }));
}

/**
 * Execute a tool by name
 */
export async function executeTool(name, args) {
    const tool = allTools[name];
    if (!tool) {
        throw new Error(`Tool ${name} not found`);
    }

    try {
        console.log(`[Tool] Executing ${name} with args:`, JSON.stringify(args));
        const result = await tool.execute(args);
        return result;
    } catch (err) {
        console.error(`[Tool] Error executing ${name}:`, err);
        return `Error: ${err.message}`;
    }
}
