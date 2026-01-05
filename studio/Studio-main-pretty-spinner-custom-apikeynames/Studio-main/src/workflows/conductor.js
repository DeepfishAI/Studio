/**
 * The Conductor V5.0
 * Implements the "Traffic System" logic for Universal Workflows.
 * Features: FSM, Human Success State, Constraint Locking, Mechanical Verification.
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
 * @param {string} transitionType - 'analyze' (Strategy Check) or 'judge' (Artifact Check)
 */
export async function conductTraffic(statePath, lastOutput, agentId, transitionType = 'judge') {
    // 1. Load State
    if (!fs.existsSync(statePath)) throw new Error(`State file not found: ${statePath}`);
    let state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));

    // Ensure Metrics & Constraints Exist
    if (!state.metrics) state.metrics = { iterations: 0, qualityScore: 0 };
    if (!state.constraints) state.constraints = []; // THE RATCHET

    // 2. Summon The Judge
    const judge = getAgent('qc');
    if (!judge) throw new Error("QC Agent 'The Judge' not found!");

    console.log(`[Conductor] Phase: ${state.phase.toUpperCase()} | Summoning Judge for ${transitionType.toUpperCase()}...`);

    // 3. Construct Evaluation Context based on Transition Type
    let evalInput = '';
    if (transitionType === 'analyze') {
        evalInput = `
            [TASK]: STRATEGY ANALYSIS (Sanity Check).
            PROJECT GOAL: ${state.goal}
            PROPOSED STRATEGY: ${lastOutput}
            KNOWN CONSTRAINTS: ${JSON.stringify(state.constraints)}
            
            Does this strategy logically align with the goal and constraints?
            Ignore minor details. Focus on FATAL FLAWS or REWARD HACKING.
            
            Output JSON: { "score": 0-100, "status": "approved"|"rejected", "critique": "..." }
        `;
    } else {
        evalInput = `
            [TASK]: ARTIFACT JUDGMENT (Final Verification).
            PROJECT GOAL: ${state.goal}
            ARTIFACT/OUTPUT: ${lastOutput}
            LOCKED CONSTRAINTS: ${JSON.stringify(state.constraints)}
            
            1. Check against Constraints.
            2. Check against Goal.
            
            Output JSON: { "score": 0-100, "status": "approved"|"rejected"|"escalate", "critique": "...", "new_constraint": "Optional hard constraint to add" }
        `;
    }

    // 4. Process via Judge
    const evaluationRaw = await judge.process(evalInput);
    let evaluation = parseJudgeOutput(evaluationRaw);
    console.log(`[Conductor] Verdict: ${evaluation.score}/100 | Status: ${evaluation.status}`);

    // 5. Traffic Logic (State Transitions)

    // GUARDRAIL: Metric Updates
    state.metrics.iterationCount++;
    state.metrics.qualityScore = evaluation.score;

    // GUARDRAIL: Constraint Locking (The Ratchet)
    if (evaluation.new_constraint) {
        console.log(`[Conductor] 🔒 LOCKING NEW CONSTRAINT: "${evaluation.new_constraint}"`);
        state.constraints.push(evaluation.new_constraint);
    }

    // STATE MACHINE TRANSITIONS
    if (state.metrics.iterationCount > MAX_LOOPS) {
        console.error('[Conductor] 🛑 MAX LOOPS REACHED. ESCALATING TO HUMAN.');
        state.status = 'human_intervention_required'; // DESIGNED SUCCESS STATE
        state.phase = 'escalate';
    }
    else if (evaluation.status === 'escalate') {
        console.error('[Conductor] ⚠️ JUDGE REQUESTED ESCALATION.');
        state.status = 'human_intervention_required';
        state.phase = 'escalate';
    }
    else if (evaluation.score >= SCORE_THRESHOLD && evaluation.status === 'approved') {
        console.log('[Conductor] 🟢 GREEN LIGHT.');
        if (state.phase === 'analyze') state.phase = 'execute';
        else if (state.phase === 'judge' || state.phase === 'review') state.phase = 'success';
    }
    else {
        console.log('[Conductor] 🔴 RED LIGHT. REVISION REQUIRED.');
        state.phase = 'revision'; // Back to the drawing board
    }

    // 6. Update History & Save
    const historyEntry = {
        timestamp: new Date().toISOString(),
        agent: agentId,
        phase: state.phase, // Current phase AFTER transition
        score: evaluation.score,
        feedback: evaluation.critique,
        constraints: [...state.constraints]
    };
    if (!state.history) state.history = [];
    state.history.push(historyEntry);

    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    return { ...evaluation, nextPhase: state.phase };
}

/**
 * Helper to safely parse Judge JSON
 */
function parseJudgeOutput(raw) {
    try {
        const clean = raw.replace(/```json/g, '').replace(/```/g, '').trim();
        // Find the first '{' and last '}'
        const start = clean.indexOf('{');
        const end = clean.lastIndexOf('}');
        if (start === -1 || end === -1) throw new Error("No JSON found");
        return JSON.parse(clean.substring(start, end + 1));
    } catch (e) {
        console.error('[Conductor] Parse Error:', e.message);
        return { score: 0, status: 'rejected', critique: 'Judge Output Invalid.' };
    }
}
