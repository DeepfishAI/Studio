import { useState, useEffect, useRef } from 'react'
import '../styles/app.css'

function TerminalPage() {
    const [output, setOutput] = useState([
        { type: 'system', text: '⚡ Express Code Server v1.0' },
        { type: 'system', text: '   DeepFish CLI - Web Interface' },
        { type: 'system', text: '' },
        { type: 'info', text: 'Type /help for available commands' },
        { type: 'system', text: '' },
    ])
    const [input, setInput] = useState('')
    const [connected, setConnected] = useState(false)
    const [loading, setLoading] = useState(false)
    const outputRef = useRef(null)
    const inputRef = useRef(null)

    // Auto-scroll to bottom
    useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight
        }
    }, [output])

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus()
    }, [])

    const addOutput = (type, text) => {
        setOutput(prev => [...prev, { type, text }])
    }

    const handleCommand = async (cmd) => {
        const trimmed = cmd.trim()
        if (!trimmed) return

        // Echo the command
        addOutput('input', `🐟 You: ${trimmed}`)

        // Handle local commands
        if (trimmed === '/help') {
            addOutput('system', '')
            addOutput('accent', '📋 Available Commands:')
            addOutput('info', '  /help      Show this help message')
            addOutput('info', '  /agents    List all agents')
            addOutput('info', '  /status    Check server connection')
            addOutput('info', '  /clear     Clear terminal output')
            addOutput('system', '')
            addOutput('dim', 'Or type naturally to talk to the agents!')
            addOutput('system', '')
            return
        }

        if (trimmed === '/clear') {
            setOutput([
                { type: 'system', text: '⚡ Terminal cleared' },
                { type: 'system', text: '' },
            ])
            return
        }

        if (trimmed === '/status') {
            addOutput('system', '')
            addOutput('info', `🔌 Server: ${connected ? '✅ Connected' : '❌ Disconnected'}`)
            addOutput('info', `📍 API: ${window.location.origin}/api`)
            addOutput('system', '')
            return
        }

        if (trimmed === '/agents') {
            addOutput('system', '')
            addOutput('accent', '👥 Your AI Team:')
            addOutput('info', '  1. Mei      - Project Lead & Orchestrator')
            addOutput('info', '  2. Hanna    - Creative Director')
            addOutput('info', '  3. Oracle   - Senior Developer')
            addOutput('info', '  4. IT       - Technical Support')
            addOutput('info', '  5. Sally    - Business Analyst')
            addOutput('info', '  6. Vesper   - Virtual Receptionist')
            addOutput('system', '')
            return
        }

        // Send to backend API
        setLoading(true)
        try {
            const data = await api.cliCommand(trimmed)
            setConnected(true)

            if (data.response) {
                // Split response into lines
                const lines = data.response.split('\n')
                lines.forEach(line => {
                    if (line.trim()) {
                        addOutput('response', line)
                    }
                })
            }
        } catch (err) {
            addOutput('error', `❌ Connection failed: ${err.message}`)
            addOutput('dim', 'The Express Code Server CLI is a backend service.')
            addOutput('dim', 'Ensure the server is running on port 3001.')
            setConnected(false)
        }
        setLoading(false)
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        if (input.trim() && !loading) {
            handleCommand(input)
            setInput('')
        }
    }

    const getLineClass = (type) => {
        switch (type) {
            case 'input': return 'terminal-line terminal-line--input'
            case 'response': return 'terminal-line terminal-line--response'
            case 'error': return 'terminal-line terminal-line--error'
            case 'accent': return 'terminal-line terminal-line--accent'
            case 'info': return 'terminal-line terminal-line--info'
            case 'dim': return 'terminal-line terminal-line--dim'
            default: return 'terminal-line'
        }
    }

    return (
        <div className="terminal-page">
            <div className="terminal-header">
                <div className="terminal-header__title">
                    <span className="terminal-header__icon">⚡</span>
                    <h1>Express Code Server</h1>
                </div>
                <div className="terminal-header__status">
                    <span className={`status-dot ${connected ? 'status-dot--connected' : 'status-dot--disconnected'}`}></span>
                    <span>{connected ? 'Connected' : 'Local Mode'}</span>
                </div>
            </div>

            <div className="terminal-container">
                <div className="terminal-output" ref={outputRef}>
                    {output.map((line, i) => (
                        <div key={i} className={getLineClass(line.type)}>
                            {line.text}
                        </div>
                    ))}
                    {loading && (
                        <div className="terminal-line terminal-line--dim">
                            ⏳ Processing...
                        </div>
                    )}
                </div>

                <form className="terminal-input-form" onSubmit={handleSubmit}>
                    <span className="terminal-prompt">🐟 {'>'}</span>
                    <input
                        ref={inputRef}
                        type="text"
                        className="terminal-input"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type a command or message..."
                        disabled={loading}
                        autoComplete="off"
                        spellCheck="false"
                    />
                </form>
            </div>

            <div className="terminal-footer">
                <p>
                    💡 This is a web interface for the DeepFish CLI.
                    For full functionality, run <code>npm run cli</code> in your terminal.
                </p>
            </div>
        </div>
    )
}

export default TerminalPage
