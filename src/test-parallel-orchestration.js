/**
 * Test: Parallel Multi-Agent Orchestration
 * 
 * This test demonstrates the full loop circuit where:
 * 1. Mei receives a complex question
 * 2. Divides it into 2 parallel child tasks
 * 3. Dispatches to different agents (Hanna + IT)
 * 4. Each agent processes via their LLM
 * 5. Bus aggregates results when all children complete
 * 6. Mei compiles final answer
 */

import { Agent } from './agent.js';
import { Mei } from './mei.js';
import { eventBus, createTaskContext, BusOps } from './bus.js';

// Test Configuration
const TEST_QUESTION = "Design a login page and write the authentication code";
const TIMEOUT_MS = 60000; // 60 seconds - increased to handle LLM provider fallbacks

// Agent Configuration
const AGENTS = {
    hanna: {
        id: 'hanna',
        task: 'Design a beautiful, modern login page UI with best UX practices'
    },
    it: {
        id: 'it',
        task: 'Write secure authentication backend code with password hashing and JWT tokens'
    }
};

console.log('\n===========================================');
console.log('🧪 PARALLEL MULTI-AGENT ORCHESTRATION TEST');
console.log('===========================================\n');

/**
 * Main orchestration function (Mei's role)
 */
async function runParallelOrchestration() {
    console.log('📝 Question:', TEST_QUESTION);
    console.log('\n--- PHASE 1: TASK CREATION ---\n');

    // 1. Create Parent Task Context
    const parentTask = await createTaskContext(TEST_QUESTION);
    console.log(`✅ Parent Task Created: ${parentTask.taskId}`);
    console.log(`   Context Hash: ${parentTask.contextHash}`);
    console.log(`   Original Request: "${parentTask.originalRequest}"`);

    // 2. Create Child Task Contexts
    const childTasks = [];
    for (const [agentName, config] of Object.entries(AGENTS)) {
        const childTask = await createTaskContext(config.task, parentTask.taskId);
        childTasks.push({
            agentId: config.id,
            agentName,
            taskId: childTask.taskId,
            task: config.task,
            context: childTask
        });
        console.log(`✅ Child Task Created for ${agentName}: ${childTask.taskId}`);
        console.log(`   Subtask: "${config.task}"`);
    }

    console.log('\n--- PHASE 2: AGENT SETUP ---\n');

    // 3. Instantiate Agent Instances
    const agentInstances = {};
    const agentResults = new Map();

    for (const child of childTasks) {
        const agent = new Agent(child.agentId);
        await agent.hydrate();
        agentInstances[child.agentId] = agent;
        console.log(`🤖 Agent Initialized: ${agent.name} (${child.agentId})`);
    }

    console.log('\n--- PHASE 3: BUS LISTENERS ---\n');

    // 4. Setup Aggregation Listener FIRST (to avoid race condition)
    const aggregationPromise = new Promise((resolve, reject) => {
        const aggregationTimeout = setTimeout(() => {
            reject(new Error('Timeout: Aggregation event did not fire'));
        }, TIMEOUT_MS + 10000); // Agent timeout + 10s buffer

        eventBus.once('all_children_complete', async (data) => {
            clearTimeout(aggregationTimeout);
            console.log('\n--- PHASE 6: AGGREGATION ---\n');
            console.log('🎯 All children complete event triggered!');
            console.log(`   Parent Task: ${data.parentTaskId}`);
            console.log(`   Total Deliverables: ${data.deliverables.length}`);

            // 8. Mei Compiles Final Answer
            console.log('\n--- PHASE 7: MEI COMPILES FINAL ANSWER ---\n');

            let finalAnswer = `# Complete Solution for: "${TEST_QUESTION}"\n\n`;
            finalAnswer += `This solution was created by ${data.deliverables.length} specialized agents working in parallel.\n\n`;

            for (const deliverable of data.deliverables) {
                const agentName = agentInstances[deliverable.agentId]?.name || deliverable.agentId;
                finalAnswer += `## Contribution from ${agentName}\n\n`;
                finalAnswer += `${deliverable.deliverable}\n\n`;
                finalAnswer += `---\n\n`;
            }

            console.log('📋 FINAL COMPILED ANSWER:');
            console.log('='.repeat(50));
            console.log(finalAnswer);
            console.log('='.repeat(50));

            resolve({
                parentTaskId: data.parentTaskId,
                deliverables: data.deliverables,
                finalAnswer
            });
        });
    });

    console.log('👂 Aggregation listener registered\n');

    // 5. Setup Bus Listeners for Each Agent
    const completionPromises = [];

    for (const child of childTasks) {
        const agentId = child.agentId;
        const taskId = child.taskId;

        // Create a promise that resolves when this specific agent completes their task
        const completionPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Timeout: ${agentId} did not complete task ${taskId} within ${TIMEOUT_MS}ms`));
            }, TIMEOUT_MS);

            // Listen for dispatch to this agent
            const dispatchListener = async (message) => {
                if (message.type === 'DISPATCH' && message.agentId === agentId && message.taskId === taskId) {
                    console.log(`📨 ${agentId} received dispatch: "${message.content}"`);

                    try {
                        // Agent processes the task via LLM
                        console.log(`🧠 ${agentId} is thinking...`);
                        const agent = agentInstances[agentId];
                        const response = await agent.process(child.task);

                        console.log(`💡 ${agentId} completed processing`);
                        console.log(`   Response preview: "${response.substring(0, 100)}..."`);

                        // Agent signals completion via bus
                        await BusOps.COMPLETE(agentId, taskId, response);

                        agentResults.set(agentId, {
                            agentId,
                            taskId,
                            deliverable: response
                        });

                        clearTimeout(timeout);
                        resolve(response);
                    } catch (err) {
                        clearTimeout(timeout);
                        console.error(`❌ ${agentId} failed:`, err.message);
                        reject(err);
                    }
                }
            };

            eventBus.on('bus_message', dispatchListener);
        });

        completionPromises.push(completionPromise);
    }

    console.log(`👂 Agent listeners active for ${childTasks.length} agents\n`);

    console.log('--- PHASE 4: PARALLEL DISPATCH ---\n');

    // 6. Dispatch All Tasks in Parallel
    for (const child of childTasks) {
        console.log(`🚀 Dispatching to ${child.agentId}: "${child.task}"`);
        await BusOps.DISPATCH(child.agentId, child.taskId, child.task);
    }

    console.log('\n--- PHASE 5: WAITING FOR COMPLETION ---\n');

    // 7. Wait for All Agents to Complete AND Aggregation
    try {
        const results = await Promise.all(completionPromises);
        console.log(`\n✅ All ${results.length} agents completed their tasks!\n`);

        // Now wait for aggregation
        return await aggregationPromise;
    } catch (err) {
        console.error('\n❌ Error during parallel execution:', err.message);
        throw err;
    }
}

/**
 * Execute the test
 */
async function main() {
    try {
        const startTime = Date.now();
        const result = await runParallelOrchestration();
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log('\n===========================================');
        console.log('✅ TEST COMPLETED SUCCESSFULLY');
        console.log('===========================================');
        console.log(`⏱️  Total Duration: ${duration}s`);
        console.log(`📊 Agents Coordinated: ${Object.keys(AGENTS).length}`);
        console.log(`📦 Deliverables Aggregated: ${result.deliverables.length}`);
        console.log('\n🎉 Parallel multi-agent orchestration working correctly!\n');

        process.exit(0);
    } catch (err) {
        console.error('\n===========================================');
        console.error('❌ TEST FAILED');
        console.error('===========================================');
        console.error('Error:', err.message);
        console.error('Stack:', err.stack);
        console.error('\n');
        process.exit(1);
    }
}

// Run the test
main();
