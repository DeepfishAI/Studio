/**
 * DeepFish Stress Test
 * Tests multiple systems concurrently to ensure stability.
 */

import { spawnIntern, spawnInternTeam, getActiveInterns } from './interns.js';
import { createTaskContext, BusOps, eventBus } from './bus.js';
import { getOrchestrator } from './orchestrator.js';
import { loadUserData, saveUserDataAsync, getGlobalCapacity } from './user.js';
import { getProducts, getProductById } from './products.js';

const STRESS_CONFIG = {
    INTERN_BURSTS: 3,           // Number of intern team bursts
    INTERNS_PER_BURST: 5,       // Interns per burst
    BUS_MESSAGES: 50,           // Number of bus messages to generate
    CONCURRENT_PURCHASES: 10,   // Simulated concurrent purchases
    TEST_DURATION_MS: 30000     // Max test duration
};

let stats = {
    internsSpawned: 0,
    internsCompleted: 0,
    internsFailed: 0,
    busMessagesSent: 0,
    purchasesAttempted: 0,
    purchasesSucceeded: 0,
    errors: []
};

console.log('🔥 DeepFish Stress Test Starting...\n');
console.log('Configuration:', STRESS_CONFIG);
console.log('Initial Capacity:', getGlobalCapacity());
console.log('---\n');

const startTime = Date.now();

// 1. Stress Test: Intern System (Concurrency)
async function stressInternSystem() {
    console.log('🧪 [INTERN TEST] Starting concurrent intern bursts...');

    const tasks = [
        { type: 'researcher', task: 'Research AI trends' },
        { type: 'coder', task: 'Write a hello world in Python' },
        { type: 'designer', task: 'Create a button style' },
        { type: 'copywriter', task: 'Write a tagline' },
        { type: 'analyst', task: 'Estimate project scope' }
    ];

    const bursts = [];
    for (let i = 0; i < STRESS_CONFIG.INTERN_BURSTS; i++) {
        bursts.push(
            spawnInternTeam(tasks.slice(0, STRESS_CONFIG.INTERNS_PER_BURST)).then(results => {
                results.forEach(r => {
                    stats.internsSpawned++;
                    if (r.success) {
                        stats.internsCompleted++;
                    } else {
                        stats.internsFailed++;
                        stats.errors.push(`Intern failed: ${r.error}`);
                    }
                });
            }).catch(err => {
                stats.errors.push(`Intern burst failed: ${err.message}`);
            })
        );
    }

    await Promise.allSettled(bursts);
    console.log(`✅ [INTERN TEST] Complete: ${stats.internsCompleted}/${stats.internsSpawned} succeeded`);
}

// 2. Stress Test: Bus Message Throughput
async function stressBusSystem() {
    console.log('🧪 [BUS TEST] Flooding bus with messages...');

    const taskContext = createTaskContext('Stress test task');
    const taskId = taskContext.taskId;

    for (let i = 0; i < STRESS_CONFIG.BUS_MESSAGES; i++) {
        try {
            BusOps.ASSERT(`agent_${i % 5}`, taskId, `Stress message ${i}`);
            stats.busMessagesSent++;
        } catch (err) {
            stats.errors.push(`Bus message failed: ${err.message}`);
        }
    }

    // Rapid handoffs
    for (let i = 0; i < 10; i++) {
        try {
            BusOps.HANDOFF('mei', `agent_${i % 5}`, taskId, { task: `Handoff ${i}` });
            stats.busMessagesSent++;
        } catch (err) {
            stats.errors.push(`Handoff failed: ${err.message}`);
        }
    }

    console.log(`✅ [BUS TEST] Complete: ${stats.busMessagesSent} messages sent`);
}

// 3. Stress Test: Purchase System (Data Integrity)
async function stressPurchaseSystem() {
    console.log('🧪 [PURCHASE TEST] Simulating concurrent purchases...');

    const products = getProducts();
    if (products.length === 0) {
        console.log('⚠️ [PURCHASE TEST] No products available, skipping.');
        return;
    }

    const initialCapacity = getGlobalCapacity();
    const purchasePromises = [];

    for (let i = 0; i < STRESS_CONFIG.CONCURRENT_PURCHASES; i++) {
        const product = products[i % products.length];
        stats.purchasesAttempted++;

        purchasePromises.push(
            (async () => {
                // Simulate purchase flow (same as /api/purchase handler)
                let userData = loadUserData();
                userData.purchases.push({
                    productId: product.id,
                    name: product.name,
                    timestamp: new Date().toISOString()
                });

                if (product.effect_type === 'agent_capacity') {
                    const agent = product.target_agent || 'any';
                    userData.capacities[agent] = (userData.capacities[agent] || 0) + (product.effect_value || 1);
                }

                await saveUserDataAsync(userData);
                stats.purchasesSucceeded++;
            })().catch(err => {
                stats.errors.push(`Purchase failed: ${err.message}`);
            })
        );
    }

    await Promise.allSettled(purchasePromises);

    const finalCapacity = getGlobalCapacity();
    console.log(`✅ [PURCHASE TEST] Complete: ${stats.purchasesSucceeded}/${stats.purchasesAttempted} succeeded`);
    console.log(`   Capacity: ${initialCapacity} → ${finalCapacity}`);
}

// 4. Monitor Memory Usage
function logMemoryUsage() {
    const mem = process.memoryUsage();
    console.log(`📊 Memory: ${Math.round(mem.heapUsed / 1024 / 1024)}MB / ${Math.round(mem.heapTotal / 1024 / 1024)}MB`);
}

// Main execution
(async () => {
    try {
        logMemoryUsage();

        // Run tests in parallel
        await Promise.all([
            stressInternSystem(),
            stressBusSystem(),
            stressPurchaseSystem()
        ]);

        const duration = Date.now() - startTime;

        console.log('\n---');
        console.log('📋 STRESS TEST RESULTS');
        console.log('---');
        console.log(`Duration: ${duration}ms`);
        console.log(`Interns: ${stats.internsCompleted}/${stats.internsSpawned} completed`);
        console.log(`Bus Messages: ${stats.busMessagesSent}`);
        console.log(`Purchases: ${stats.purchasesSucceeded}/${stats.purchasesAttempted}`);
        console.log(`Errors: ${stats.errors.length}`);

        if (stats.errors.length > 0) {
            console.log('\nError Summary:');
            stats.errors.slice(0, 5).forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
            if (stats.errors.length > 5) {
                console.log(`  ... and ${stats.errors.length - 5} more`);
            }
        }

        logMemoryUsage();

        if (stats.errors.length === 0) {
            console.log('\n✅ ALL STRESS TESTS PASSED!');
        } else {
            console.log(`\n⚠️ STRESS TESTS COMPLETED WITH ${stats.errors.length} ERROR(S)`);
        }

    } catch (err) {
        console.error('❌ STRESS TEST CRASHED:', err);
        process.exit(1);
    }
})();
