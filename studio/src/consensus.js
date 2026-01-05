/**
 * Consensus Loop Protocol
 * 
 * Enables multi-agent collaborative development through iterative
 * revision cycles until unanimous approval.
 * 
 * ENHANCED FLOW (based on Agent4Debate & D3 academic patterns):
 * 1. Create session with participating agents
 * 2. First agent produces work, calls PROPOSE
 * 3. All agents vote (approve/reject with feedback)
 * 4. If rejected: DISCUSSION PHASE - agents debate and propose changes
 * 5. After discussion: assigned agent revises incorporating feedback
 * 6. Loop back to step 3 until consensus
 * 7. On consensus: Mei reviews and delivers
 */

import { eventBus } from './bus.js';

// Active consensus sessions
const sessions = new Map();

// Default configuration
const DEFAULT_CONFIG = {
    maxRounds: 5,
    votingTimeoutMs: 60000,
    discussionTimeoutMs: 120000,  // 2 min for discussion
    maxDiscussionTurns: 3,        // Max back-and-forth per round
    requireUnanimous: true,

    // ═══════════════════════════════════════════════════════════════
    // RESEARCH-BACKED IMPROVEMENTS (arXiv:2504.05047, arXiv:2406.12708)
    // ═══════════════════════════════════════════════════════════════

    // Toggle 1: Confidence Threshold Skip (DOWN paper - 6x efficiency)
    // If initial response confidence > threshold, skip debate entirely
    enableConfidenceSkip: true,
    confidenceThreshold: 0.85,     // Paper recommends 0.7-0.9

    // Toggle 2: Weighted Voting
    // Weight votes by agent confidence scores instead of equal weight
    enableWeightedVoting: true,

    // Toggle 3: Reviewer Personas
    // Assign different review styles for diversity
    enableReviewerPersonas: true
};

/**
 * Create a new consensus session
 * @param {string} taskId - Parent task ID
 * @param {string[]} agents - Agent IDs participating in consensus
 * @param {string} prompt - Original user request
 * @param {object} config - Optional configuration overrides
 */
export function createConsensusSession(taskId, agents, prompt, config = {}) {
    const sessionId = `consensus_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const session = {
        id: sessionId,
        taskId,
        prompt,
        agents,
        currentRound: 0,
        config: { ...DEFAULT_CONFIG, ...config },

        revisions: [],
        discussions: [],  // NEW: Track discussion threads
        status: 'initialized', // initialized | drafting | voting | discussing | revising | approved | deadlocked

        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    sessions.set(sessionId, session);

    console.log(`[Consensus] Session created: ${sessionId}`);
    console.log(`[Consensus] Agents: ${agents.join(', ')}`);
    console.log(`[Consensus] Max rounds: ${session.config.maxRounds}`);

    eventBus.emit('consensus_session_created', {
        sessionId,
        taskId,
        agents,
        prompt
    });

    return session;
}

/**
 * Get a consensus session by ID
 */
export function getSession(sessionId) {
    return sessions.get(sessionId);
}

/**
 * Start a new revision round
 * @param {string} sessionId - Session ID
 * @param {string} authorId - Agent producing this revision
 */
export function startRound(sessionId, authorId) {
    const session = sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    session.currentRound++;
    session.status = 'drafting';
    session.updatedAt = new Date().toISOString();

    // Initialize revision for this round
    session.revisions.push({
        round: session.currentRound,
        author: authorId,
        workProduct: null,
        submittedAt: null,
        votes: new Map(),
        votingComplete: false
    });

    console.log(`[Consensus] Round ${session.currentRound} started. Author: ${authorId}`);

    eventBus.emit('consensus_round_started', {
        sessionId,
        round: session.currentRound,
        author: authorId
    });

    return session.currentRound;
}

/**
 * Submit work product for review
 * @param {string} sessionId - Session ID
 * @param {string} agentId - Submitting agent
 * @param {string} workProduct - The work to be reviewed
 */
export function submitWork(sessionId, agentId, workProduct) {
    const session = sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const currentRevision = session.revisions[session.revisions.length - 1];
    if (!currentRevision) throw new Error('No active round');
    if (currentRevision.author !== agentId) {
        throw new Error(`Agent ${agentId} is not the author for round ${session.currentRound}`);
    }

    currentRevision.workProduct = workProduct;
    currentRevision.submittedAt = new Date().toISOString();
    session.status = 'voting';
    session.updatedAt = new Date().toISOString();

    console.log(`[Consensus] Work submitted for round ${session.currentRound}`);
    console.log(`[Consensus] Awaiting votes from: ${session.agents.filter(a => a !== agentId).join(', ')}`);

    // Notify all other agents to review
    session.agents.forEach(reviewerId => {
        if (reviewerId !== agentId) {
            eventBus.emit('consensus_review_requested', {
                sessionId,
                round: session.currentRound,
                reviewerId,
                authorId: agentId,
                workProduct,
                prompt: session.prompt
            });
        }
    });

    // Author auto-approves their own work
    currentRevision.votes.set(agentId, {
        approved: true,
        confidence: 100,
        feedback: 'Author submission',
        votedAt: new Date().toISOString()
    });

    return currentRevision;
}

/**
 * Cast a vote on the current work product
 * @param {string} sessionId - Session ID
 * @param {string} agentId - Voting agent
 * @param {boolean} approved - Approve or reject
 * @param {string} feedback - Required if not approved
 * @param {number} confidence - 0-100 confidence score
 */
export function castVote(sessionId, agentId, approved, feedback = '', confidence = 100) {
    const session = sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    if (session.status !== 'voting') throw new Error('Session not in voting state');

    const currentRevision = session.revisions[session.revisions.length - 1];
    if (!currentRevision) throw new Error('No active revision');

    // Require feedback for rejections
    if (!approved && !feedback) {
        throw new Error('Feedback required when rejecting work');
    }

    currentRevision.votes.set(agentId, {
        approved,
        confidence,
        feedback,
        votedAt: new Date().toISOString()
    });

    console.log(`[Consensus] Vote from ${agentId}: ${approved ? '✓ APPROVE' : '✗ REJECT'}`);
    if (feedback) console.log(`[Consensus] Feedback: "${feedback.substring(0, 100)}..."`);

    eventBus.emit('consensus_vote_cast', {
        sessionId,
        round: session.currentRound,
        agentId,
        approved,
        feedback
    });

    // Check if all votes are in
    const voteCount = currentRevision.votes.size;
    const agentCount = session.agents.length;

    if (voteCount >= agentCount) {
        currentRevision.votingComplete = true;
        return checkConsensus(sessionId);
    }

    console.log(`[Consensus] Votes: ${voteCount}/${agentCount}`);
    return { status: 'voting', votesReceived: voteCount, votesNeeded: agentCount };
}

/**
 * Check if consensus has been reached
 * @param {string} sessionId - Session ID
 */
export function checkConsensus(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const currentRevision = session.revisions[session.revisions.length - 1];
    if (!currentRevision) throw new Error('No active revision');

    const votes = Array.from(currentRevision.votes.values());

    let approved;
    let approvals, rejections;

    // Toggle 2: Weighted Voting (arXiv research)
    if (session.config.enableWeightedVoting) {
        // Weight votes by confidence scores
        let approveWeight = 0;
        let rejectWeight = 0;

        for (const vote of votes) {
            const weight = (vote.confidence || 50) / 100;  // Normalize to 0-1
            if (vote.approved) {
                approveWeight += weight;
            } else {
                rejectWeight += weight;
            }
        }

        approvals = votes.filter(v => v.approved).length;
        rejections = votes.filter(v => !v.approved);

        // Weighted decision
        const unanimous = rejectWeight === 0;
        approved = session.config.requireUnanimous ? unanimous : approveWeight > rejectWeight;

        console.log(`[Consensus] Weighted votes: approve=${approveWeight.toFixed(2)}, reject=${rejectWeight.toFixed(2)}`);
    } else {
        // Original equal-weight voting
        approvals = votes.filter(v => v.approved).length;
        rejections = votes.filter(v => !v.approved);

        const unanimous = rejections.length === 0;
        approved = session.config.requireUnanimous ? unanimous : approvals > rejections.length;
    }

    console.log(`[Consensus] Round ${session.currentRound} result: ${approvals} approve, ${rejections.length} reject`);

    if (approved) {
        // CONSENSUS REACHED!
        session.status = 'approved';
        session.updatedAt = new Date().toISOString();

        console.log(`[Consensus] ✓ CONSENSUS REACHED after ${session.currentRound} round(s)`);

        eventBus.emit('consensus_reached', {
            sessionId,
            taskId: session.taskId,
            round: session.currentRound,
            workProduct: currentRevision.workProduct,
            author: currentRevision.author,
            votes: Object.fromEntries(currentRevision.votes)
        });

        return {
            status: 'approved',
            round: session.currentRound,
            workProduct: currentRevision.workProduct
        };
    }

    // Check for deadlock
    if (session.currentRound >= session.config.maxRounds) {
        session.status = 'deadlocked';
        session.updatedAt = new Date().toISOString();

        console.log(`[Consensus] ✗ DEADLOCK after ${session.currentRound} rounds`);

        eventBus.emit('consensus_deadlocked', {
            sessionId,
            taskId: session.taskId,
            round: session.currentRound,
            lastWorkProduct: currentRevision.workProduct,
            rejections: rejections.map(r => r.feedback)
        });

        return {
            status: 'deadlocked',
            round: session.currentRound,
            feedback: rejections.map(r => r.feedback)
        };
    }

    // NOT UNANIMOUS: Start Discussion Phase (NEW - D3 pattern)
    session.status = 'discussing';
    session.updatedAt = new Date().toISOString();

    // Initialize discussion thread for this round
    const discussionThread = {
        round: session.currentRound,
        startedAt: new Date().toISOString(),
        comments: [],
        turnCount: 0,
        concluded: false
    };
    session.discussions.push(discussionThread);

    // Aggregate initial feedback as discussion starters
    const voteEntries = Array.from(currentRevision.votes.entries());

    console.log(`[Consensus] 💬 DISCUSSION PHASE started for round ${session.currentRound}`);
    console.log(`[Consensus] Rejections to discuss: ${rejections.length}`);

    eventBus.emit('consensus_discussion_started', {
        sessionId,
        taskId: session.taskId,
        round: session.currentRound,
        workProduct: currentRevision.workProduct,
        votes: voteEntries.map(([agentId, vote]) => ({
            agentId,
            approved: vote.approved,
            feedback: vote.feedback
        }))
    });

    return {
        status: 'discussing',
        round: session.currentRound,
        rejections: rejections.map(r => r.feedback)
    };
}

// ====================================
// DISCUSSION PHASE FUNCTIONS
// ====================================

/**
 * Add a comment to the discussion thread
 * Agents can respond to feedback, propose changes, or defend positions
 * 
 * @param {string} sessionId - Session ID
 * @param {string} agentId - Commenting agent
 * @param {string} comment - The comment/argument
 * @param {string} replyTo - Optional: agent ID being replied to
 * @param {object} proposedChange - Optional: specific code/change proposal
 */
export function addDiscussionComment(sessionId, agentId, comment, replyTo = null, proposedChange = null) {
    const session = sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    if (session.status !== 'discussing') throw new Error('Session not in discussion phase');

    const currentDiscussion = session.discussions[session.discussions.length - 1];
    if (!currentDiscussion) throw new Error('No active discussion');

    const entry = {
        id: `comment_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        agentId,
        comment,
        replyTo,
        proposedChange,
        timestamp: new Date().toISOString()
    };

    currentDiscussion.comments.push(entry);
    currentDiscussion.turnCount++;
    session.updatedAt = new Date().toISOString();

    console.log(`[Consensus] 💬 ${agentId}: "${comment.substring(0, 80)}..."`);
    if (replyTo) console.log(`[Consensus]    ↳ replying to ${replyTo}`);
    if (proposedChange) console.log(`[Consensus]    📝 Includes proposed change`);

    eventBus.emit('consensus_comment_added', {
        sessionId,
        round: session.currentRound,
        entry
    });

    // Check if discussion limit reached
    if (currentDiscussion.turnCount >= session.config.maxDiscussionTurns * session.agents.length) {
        console.log(`[Consensus] Discussion limit reached (${currentDiscussion.turnCount} turns)`);
        return concludeDiscussion(sessionId);
    }

    return entry;
}

/**
 * Conclude discussion and move to revision phase
 * @param {string} sessionId - Session ID
 * @param {string} assignedReviser - Optional: specific agent to handle revision
 */
export function concludeDiscussion(sessionId, assignedReviser = null) {
    const session = sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const currentDiscussion = session.discussions[session.discussions.length - 1];
    if (currentDiscussion) {
        currentDiscussion.concluded = true;
        currentDiscussion.concludedAt = new Date().toISOString();
    }

    session.status = 'revising';
    session.updatedAt = new Date().toISOString();

    // Compile discussion summary for the reviser
    const discussionSummary = compileDiscussionSummary(sessionId);

    // Determine who revises (author or assigned)
    const currentRevision = session.revisions[session.revisions.length - 1];
    const reviser = assignedReviser || currentRevision.author;

    console.log(`[Consensus] Discussion concluded after ${currentDiscussion?.turnCount || 0} comments`);
    console.log(`[Consensus] ✏️ ${reviser} assigned to revise`);

    eventBus.emit('consensus_revision_needed', {
        sessionId,
        taskId: session.taskId,
        round: session.currentRound,
        currentWorkProduct: currentRevision.workProduct,
        feedback: getAggregatedFeedback(sessionId),
        discussionSummary,
        assignedReviser: reviser
    });

    return {
        status: 'revising',
        round: session.currentRound,
        reviser,
        discussionSummary
    };
}

/**
 * Compile discussion into a structured summary for the reviser
 */
export function compileDiscussionSummary(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return '';

    const currentDiscussion = session.discussions[session.discussions.length - 1];
    if (!currentDiscussion) return '';

    const currentRevision = session.revisions[session.revisions.length - 1];
    const votes = currentRevision ? Array.from(currentRevision.votes.entries()) : [];

    let summary = '## Discussion Summary\n\n';

    // Add vote summary
    summary += '### Initial Votes\n';
    for (const [agentId, vote] of votes) {
        summary += `- **${agentId}**: ${vote.approved ? '✓ APPROVE' : '✗ REJECT'}`;
        if (vote.feedback && vote.feedback !== 'Author submission') {
            summary += ` - "${vote.feedback}"`;
        }
        summary += '\n';
    }

    // Add discussion comments
    if (currentDiscussion.comments.length > 0) {
        summary += '\n### Discussion Points\n';
        for (const entry of currentDiscussion.comments) {
            const replyPrefix = entry.replyTo ? `  ↳ @${entry.replyTo}: ` : '';
            summary += `- **${entry.agentId}**: ${replyPrefix}${entry.comment}\n`;
            if (entry.proposedChange) {
                summary += `  📝 Proposed: \`\`\`${JSON.stringify(entry.proposedChange)}\`\`\`\n`;
            }
        }
    }

    // Extract action items
    const proposedChanges = currentDiscussion.comments
        .filter(c => c.proposedChange)
        .map(c => ({ agent: c.agentId, change: c.proposedChange }));

    if (proposedChanges.length > 0) {
        summary += '\n### Proposed Changes to Incorporate\n';
        proposedChanges.forEach((p, i) => {
            summary += `${i + 1}. From ${p.agent}: ${JSON.stringify(p.change)}\n`;
        });
    }

    return summary;
}

/**
 * Get aggregated feedback from all rejections in current round
 */
export function getAggregatedFeedback(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return '';

    const currentRevision = session.revisions[session.revisions.length - 1];
    if (!currentRevision) return '';

    const rejections = Array.from(currentRevision.votes.values())
        .filter(v => !v.approved)
        .map(v => v.feedback);

    return rejections.join('\n\n---\n\n');
}

/**
 * Get session history for debugging/display
 */
export function getSessionHistory(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return null;

    return {
        id: session.id,
        taskId: session.taskId,
        status: session.status,
        currentRound: session.currentRound,
        agents: session.agents,
        revisions: session.revisions.map(r => ({
            round: r.round,
            author: r.author,
            submittedAt: r.submittedAt,
            votes: Object.fromEntries(r.votes),
            workProductPreview: r.workProduct?.substring(0, 200) + '...'
        }))
    };
}

/**
 * List all active sessions
 */
export function listSessions() {
    return Array.from(sessions.values()).map(s => ({
        id: s.id,
        taskId: s.taskId,
        status: s.status,
        round: s.currentRound,
        agents: s.agents
    }));
}

/**
 * Clean up completed sessions (call periodically)
 */
export function cleanupSessions(maxAgeMs = 3600000) {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, session] of sessions) {
        const age = now - new Date(session.updatedAt).getTime();
        if (age > maxAgeMs && ['approved', 'deadlocked'].includes(session.status)) {
            sessions.delete(id);
            cleaned++;
        }
    }

    if (cleaned > 0) {
        console.log(`[Consensus] Cleaned up ${cleaned} old sessions`);
    }

    return cleaned;
}
