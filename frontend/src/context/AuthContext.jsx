import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

// API base URL
const API_BASE = import.meta.env.VITE_API_URL || ''

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [token, setToken] = useState(null)
    const [loading, setLoading] = useState(true)
    const [pendingEmail, setPendingEmail] = useState(null)

    // Restore session from localStorage on mount
    useEffect(() => {
        try {
            const savedToken = localStorage.getItem('deepfish_token')
            const savedUser = localStorage.getItem('deepfish_user')

            if (savedToken && savedUser) {
                const parsed = JSON.parse(savedUser)
                if (parsed && parsed.email) {
                    setToken(savedToken)
                    setUser(parsed)
                } else {
                    clearSession()
                }
            }
        } catch (err) {
            console.warn('[Auth] Failed to restore session:', err)
            clearSession()
        }
        setLoading(false)
    }, [])

    const clearSession = () => {
        localStorage.removeItem('deepfish_token')
        localStorage.removeItem('deepfish_user')
        setToken(null)
        setUser(null)
    }

    /**
     * Step 1: Request verification code
     * @param {string} email 
     * @returns {Promise<{success: boolean, message?: string, error?: string}>}
     */
    const requestCode = async (email) => {
        try {
            const response = await fetch(`${API_BASE}/api/auth/request-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            })

            const data = await response.json()

            if (response.ok) {
                setPendingEmail(email)
                return { success: true, message: data.message }
            } else {
                return { success: false, error: data.error }
            }
        } catch (err) {
            console.error('[Auth] Request code failed:', err)
            return { success: false, error: 'Network error. Please try again.' }
        }
    }

    /**
     * Step 2: Verify code and complete login
     * @param {string} code 
     * @returns {Promise<{success: boolean, user?: object, error?: string}>}
     */
    const verifyCode = async (code) => {
        if (!pendingEmail) {
            return { success: false, error: 'No pending email. Please start over.' }
        }

        try {
            const response = await fetch(`${API_BASE}/api/auth/verify-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: pendingEmail, code })
            })

            const data = await response.json()

            if (response.ok && data.token) {
                // Save to localStorage
                localStorage.setItem('deepfish_token', data.token)
                localStorage.setItem('deepfish_user', JSON.stringify(data.user))

                setToken(data.token)
                setUser(data.user)
                setPendingEmail(null)

                return { success: true, user: data.user }
            } else {
                return {
                    success: false,
                    error: data.error,
                    attemptsRemaining: data.attemptsRemaining
                }
            }
        } catch (err) {
            console.error('[Auth] Verify code failed:', err)
            return { success: false, error: 'Network error. Please try again.' }
        }
    }

    /**
     * Legacy login (for backward compatibility during transition)
     * Will be removed after full migration
     */
    const login = async (email) => {
        // Start the new flow
        const result = await requestCode(email)
        if (!result.success) {
            throw new Error(result.error)
        }
        return result
    }

    const logout = async () => {
        try {
            await fetch(`${API_BASE}/api/auth/logout`, {
                method: 'POST',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            })
        } catch (err) {
            // Ignore network errors on logout
        }
        clearSession()
        setPendingEmail(null)
    }

    const upgradeTier = (newTier) => {
        if (user) {
            const updated = { ...user, tier: newTier }
            localStorage.setItem('deepfish_user', JSON.stringify(updated))
            setUser(updated)
        }
    }

    /**
     * Get auth headers for API calls
     */
    const getAuthHeaders = () => {
        if (token) {
            return { 'Authorization': `Bearer ${token}` }
        }
        return {}
    }

    return (
        <AuthContext.Provider value={{
            user,
            token,
            loading,
            pendingEmail,
            requestCode,
            verifyCode,
            login, // Legacy
            logout,
            upgradeTier,
            getAuthHeaders
        }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}

export default AuthContext
