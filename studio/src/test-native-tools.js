/**
 * Test Native Tool Calling
 * Run this to verify agents can actually create files
 */

import { Agent, getAgent } from '../src/agent.js';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const WORKSPACE = join(process.cwd(), 'workspace');

async function testNativeToolCalling() {
    console.log('🧪 Testing Native Tool Calling...\n');

    // Get Glitch (the code agent)
    const glitch = getAgent('glitch');

    console.log('1️⃣ Testing processWithTools on Glitch...\n');

    try {
        const result = await glitch.processWithTools(
            'Create a simple Python hello world file at hello.py that prints "Hello from Glitch!"',
            { maxSteps: 3, forceToolUse: true }
        );

        console.log('\n📊 Result:');
        console.log('─'.repeat(50));
        console.log('Response:', result.response?.substring(0, 200) + '...');
        console.log('Steps Used:', result.stepsUsed);
        console.log('Tools Executed:', result.toolResults.length);

        if (result.toolResults.length > 0) {
            console.log('\n🔧 Tool Results:');
            result.toolResults.forEach((tr, i) => {
                console.log(`  ${i + 1}. ${tr.tool}: ${tr.result}`);
            });
        }

        // Check if file was actually created
        const expectedPath = join(WORKSPACE, 'hello.py');
        if (existsSync(expectedPath)) {
            console.log('\n✅ SUCCESS: File was created at', expectedPath);
            console.log('Contents:');
            console.log(readFileSync(expectedPath, 'utf-8'));
        } else {
            console.log('\n❌ FAIL: File was not created at', expectedPath);
        }

    } catch (err) {
        console.error('\n❌ Error:', err.message);
        console.error(err.stack);
    }
}

testNativeToolCalling();
