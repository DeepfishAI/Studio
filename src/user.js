import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';

const USER_DATA_FILE = path.join(process.cwd(), 'user_data.json');

const defaultData = {
    email: 'user@deepfish.ai',
    tier: 'starter',
    purchases: [],
    capacities: {
        any: 5,
        hanna: 1,
        it: 1,
        oracle: 1,
        sally: 1
    }
};

/**
 * Load user data from disk
 */
export function loadUserData() {
    if (fs.existsSync(USER_DATA_FILE)) {
        try {
            return { ...defaultData, ...JSON.parse(fs.readFileSync(USER_DATA_FILE, 'utf-8')) };
        } catch (err) {
            console.error('Error parsing user_data.json:', err);
            return defaultData;
        }
    }
    return defaultData;
}

/**
 * Save user data to disk (Sync - blocking)
 * @deprecated Use saveUserDataAsync instead
 */
export function saveUserData(data) {
    fs.writeFileSync(USER_DATA_FILE, JSON.stringify(data, null, 2));
}

// Simple mutex for async writing
let isWriting = false;
let pendingWrite = null;

/**
 * Save user data to disk (Async - non-blocking)
 */
export async function saveUserDataAsync(data) {
    if (isWriting) {
        // Queue this write as the next pending one
        // If a write is already pending, this overwrites it (last writer wins)
        pendingWrite = data;
        return;
    }

    isWriting = true;

    try {
        const content = JSON.stringify(data, null, 2);
        // Write to temp file then rename for atomic write
        const tempFile = `${USER_DATA_FILE}.tmp`;
        await fsPromises.writeFile(tempFile, content, 'utf-8');
        await fsPromises.rename(tempFile, USER_DATA_FILE);
    } catch (err) {
        console.error('Failed to save user data:', err);
    } finally {
        isWriting = false;

        // If there's a pending write, process it now
        if (pendingWrite) {
            const nextData = pendingWrite;
            pendingWrite = null;
            saveUserDataAsync(nextData);
        }
    }
}

/**
 * Get capacity for a specific agent or global
 */
export function getCapacity(agentId = 'any') {
    const data = loadUserData();
    return data.capacities[agentId] || data.capacities.any || 5;
}

/**
 * Get global total capacity (sum of all or specific global limit)
 * For the intern loop, we'll use the 'any' pool as the base concurrency limit.
 */
export function getGlobalCapacity() {
    return getCapacity('any');
}
