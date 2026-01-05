/**
 * The Conductor
 * Implements the "Traffic System" logic for Universal Workflows.
 */

import fs from 'fs';
import path from 'path';
import { getAgent } from '../agent.js';

// Configuration
const SCORE_THRESHOLD = 90;
const MAX_LOOPS = 5;

/**
 * Validates and updates the Project State based on "The Judge's" ruling.
 * @param {string} statePath - Path to state.json
 * @param {string} lastOutput - The output from the last agent
 * @param {string} agentId - Who performed the action
 */
export async function conductTraffic(statePath, lastOutput, agentId) {
    // 1. Load State
    if (!fs.existsSync(statePath)) throw new Error(`State file not found: ${statePath}`);
    const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));

    // 2. Summon The Judge (QC Agent)
    console.log(`[Conductor] Summoning The Judge (QC Agent) to evaluate ${agentId}'s work...`);

    // Get the QC Agent
    const judge = getAgent('qc');
    if (!judge) throw new Error("QC Agent 'The Judge' not found! Ensure agents/qc.agent.json exists.");

    // Construct evaluation context
    const evalInput = `
        [TASK]: Evaluate the following work.
        PROJECT GOAL: ${state.goal}
        CURRENT PHASE: ${state.phase}
        LAST AGENT: ${agentId}
        LAST OUTPUT/ACTION: ${lastOutput}
        
        Compare the OUTPUT against the GOAL.
        You MUST output your verdict in the required JSON format.
    `;

    // Process via Agent Loop (allows for tool access if needed in future)
    // We use the agent's process method which handles the full prompt injection
    const evaluationRaw = await judge.process(evalInput);

    // Parse Judge's JSON from the agent response
    let evaluation;
    try {
        // Look for JSON block in the agent's textual response
        const jsonMatch = evaluationRaw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            evaluation = JSON.parse(jsonMatch[0]);
        } else {
            // Fallback: If mock returned a pure string without JSON formatting, we might fail here
            // But our mock in llm.js returns specific JSON strings now.

            // If the agent response IS the JSON string directly (from mock)
            // Sometimes it might be wrapped in quotes or markdown code blocks
            const cleanRaw = evaluationRaw.replace(/```json/g, '').replace(/```/g, '').trim();
            evaluation = JSON.parse(cleanRaw);
        }
    } catch (e) {
        console.error('[Conductor] Judge malformed response:', evaluationRaw);
        // Fallback fail - but don't crash, just reject
        evaluation = { score: 0, status: 'error', critique: 'Judge output unparseable. Manual Review Needed.', nextStep: 'Retry' };
    }

    console.log(`[Conductor] Judge Score: ${evaluation.score}/100. Status: ${evaluation.status}`);

    // 3. Traffic Logic
    if (!state.metrics) state.metrics = { iterations: 0, qualityScore: 0 }; // Safety init
    state.metrics.iterationCount = (state.metrics.iterationCount || 0) + 1;
    state.metrics.qualityScore = evaluation.score;

    const historyEntry = {
        timestamp: new Date().toISOString(),
        agent: agentId,
        outputSummary: lastOutput.substring(0, 100) + '...',
        score: evaluation.score,
        feedback: evaluation.critique
    };
    if (!state.history) state.history = [];
    state.history.push(historyEntry);

    // GUARDRAIL: Infinite Loop
    if (state.metrics.iterationCount > (state.metrics.maxIterations || MAX_LOOPS)) {
        console.error('[Conductor] CRITICAL: Max iterations reached. Stopping traffic.');
        state.status = 'human_intervention_required';
        state.phase = 'halted';
    }
    // PASS: Green Light
    else if (evaluation.score >= SCORE_THRESHOLD) {
        console.log('[Conductor] Green Light! Proceeding to next phase.');
        // Here we could auto-advance phase, but often the Agent updates the phase. 
        // We just confirm it's valid.
        // For simulation, we might assume the loop continues until completion.
        if (state.phase === 'revision') state.phase = 'production';
    }
    // FAIL: Red Light / U-Turn
    else {
        console.log('[Conductor] Red Light! Revision required.');
        state.phase = 'revision';
        // The feedback is already in history for the next agent to read.
    }

    // 4. Save State
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    return evaluation;
}
