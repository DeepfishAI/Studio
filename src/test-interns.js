/**
 * Test the Intern Spawn System
 * Run with: node src/test-interns.js
 */

import { spawnIntern, spawnInternTeam, getAvailableTalent } from './interns.js';
import { getOrchestrator } from './orchestrator.js';

async function testInterns() {
    console.log('='.repeat(50));
    console.log('INTERN SYSTEM TEST (Costumed Clones)');
    console.log('='.repeat(50));

    // Initialize orchestrator
    const orchestrator = getOrchestrator();

    // Show available talent for IT
    console.log('\n📋 Available Talent for IT:');
    const itTalent = getAvailableTalent('it');
    itTalent.forEach(t => {
        console.log(`  - ${t.name} (${t.status})`);
    });

    // Test 1: Single Coder Clone (Zack - Senior)
    console.log('\n' + '='.repeat(50));
    console.log('TEST 1: "Zack" (Senior Engineer Clone)');
    console.log('='.repeat(50));

    try {
        const codeResult = await spawnIntern(
            'it',
            'zack',
            'Write a React hook called useMidiDevices that lists all connected MIDI devices using the Web MIDI API.'
        );
        console.log('\n💻 Code Deliverable:');
        console.log(codeResult.content);
    } catch (err) {
        console.error('Clone spawn failed:', err.message);
    }

    // Test 2: Single Design Clone (Bella - Junior)
    console.log('\n' + '='.repeat(50));
    console.log('TEST 2: "Bella" (Junior Designer Clone)');
    console.log('='.repeat(50));

    try {
        const designResult = await spawnIntern(
            'creative',
            'bella',
            'Create a CSS style for a "Buy Now" button. Make it pop.'
        );
        console.log('\n🎨 Design Deliverable:');
        console.log(designResult.content);
    } catch (err) {
        console.error('Clone spawn failed:', err.message);
    }

    // Test 3: Parallel Team (The Office Expansion Pack)
    console.log('\n' + '='.repeat(50));
    console.log('TEST 3: Clone Army (Parallel Execution)');
    console.log('='.repeat(50));

    try {
        const teamResults = await spawnInternTeam([
            { managerId: 'it', internId: 'priya', task: 'Create the frontend component structure for the MIDI app.' },
            { managerId: 'creative', internId: 'yuki', task: 'Design the logo for the MIDI app. Use vector concepts.' },
            { managerId: 'marketing', internId: 'tyler', task: 'Write a TikTok script promoting this new MIDI tool.' }
        ]);

        console.log('\n📊 Team Results:');
        teamResults.forEach((result, i) => {
            console.log(`\n--- ${result.internId.toUpperCase()} ---`);
            if (result.success) {
                console.log(result.deliverable.content.substring(0, 500) + '...');
            } else {
                console.log(`FAILED: ${result.error}`);
            }
        });
    } catch (err) {
        console.error('Team spawn failed:', err.message);
    }

    // Final status
    console.log('\n' + '='.repeat(50));
    console.log('ORCHESTRATOR STATUS');
    console.log('='.repeat(50));
    console.log(JSON.stringify(orchestrator.getStatus(), null, 2));
}

testInterns().catch(console.error);
