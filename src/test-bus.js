/**
 * Test script for Bus and Orchestrator
 */

import { createTaskContext, BusOps, getTaskTranscript } from './bus.js';
import { getOrchestrator } from './orchestrator.js';

console.log('🧪 Testing Bus Event Loop (Async/Redis Ready)\n');

// Get orchestrator
const orchestrator = getOrchestrator();

// Wrap in async IFFE
(async () => {
    try {
        // Create a test task
        console.log('1. Creating task...');
        const context = await createTaskContext('Build a landing page for DeepFish');
        console.log(`   Task ID: ${context.taskId}`);
        console.log(`   Context Hash: ${context.contextHash}\n`);

        // Vesper asserts understanding
        console.log('2. Vesper routing...');
        await BusOps.ASSERT('vesper', context.taskId, 'This is a web design task, routing to Mei');

        // Mei takes over and dispatches to Hanna
        console.log('\n3. Mei dispatching to Hanna...');
        // dispatchToAgent isn't async on the Orchestrator side yet, but it calls async bus ops.
        // Ideally Orchestrator should also be updated, but for now we test the flow.
        orchestrator.dispatchToAgent(context.taskId, 'hanna', {
            type: 'design',
            description: 'Create landing page mockups',
            requirements: ['Hero section', 'Features grid', 'CTA buttons']
        });

        // wait for async handoff to propagate
        await new Promise(r => setTimeout(r, 100));

        // Hanna works on it
        console.log('\n4. Hanna working...');
        await BusOps.ASSERT('hanna', context.taskId, 'Starting on the hero section design');

        // Hanna queries IT for technical constraints
        console.log('\n5. Hanna queries IT...');
        await BusOps.QUERY('hanna', context.taskId, 'What framework are we using?', ['it']);

        // IT responds (ack)
        console.log('\n6. IT responds...');
        const updatedTranscript = getTaskTranscript(context.taskId);
        console.log(`   [DEBUG] Transcript length: ${updatedTranscript.length}`);
        updatedTranscript.forEach(m => console.log(`   - ${m.type} (${m.agentId})`));

        const queryMsg = updatedTranscript.find(m => m.type === 'QUERY');
        if (!queryMsg) throw new Error('Query message not found in transcript!');

        await BusOps.ACK('it', context.taskId, queryMsg.timestamp);

        // Hanna completes
        console.log('\n7. Hanna completes task...');
        await BusOps.COMPLETE('hanna', context.taskId, {
            deliverables: ['hero-mockup.png', 'features-grid.png'],
            notes: 'Used glassmorphism style per brand guidelines'
        });

        // Show orchestrator status
        console.log('\n8. Orchestrator status:');
        console.log(JSON.stringify(orchestrator.getStatus(), null, 2));

        // Show transcript
        console.log('\n9. Task transcript:');
        const transcript = getTaskTranscript(context.taskId);
        transcript.forEach((msg, i) => {
            let content = '';
            if (msg.content) {
                content = typeof msg.content === 'string'
                    ? msg.content.substring(0, 60)
                    : JSON.stringify(msg.content).substring(0, 60);
            }
            console.log(`   ${i + 1}. [${msg.type}] ${msg.agentId}: ${content}...`);
        });

        console.log('\n✅ Bus event loop test complete!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Test execution failed:', err);
        process.exit(1);
    }
})();
