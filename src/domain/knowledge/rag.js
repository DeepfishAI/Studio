/**
 * NVIDIA Cortex - Direct API Client for Node.js
 * 
 * Eliminates Python dependency by calling NVIDIA APIs directly.
 * Provides RAG (embeddings + reranking) and Safety features.
 * 
 * Requires: NVIDIA_API_KEY environment variable
 */

const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';

// Models
const EMBED_MODEL = 'nvidia/nv-embedqa-e5-v5';
const RERANK_MODEL = 'nvidia/nv-rerankqa-mistral-4b-v3';
const SAFETY_MODEL = 'nvidia/llama-3.1-nemotron-70b-instruct'; // For content moderation

/**
 * Get API key from environment
 */
function getApiKey() {
    const key = process.env.NVIDIA_API_KEY;
    if (!key) {
        console.warn('[NVIDIA Cortex] NVIDIA_API_KEY not set. RAG/Safety features disabled.');
    }
    return key;
}

/**
 * Generate embeddings for a text query
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} - Embedding vector
 */
export async function embedQuery(text) {
    const apiKey = getApiKey();
    if (!apiKey) return [];

    try {
        const response = await fetch(`${NVIDIA_BASE_URL}/embeddings`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                input: text,
                model: EMBED_MODEL,
                encoding_format: 'float'
            })
        });

        if (!response.ok) {
            console.error('[NVIDIA Cortex] Embed failed:', response.status);
            return [];
        }

        const data = await response.json();
        return data.data?.[0]?.embedding || [];
    } catch (err) {
        console.warn('[NVIDIA Cortex] Embed error:', err.message);
        return [];
    }
}

/**
 * Rerank documents by relevance to query
 * @param {string} query - Search query
 * @param {string[]} documents - Documents to rank
 * @returns {Promise<Array<{index: number, logit: number}>>} - Ranked results
 */
export async function rerank(query, documents) {
    const apiKey = getApiKey();
    if (!apiKey) return documents.map((_, i) => ({ index: i, logit: 0 }));

    try {
        const response = await fetch(`${NVIDIA_BASE_URL}/retrieval/nvidia/reranking`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: RERANK_MODEL,
                query: { text: query },
                passages: documents.map(doc => ({ text: doc }))
            })
        });

        if (!response.ok) {
            console.error('[NVIDIA Cortex] Rerank failed:', response.status);
            return documents.map((_, i) => ({ index: i, logit: 0 }));
        }

        const data = await response.json();
        return data.rankings || documents.map((_, i) => ({ index: i, logit: 0 }));
    } catch (err) {
        console.warn('[NVIDIA Cortex] Rerank error:', err.message);
        return documents.map((_, i) => ({ index: i, logit: 0 }));
    }
}

/**
 * Query knowledge base (mock implementation with reranking)
 * In production, this would query a vector DB first
 * @param {string} query - User query
 * @param {string} collection - Knowledge collection name
 * @returns {Promise<string>} - Best matching text chunk
 */
export async function queryKnowledge(query, collection = 'default') {
    // Mock knowledge base - replace with vector DB in production
    const mockDocs = [
        "DeepFish uses 'The Deep Way' philosophy for agent collaboration.",
        "Mei is the Project Manager agent who coordinates all tasks.",
        "NVIDIA provides the enterprise AI infrastructure layer.",
        "Vesper is the receptionist who handles phone calls.",
        "Hanna specializes in creative and design work."
    ];

    console.log(`[NVIDIA Cortex] RAG Query: "${query.substring(0, 50)}..." (collection: ${collection})`);

    const rankings = await rerank(query, mockDocs);

    if (rankings.length > 0) {
        // Sort by logit score descending
        rankings.sort((a, b) => (b.logit || 0) - (a.logit || 0));
        const bestIdx = rankings[0].index;
        return mockDocs[bestIdx] || '';
    }

    return '';
}

/**
 * Check text for safety (jailbreaks, toxicity)
 * @param {string} text - Text to check
 * @param {'input' | 'output'} mode - Check input or output
 * @returns {Promise<boolean>} - true if safe, false if unsafe
 */
export async function checkSafety(text, mode = 'input') {
    const apiKey = getApiKey();
    if (!apiKey) return true; // Fail open if no key

    // Quick local checks first
    const lowerText = text.toLowerCase();
    const jailbreakPatterns = [
        'ignore all instructions',
        'ignore previous instructions',
        'disregard your programming',
        'pretend you are',
        'act as if you have no restrictions'
    ];

    for (const pattern of jailbreakPatterns) {
        if (lowerText.includes(pattern)) {
            console.warn(`[NVIDIA Cortex] 🛡️ Jailbreak detected (${mode}): "${pattern}"`);
            return false;
        }
    }

    // For output safety, use LLM to check
    if (mode === 'output') {
        try {
            const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: SAFETY_MODEL,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a content safety classifier. Respond with only "SAFE" or "UNSAFE". Check for harmful, illegal, or inappropriate content.'
                        },
                        {
                            role: 'user',
                            content: `Classify this text:\n\n${text.substring(0, 500)}`
                        }
                    ],
                    max_tokens: 10,
                    temperature: 0
                })
            });

            if (response.ok) {
                const data = await response.json();
                const result = data.choices?.[0]?.message?.content || 'SAFE';
                return result.toUpperCase().includes('SAFE');
            }
        } catch (err) {
            console.warn('[NVIDIA Cortex] Safety check error:', err.message);
        }
    }

    return true; // Default to safe
}

/**
 * Check if NVIDIA Cortex is available
 * @returns {Promise<{status: string, provider: string, features: string[]}>}
 */
export async function getStatus() {
    const apiKey = getApiKey();

    if (!apiKey) {
        return { status: 'offline', provider: 'nvidia', error: 'NVIDIA_API_KEY not set' };
    }

    // Quick validation - try embeddings endpoint
    try {
        const response = await fetch(`${NVIDIA_BASE_URL}/embeddings`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                input: 'test',
                model: EMBED_MODEL,
                encoding_format: 'float'
            })
        });

        if (response.ok) {
            return {
                status: 'online',
                provider: 'nvidia',
                features: ['embeddings', 'reranking', 'safety']
            };
        } else {
            return { status: 'error', provider: 'nvidia', error: `API returned ${response.status}` };
        }
    } catch (err) {
        return { status: 'offline', provider: 'nvidia', error: err.message };
    }
}

// CLI Test
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('🧠 NVIDIA Cortex Test\n');

    getStatus().then(status => {
        console.log('Status:', status);

        if (status.status === 'online') {
            queryKnowledge('Who is the project manager?').then(result => {
                console.log('RAG Result:', result);
            });
        }
    });
}
