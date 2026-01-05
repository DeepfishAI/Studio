/**
 * Test: Adaptive Agent Self-Replication
 * 
 * Demonstrates:
 * 1. Mei estimates task duration for each agent
 * 2. Progress monitoring triggers if agent is slow
 * 3. SPAWN_HELPER request sent via bus
 * 4. Agent receives signal (logged for demonstration)
 * 
 * Note: Full agent self-spawning capability is placeholder for now
 */

import { Mei } from '../src/mei.js';
import { Agent } from '../src/agent.js';
import { eventBus, createTaskContext, BusOps, monitorTaskProgress } from '../src/bus.js';

const TEST_QUESTION = "Design a mobile recipe app with authentication";

console.log('\n' + '='.repeat(60));
console.log('🧪 ADAPTIVE AGENT SELF-REPLICATION TEST');
console.log('='.repeat(60) + '\n');

/**
 * Test flow demonstrating adaptive spawning
 */
async function runAdaptiveSpawningTest() {
    const startTime = Date.now();

    // Initialize Mei
    const mei = new Mei();

    console.log('📝 Question:', TEST_QUESTION);
    console.log('\n--- PHASE 1: TASK ESTIMATION ---\n');

    // Define test agents and tasks
    const agentTasks = [
        { id: 'it', task: 'Implement OAuth 2.0 authentication for recipe app' },
        { id: 'hanna', task: 'Design app branding and UI mockups' }
    ];

    // Estimate task durations
    const estimates = {};
    for (const { id, task } of agentTasks) {
        const estimated = await mei.estimateTaskDuration(id, task);
        estimates[id] = estimated;
        console.log(`✅ ${id.toUpperCase()}: ${estimated}s`);
    }

    console.log('\n--- PHASE 2: TASK CREATION & MONITORING SETUP ---\n');

    // Create parent task
    const parentTask = await createTaskContext(TEST_QUESTION);
    console.log(`✅ Parent Task: ${parentTask.taskId}`);

    // Create child tasks and start monitoring
    const childTasks = [];
    for (const { id, task } of agentTasks) {
        const childTask = await createTaskContext(task, parentTask.taskId);
        childTasks.push({ agentId: id, taskId: childTask.taskId, task });

        // Start progress monitoring
        monitorTaskProgress(id, childTask.taskId, estimates[id]);

        console.log(`✅ Child Task for ${id.toUpperCase()}: ${childTask.taskId}`);
    }

    console.log('\n--- PHASE 3: SPAWN_HELPER LISTENER SETUP ---\n');

    // Set up listener to catch SPAWN_HELPER requests
    const spawnHelperRequests = [];
    eventBus.on('spawn_helper', (msg) => {
        console.log(`\n🚨 SPAWN_HELPER EVENT RECEIVED!`);
        console.log(`   Agent: ${msg.agentId}`);
        console.log(`   Task: ${msg.taskId}`);
        console.log(`   Reason: ${msg.reason}`);

        spawnHelperRequests.push(msg);

        // TODO: Agent would handle this by:
        // 1. Formulating a subtask for helper
        // 2. Spawning new agent instance
        // 3. Delegating subtask
        // 4. Integrating helper's result
        console.log(`   [Agent would spawn helper here - not implemented yet]\n`);
    });

    console.log('👂 Spawn helper listener registered\n');

    console.log('--- PHASE 4: DISPATCH & WAIT ---\n');

    // Dispatch tasks
    const completionPromises = [];
    for (const child of childTasks) {
        console.log(`🚀 Dispatching to ${child.agentId.toUpperCase()}: "${child.task}"`);
        await BusOps.DISPATCH(child.agentId, child.taskId, child.task);

        // Simulate agent work (artificially slow for testing)
        const workPromise = new Promise((resolve) => {
            const workDuration = child.agentId === 'it'
                ? estimates[child.agentId] * 2  // IT is 2x slower than estimate (will trigger spawn)
                : estimates[child.agentId] * 0.8; // Hanna finishes on time

            console.log(`   (Simulating ${child.agentId} working for ${workDuration.toFixed(1)}s...)`);

            setTimeout(async () => {
                await BusOps.COMPLETE(child.agentId, child.taskId, `Completed: ${child.task}`);
                console.log(`✅ ${child.agentId.toUpperCase()} completed`);
                resolve();
            }, workDuration * 1000);
        });

        completionPromises.push(workPromise);
    }

    // Wait for all to complete
    console.log('\n⏳ Waiting for agents to complete...\n');
    await Promise.all(completionPromises);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n--- RESULTS ---\n');
    console.log(`⏱️  Total Duration: ${duration}s`);
    console.log(`📊 Agents: ${agentTasks.length}`);
    console.log(`🚨 Spawn Helper Requests: ${spawnHelperRequests.length}`);

    if (spawnHelperRequests.length > 0) {
        console.log('\n✅ SUCCESS: Adaptive spawning triggered as expected!');
        console.log(`   ${spawnHelperRequests[0].agentId} exceeded threshold and received SPAWN_HELPER`);
    } else {
        console.log('\n⚠️  No spawn requests triggered (all agents completed on time)');
    }

    return {
        estimates,
        spawnHelperRequests,
        duration
    };
}

// Run the test
runAdaptiveSpawningTest()
    .then((result) => {
        console.log('\n' + '='.repeat(60));
        console.log('✅ TEST COMPLETED');
        console.log(' '.repeat(60));
        process.exit(0);
    })
    .catch((err) => {
        console.error('\n❌ TEST FAILED:', err.message);
        console.error(err.stack);
        process.exit(1);
    });
