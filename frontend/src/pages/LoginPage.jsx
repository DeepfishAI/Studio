import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import '../styles/design-system.css'

function LoginPage() {
    const [email, setEmail] = useState('')
    const [code, setCode] = useState('')
    const [step, setStep] = useState('email') // 'email' | 'code'
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [attemptsRemaining, setAttemptsRemaining] = useState(null)

    const { requestCode, verifyCode } = useAuth()
    const navigate = useNavigate()

    const handleEmailSubmit = async (e) => {
        e.preventDefault()
        if (!email.trim()) {
            setError('Please enter your email')
            return
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            setError('Please enter a valid email address')
            return
        }

        setIsLoading(true)
        setError('')

        try {
            const result = await requestCode(email)

            if (result.success) {
                setStep('code')
                setError('')
            } else {
                setError(result.error || 'Failed to send code')
            }
        } catch (err) {
            setError('Something went wrong. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    const handleCodeSubmit = async (e) => {
        e.preventDefault()
        if (!code.trim()) {
            setError('Please enter the code')
            return
        }

        setIsLoading(true)
        setError('')

        try {
            const result = await verifyCode(code)

            if (result.success) {
                navigate('/app')
            } else {
                setError(result.error || 'Invalid code')
                if (result.attemptsRemaining !== undefined) {
                    setAttemptsRemaining(result.attemptsRemaining)
                }
            }
        } catch (err) {
            setError('Something went wrong. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    const handleBack = () => {
        setStep('email')
        setCode('')
        setError('')
        setAttemptsRemaining(null)
    }

    const handleResend = async () => {
        setCode('')
        setError('')
        setIsLoading(true)

        try {
            const result = await requestCode(email)
            if (result.success) {
                setError('')
                setAttemptsRemaining(null)
            } else {
                setError(result.error || 'Failed to resend code')
            }
        } catch (err) {
            setError('Failed to resend code')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="login-page">
            <div className="login-container">
                {/* Logo Section */}
                <div className="login-logo">
                    <span className="login-logo__icon">🐟</span>
                    <span className="login-logo__text">DeepFish</span>
                </div>

                {/* Hero Text */}
                <div className="login-hero">
                    <h1 className="login-hero__title">
                        {step === 'email' ? (
                            <>Your AI Team,<br />Ready to Work</>
                        ) : (
                            <>Check Your<br />Email</>
                        )}
                    </h1>
                    <p className="login-hero__subtitle">
                        {step === 'email' ? (
                            'Meet Mei and her specialist crew. They\'re waiting to tackle your next project.'
                        ) : (
                            <>We sent a 6-digit code to <strong>{email}</strong></>
                        )}
                    </p>
                </div>

                {/* Agent Preview - only on email step */}
                {step === 'email' && (
                    <div className="login-agents">
                        <div className="login-agents__avatars">
                            <img src="/portraits/mei.png" alt="Mei" className="avatar avatar--lg avatar--bordered avatar--mei" />
                            <img src="/portraits/hanna.png" alt="Hanna" className="avatar avatar--lg avatar--bordered avatar--hanna" />
                            <img src="/portraits/it.png" alt="IT" className="avatar avatar--lg avatar--bordered avatar--it" />
                            <img src="/portraits/sally.png" alt="Sally" className="avatar avatar--lg avatar--bordered avatar--sally" />
                        </div>
                        <p className="login-agents__label text-secondary">
                            6 specialists ready • Always online
                        </p>
                    </div>
                )}

                {/* Login Form - Email Step */}
                {step === 'email' && (
                    <form className="login-form" onSubmit={handleEmailSubmit}>
                        <input
                            type="email"
                            id="email-input"
                            className="input"
                            placeholder="Enter your email to get started"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={isLoading}
                            autoFocus
                            autoComplete="email"
                        />

                        {error && <p className="login-form__error">{error}</p>}

                        <button
                            type="submit"
                            className="btn btn--primary btn--lg w-full"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Sending Code...' : 'Continue'}
                        </button>
                    </form>
                )}

                {/* Login Form - Code Step */}
                {step === 'code' && (
                    <form className="login-form" onSubmit={handleCodeSubmit}>
                        <input
                            type="text"
                            id="code-input"
                            className="input login-code-input"
                            placeholder="Enter 6-digit code"
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            disabled={isLoading}
                            autoFocus
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={6}
                        />

                        {error && (
                            <p className="login-form__error">
                                {error}
                                {attemptsRemaining !== null && attemptsRemaining > 0 && (
                                    <span> ({attemptsRemaining} attempts remaining)</span>
                                )}
                            </p>
                        )}

                        <button
                            type="submit"
                            className="btn btn--primary btn--lg w-full"
                            disabled={isLoading || code.length < 6}
                        >
                            {isLoading ? 'Verifying...' : 'Sign In'}
                        </button>

                        <div className="login-form__actions">
                            <button
                                type="button"
                                className="login-form__link"
                                onClick={handleResend}
                                disabled={isLoading}
                            >
                                Resend code
                            </button>
                            <span className="login-form__divider">•</span>
                            <button
                                type="button"
                                className="login-form__link"
                                onClick={handleBack}
                                disabled={isLoading}
                            >
                                Use different email
                            </button>
                        </div>
                    </form>
                )}

                {/* Trust Badges */}
                <div className="login-trust">
                    <div className="login-trust__badge">
                        <span className="login-trust__icon">🔒</span>
                        <span>Secure</span>
                    </div>
                    <div className="login-trust__badge">
                        <span className="login-trust__icon">⚡</span>
                        <span>Real AI</span>
                    </div>
                    <div className="login-trust__badge">
                        <span className="login-trust__icon">🚀</span>
                        <span>Fast Setup</span>
                    </div>
                </div>
            </div>

            {/* Background Decoration */}
            <div className="login-bg">
                <div className="login-bg__orb login-bg__orb--1"></div>
                <div className="login-bg__orb login-bg__orb--2"></div>
            </div>
        </div>
    )
}

export default LoginPage
