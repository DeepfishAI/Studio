
import { getAgent } from '../src/domain/agent.js';
import { eventBus } from '../src/infra/bus.js';

// Monitor the nervous system
eventBus.on('bus_message', (msg) => {
    // Only log high-level events to avoid noise
    if (['DISPATCH', 'HANDOFF', 'TASK_COMPLETE', 'BLOCKER', 'TOOL_RESULT'].includes(msg.type)) {
        console.log(`[BUS] ${msg.type} from ${msg.agentId}: ${msg.content?.substring(0, 100)}...`);
    }
});

async function runSimulation() {
    console.log('\n--- STARTING SIMULATION: Tic-Tac-Toe Project ---\n');

    const mei = getAgent('mei');

    const taskPrompt = `Make code me, in python, a tic-tac-toe game for 1 player agaist the computer. the x's will be butterlies, and the "O's" will be ladybeetles. The ticatac toe board is a chilrend book style ink and watercolor, and the grid lines are vines witha few leaves small enough so they dont get in the way of gameplay. mei does not do any coding (she never douse) but she will analyse the task, and assign to the sub-agents thier individual tasks, where in the end, IT compiles them ointo a functioning applet.`;

    console.log(`[USER] ${taskPrompt}\n`);

    try {
        // Force Mei to use tools (delegate_task)
        // We expect her to delegate to IT (code) and Hanna (art)
        const result = await mei.processWithTools(taskPrompt, {
            maxSteps: 10,
            forceToolUse: true
        });

        console.log('\n--- SIMULATION COMPLETE ---');
        console.log('Final Response:', result.response);

        console.log('\nTool Executions:', result.toolResults.length);
        result.toolResults.forEach(t => {
            console.log(`- ${t.tool}: ${t.result.substring(0, 100)}...`);
        });

    } catch (err) {
        console.error('\n[SIMULATION FAILED]:', err);
    }
}

runSimulation();
