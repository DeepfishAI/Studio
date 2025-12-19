// Training API service for agent learning
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export const trainingApi = {
    /**
     * Get learned facts for an agent
     * @param {string} agentId - Agent identifier
     */
    async getFacts(agentId) {
        try {
            const response = await fetch(`${API_BASE}/api/training/${agentId}/facts`)
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }
            return response.json()
        } catch (error) {
            console.error('[Training API] Get facts failed:', error)
            throw error
        }
    },

    /**
     * Add facts from text content
     * @param {string} agentId - Agent identifier
     * @param {string} text - Text to extract facts from
     * @param {string} source - Source type (upload, text, url)
     * @param {string} sourceFile - Original filename
     */
    async addFacts(agentId, text, source = 'upload', sourceFile = 'manual-input') {
        try {
            const response = await fetch(`${API_BASE}/api/training/${agentId}/facts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, source, sourceFile })
            })
            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to add facts')
            }
            return response.json()
        } catch (error) {
            console.error('[Training API] Add facts failed:', error)
            throw error
        }
    },

    /**
     * Delete a specific fact
     * @param {string} agentId - Agent identifier
     * @param {string} factId - Fact ID to delete
     */
    async deleteFact(agentId, factId) {
        try {
            const response = await fetch(`${API_BASE}/api/training/${agentId}/facts/${factId}`, {
                method: 'DELETE'
            })
            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to delete fact')
            }
            return response.json()
        } catch (error) {
            console.error('[Training API] Delete fact failed:', error)
            throw error
        }
    },

    /**
     * Clear all facts for an agent
     * @param {string} agentId - Agent identifier
     */
    async clearFacts(agentId) {
        try {
            const response = await fetch(`${API_BASE}/api/training/${agentId}/facts`, {
                method: 'DELETE'
            })
            return response.json()
        } catch (error) {
            console.error('[Training API] Clear facts failed:', error)
            throw error
        }
    },

    /**
     * Read file contents for upload
     * @param {File} file - File object to read
     */
    async readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = (e) => resolve(e.target.result)
            reader.onerror = (e) => reject(e)
            reader.readAsText(file)
        })
    }
}

export default trainingApi
