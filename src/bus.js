/**
 * Bus - Inter-Agent Communication System
 * Implements algebraic operations for agent coordination.
 * 
 * FEATURES:
 * - EventEmitter for internal async handling
 * - REDIS Persistence for crash recovery & history
 */

import crypto from 'crypto';
import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { getRedisUrl } from './config.js';

// Create global event bus (internal signal)
export const eventBus = new EventEmitter();

// Setup Persistence
let redis = null;
const redisUrl = getRedisUrl();

if (redisUrl) {
    console.log('[Bus] Redis configured. Connecting...');
    redis = new Redis(redisUrl);
    redis.on('error', (err) => console.error('[Bus] Redis Error:', err));
    redis.on('connect', () => console.log('[Bus] Redis Connected!'));
} else {
    console.log('[Bus] No Redis URL found. Running in IN-MEMORY mode (State will be lost on restart).');
}

// In-memory bus state (sync cache)
const busState = {
    messages: [],
    taskContexts: new Map()
};

/**
 * Generate a context hash for drift detection
 */
export function generateContextHash(originalRequest, taskId) {
    const input = `${originalRequest}|${taskId}`;
    return crypto.createHash('sha256').update(input).digest('hex').substring(0, 16);
}

/**
 * Create a new task context
 * @param {string} originalRequest - The original user request
 * @param {string} parentTaskId - Optional parent task ID for child tasks
 * @returns {Object} The created task context
 */
export async function createTaskContext(originalRequest, parentTaskId = null) {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const contextHash = generateContextHash(originalRequest, taskId);

    const context = {
        taskId,
        contextHash,
        originalRequest,
        createdAt: new Date().toISOString(),
        messages: [],
        status: 'active',
        // Parent-child relationship tracking
        parentTaskId,
        childTaskIds: [],
        childrenComplete: 0,
        deliverables: [] // Store child deliverables for aggregation
    };

    // 1. Update Memory
    busState.taskContexts.set(taskId, context);

    // 2. If this is a child task, register with parent
    if (parentTaskId) {
        const parent = busState.taskContexts.get(parentTaskId);
        if (parent) {
            parent.childTaskIds.push(taskId);
        }
    }

    // 3. Persist to Redis (if available)
    if (redis) {
        await redis.set(`task:${taskId}:context`, JSON.stringify(context));
        await redis.sadd('active_tasks', taskId); // Track active inputs
    }

    // Emit task created event
    eventBus.emit('task_created', { taskId, contextHash, originalRequest, parentTaskId });

    return context;
}

/**
 * Get task context (Memory -> Redis Fallback)
 */
export async function getTaskContext(taskId) {
    // 1. Try Memory
    if (busState.taskContexts.has(taskId)) {
        return busState.taskContexts.get(taskId);
    }

    // 2. Try Redis (Hydration)
    if (redis) {
        const json = await redis.get(`task:${taskId}:context`);
        if (json) {
            const context = JSON.parse(json);
            // Re-hydrate messages
            const messagesJson = await redis.lrange(`task:${taskId}:messages`, 0, -1);
            context.messages = messagesJson.map(m => JSON.parse(m));

            // Populate memory cache
            busState.taskContexts.set(taskId, context);
            return context;
        }
    }

    return null;
}

/**
 * Update task status
 */
export async function updateTaskStatus(taskId, status) {
    const context = await getTaskContext(taskId);
    if (context) {
        context.status = status;

        if (redis) {
            // Update context record
            await redis.set(`task:${taskId}:context`, JSON.stringify(context));

            // Manage active list
            if (status === 'completed' || status === 'failed') {
                await redis.srem('active_tasks', taskId);
                await redis.sadd('completed_tasks', taskId); // Track history
            }
        }

        eventBus.emit('task_status_changed', { taskId, status });
    }
}

/**
 * Save message to storage
 */
async function saveMessage(context, message) {
    // 1. Memory
    context.messages.push(message);
    busState.messages.push(message);

    // 2. Redis
    if (redis) {
        await redis.rpush(`task:${context.taskId}:messages`, JSON.stringify(message));
    }
}

/**
 * Bus Operations
 */
export const BusOps = {
    /**
     * DISPATCH - Route a task to an agent (Core Event)
     */
    DISPATCH: async (agentId, taskId, content) => {
        const context = await getTaskContext(taskId);
        if (!context) throw new Error(`Task ${taskId} not found`);

        const message = {
            type: 'DISPATCH',
            agentId, // Target
            taskId,
            content,
            contextHash: context.contextHash,
            timestamp: new Date().toISOString()
        };

        await saveMessage(context, message);
        eventBus.emit('bus_message', message);
        eventBus.emit('dispatch', message);
        return message;
    },

    // --- CUSTOM EVENT: KNOWLEDGE ---
    KNOWLEDGE: async (agentId, taskId, snippet) => {
        const context = await getTaskContext(taskId);
        if (!context) return; // Silent fail

        const message = {
            type: 'KNOWLEDGE',
            agentId,
            taskId,
            content: { snippet }, // Content is object
            contextHash: context.contextHash,
            timestamp: new Date().toISOString()
        };

        await saveMessage(context, message);
        eventBus.emit('bus_message', message);
        return message;
    },
    /**
     * ASSERT - Agent states their understanding
     */
    ASSERT: async (agentId, taskId, understanding) => {
        const context = await getTaskContext(taskId);
        if (!context) throw new Error(`Task ${taskId} not found`);

        const message = {
            type: 'ASSERT',
            agentId,
            taskId,
            content: understanding,
            contextHash: context.contextHash,
            timestamp: new Date().toISOString()
        };

        await saveMessage(context, message);

        // Emit event
        eventBus.emit('bus_message', message);
        eventBus.emit('assert', message);

        return message;
    },

    /**
     * QUERY - Agent asks a question to peers
     */
    QUERY: async (agentId, taskId, question, targetAgents = []) => {
        const context = await getTaskContext(taskId);
        if (!context) throw new Error(`Task ${taskId} not found`);

        const message = {
            type: 'QUERY',
            agentId,
            taskId,
            content: question,
            targetAgents,
            contextHash: context.contextHash,
            timestamp: new Date().toISOString(),
            requiresAck: true,
            acked: false
        };

        await saveMessage(context, message);

        // Emit event
        eventBus.emit('bus_message', message);
        eventBus.emit('query', message);

        return message;
    },

    /**
     * VALIDATE - Agent confirms work meets requirements
     */
    VALIDATE: async (agentId, taskId, deliverable, approved) => {
        const context = await getTaskContext(taskId);
        if (!context) throw new Error(`Task ${taskId} not found`);

        const message = {
            type: 'VALIDATE',
            agentId,
            taskId,
            content: deliverable,
            approved,
            contextHash: context.contextHash,
            timestamp: new Date().toISOString()
        };

        await saveMessage(context, message);

        // Emit event
        eventBus.emit('bus_message', message);
        eventBus.emit('validate', message);

        return message;
    },

    /**
     * CORRECT - Agent points out an error
     */
    CORRECT: async (agentId, taskId, correction, targetAgent) => {
        const context = await getTaskContext(taskId);
        if (!context) throw new Error(`Task ${taskId} not found`);

        const message = {
            type: 'CORRECT',
            agentId,
            taskId,
            content: correction,
            targetAgent,
            contextHash: context.contextHash,
            timestamp: new Date().toISOString(),
            requiresAck: true,
            acked: false
        };

        await saveMessage(context, message);

        // Emit event
        eventBus.emit('bus_message', message);
        eventBus.emit('correct', message);

        return message;
    },

    /**
     * ACK - Agent acknowledges receipt
     */
    ACK: async (agentId, taskId, messageId) => {
        const context = await getTaskContext(taskId);
        if (!context) throw new Error(`Task ${taskId} not found`);

        // Find and mark original message as acked
        const originalMessage = context.messages.find(
            m => m.timestamp === messageId && m.requiresAck
        );
        if (originalMessage) {
            originalMessage.acked = true;
            // TODO: Update the original message in Redis if strictly consistent ack tracking is needed
        }

        const message = {
            type: 'ACK',
            agentId,
            taskId,
            referencedMessage: messageId,
            timestamp: new Date().toISOString()
        };

        await saveMessage(context, message);

        // Emit event
        eventBus.emit('bus_message', message);
        eventBus.emit('ack', message);

        return message;
    },

    /**
     * HANDOFF - Agent hands off work to another agent
     */
    HANDOFF: async (fromAgentId, toAgentId, taskId, workPackage) => {
        const context = await getTaskContext(taskId);
        if (!context) throw new Error(`Task ${taskId} not found`);

        const message = {
            type: 'HANDOFF',
            agentId: fromAgentId,
            toAgentId,
            taskId,
            content: workPackage,
            contextHash: context.contextHash,
            timestamp: new Date().toISOString()
        };

        await saveMessage(context, message);

        // Emit event - this is important for orchestration
        eventBus.emit('bus_message', message);
        eventBus.emit('handoff', message);

        return message;
    },

    /**
     * COMPLETE - Agent signals task completion
     */
    COMPLETE: async (agentId, taskId, deliverable) => {
        const context = await getTaskContext(taskId);
        if (!context) throw new Error(`Task ${taskId} not found`);

        const message = {
            type: 'COMPLETE',
            agentId,
            taskId,
            content: deliverable,
            contextHash: context.contextHash,
            timestamp: new Date().toISOString()
        };

        await saveMessage(context, message);
        context.status = 'completed';

        if (redis) {
            await redis.set(`task:${taskId}:context`, JSON.stringify(context));
            await redis.srem('active_tasks', taskId);
        }

        // Emit event - wakes Mei
        eventBus.emit('bus_message', message);
        eventBus.emit('complete', message);
        eventBus.emit('task_complete', { taskId, agentId, deliverable });

        // 🆕 PARENT NOTIFICATION: If this task has a parent, notify it
        if (context.parentTaskId) {
            const parent = await getTaskContext(context.parentTaskId);
            if (parent) {
                parent.childrenComplete++;
                parent.deliverables.push({ agentId, taskId, deliverable });

                // Update parent in Redis
                if (redis) {
                    await redis.set(`task:${context.parentTaskId}:context`, JSON.stringify(parent));
                }

                // Check if all children are done
                if (parent.childrenComplete === parent.childTaskIds.length) {
                    console.log(`[Bus] All children complete for parent ${context.parentTaskId}. Triggering aggregation.`);
                    eventBus.emit('all_children_complete', {
                        parentTaskId: context.parentTaskId,
                        deliverables: parent.deliverables
                    });
                }
            }
        }

        return message;
    },

    /**
     * BLOCKER - Agent signals they're blocked
     */
    BLOCKER: async (agentId, taskId, blockerDescription) => {
        const context = await getTaskContext(taskId);
        if (!context) throw new Error(`Task ${taskId} not found`);

        const message = {
            type: 'BLOCKER',
            agentId,
            taskId,
            content: blockerDescription,
            contextHash: context.contextHash,
            timestamp: new Date().toISOString()
        };

        await saveMessage(context, message);

        // Emit event - wakes Mei
        eventBus.emit('bus_message', message);
        eventBus.emit('blocker', message);

        return message;
    },

    /**
     * WAKE - Explicit wake signal (for hydration/recovery)
     */
    WAKE: async () => {
        if (!redis) return [];

        // Find tasks that were active last time
        const activeTasks = await redis.smembers('active_tasks');
        const tasks = [];

        for (const taskId of activeTasks) {
            const ctx = await getTaskContext(taskId);
            if (ctx) tasks.push(ctx);
        }

        return tasks;
    }
};

/**
 * Get bus transcript for a task
 */
export function getTaskTranscript(taskId) {
    // Note: This is synchronous access to memory cache.
    // If relying on hydration, ensure getTaskContext was called first.
    if (busState.taskContexts.has(taskId)) {
        return busState.taskContexts.get(taskId).messages;
    }
    return [];
}

/**
 * Get all active tasks
 */
export function getActiveTasks() {
    // Returns in-memory view. 
    // Use BusOps.WAKE() to hydrate from Redis on startup.
    const active = [];
    busState.taskContexts.forEach((context, taskId) => {
        if (context.status === 'active') {
            active.push({ taskId, ...context });
        }
    });
    return active;
}

/**
 * Verify context hash hasn't drifted
 */
export function verifyContext(taskId, providedHash) {
    // Check memory first
    const context = busState.taskContexts.get(taskId);
    if (!context) return false;
    return context.contextHash === providedHash;
}

/**
 * Subscribe to bus events
 */
export function subscribe(event, handler) {
    eventBus.on(event, handler);
    return () => eventBus.off(event, handler);
}

/**
 * Subscribe to bus events (once)
 */
export function subscribeOnce(event, handler) {
    eventBus.once(event, handler);
}

/**
 * Get all logs from all task contexts
 * Returns array of all messages sorted by timestamp
 */
export function getAllLogs(limit = 100) {
    const allMessages = [];

    // Collect messages from all task contexts
    busState.taskContexts.forEach((context, taskId) => {
        if (context.messages && Array.isArray(context.messages)) {
            context.messages.forEach(msg => {
                allMessages.push({
                    ...msg,
                    taskId,
                    originalRequest: context.originalRequest?.substring(0, 50)
                });
            });
        }
    });

    // Sort by timestamp (newest first)
    allMessages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Return limited amount
    return allMessages.slice(0, limit);
}

/**
 * Get all active task contexts with their message counts
 */
export function getTaskSummaries() {
    const summaries = [];
    busState.taskContexts.forEach((context, taskId) => {
        summaries.push({
            taskId,
            status: context.status,
            originalRequest: context.originalRequest?.substring(0, 100),
            messageCount: context.messages?.length || 0,
            createdAt: context.createdAt
        });
    });
    return summaries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
