import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { agents } from '../data/agents'
import BusFeed from '../components/BusFeed'

const API_BASE = import.meta.env.VITE_API_URL || '';

function DashboardPage() {
    const { user } = useAuth()
    const [greeting, setGreeting] = useState('Hello')

    useEffect(() => {
        const hour = new Date().getHours()
        if (hour < 12) setGreeting('Good morning')
        else if (hour < 17) setGreeting('Good afternoon')
        else setGreeting('Good evening')
    }, [])

    return (
        <div className="dashboard-eleven">
            {/* Header */}
            <div className="dash-header">
                <div className="dash-header__left">
                    <span className="dash-header__workspace">My Workspace</span>
                    <h1 className="dash-header__greeting">
                        {greeting}, {user?.email ? user.email.split('@')[0] : 'there'} 🐟
                    </h1>
                </div>
                <div className="dash-header__right">
                    <span className="dash-header__question">Need help?</span>
                    <Link to="/app/chat/vesper" className="dash-header__cta">
                        <span className="cta-icon">📞</span>
                        Call Vesper
                    </Link>
                </div>
            </div>

            {/* Agent Cards Row - ElevenLabs Style */}
            <div className="agents-row">
                {agents.map(agent => (
                    <Link
                        key={agent.id}
                        to={`/app/chat/${agent.id}`}
                        className={`agent-tile agent-tile--${agent.id}`}
                    >
                        <div className="agent-tile__icon">
                            <img
                                src={agent.portrait}
                                alt={agent.name}
                                className="agent-tile__portrait"
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'flex';
                                }}
                            />
                            <div className="agent-tile__fallback" style={{ display: 'none' }}>
                                {getAgentEmoji(agent.id)}
                            </div>
                        </div>
                        <span className="agent-tile__name">{agent.name}</span>
                    </Link>
                ))}
            </div>

            {/* Two Column Layout */}
            <div className="dash-columns">
                {/* Left Column: Gadgets & Latest */}
                <div className="dash-column dash-column--left">
                    <h2 className="column-title">Quick Start</h2>

                    <div className="gadget-list">
                        <Link to="/app/chat/mei" className="gadget-item">
                            <div className="gadget-item__icon">💼</div>
                            <div className="gadget-item__content">
                                <h3 className="gadget-item__title">New Project</h3>
                                <p className="gadget-item__desc">Start a project with Mei</p>
                            </div>
                        </Link>

                        <Link to="/app/chat/hanna" className="gadget-item">
                            <div className="gadget-item__icon">🎨</div>
                            <div className="gadget-item__content">
                                <h3 className="gadget-item__title">Design Assets</h3>
                                <p className="gadget-item__desc">Create visuals with Hanna</p>
                            </div>
                        </Link>

                        <Link to="/app/chat/it" className="gadget-item">
                            <div className="gadget-item__icon">💻</div>
                            <div className="gadget-item__content">
                                <h3 className="gadget-item__title">Build Code</h3>
                                <p className="gadget-item__desc">Get IT's expertise</p>
                            </div>
                        </Link>

                        <Link to="/app/chat/sally" className="gadget-item">
                            <div className="gadget-item__icon">📈</div>
                            <div className="gadget-item__content">
                                <h3 className="gadget-item__title">Marketing Strategy</h3>
                                <p className="gadget-item__desc">Grow with Sally</p>
                            </div>
                        </Link>

                        <Link to="/app/chat/oracle" className="gadget-item">
                            <div className="gadget-item__icon">🔮</div>
                            <div className="gadget-item__content">
                                <h3 className="gadget-item__title">Strategic Insight</h3>
                                <p className="gadget-item__desc">Consult the Oracle</p>
                            </div>
                        </Link>
                    </div>

                    <Link to="/app/agents" className="explore-link">
                        Explore all agents →
                    </Link>
                </div>

                {/* Right Column: Status & Locations */}
                <div className="dash-column dash-column--right">
                    <h2 className="column-title">System Status</h2>

                    <div className="status-grid">
                        <StatusCard
                            icon="🌐"
                            title="Railway"
                            status="online"
                            href="https://railway.app"
                        />
                        <StatusCard
                            icon="🧠"
                            title="AI Cortex"
                            subtitle="RAG & Safety"
                            checkUrl={`${API_BASE}/api/bridge/status`}
                        />
                        <StatusCard
                            icon="📱"
                            title="Twilio"
                            status="online"
                            subtitle="Voice ready"
                        />
                        <StatusCard
                            icon="🔊"
                            title="ElevenLabs"
                            status="online"
                            subtitle="TTS active"
                        />
                        <StatusCard
                            icon="🤖"
                            title="LLM"
                            status="online"
                            subtitle="Claude / Gemini"
                        />
                    </div>

                    <h2 className="column-title" style={{ marginTop: '24px' }}>Quick Access</h2>
                    <div className="quick-links">
                        <a href="https://console.twilio.com" target="_blank" rel="noreferrer" className="quick-link">
                            <span className="quick-link__icon">📞</span>
                            Twilio Console
                        </a>
                        <a href="https://elevenlabs.io/app" target="_blank" rel="noreferrer" className="quick-link">
                            <span className="quick-link__icon">🎙️</span>
                            ElevenLabs
                        </a>
                        <a href="https://github.com/DeepfishAI/studio" target="_blank" rel="noreferrer" className="quick-link">
                            <span className="quick-link__icon">🐙</span>
                            GitHub Repo
                        </a>
                    </div>
                </div>
            </div>

            {/* Office Communications Bus */}
            <div className="dash-section">
                <BusFeed />
            </div>

            {/* Styles */}
            <style>{`
                .dashboard-eleven {
                    max-width: 1400px;
                    margin: 0 auto;
                    padding: 30px;
                }

                /* Header */
                .dash-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 32px;
                }
                .dash-header__workspace {
                    display: block;
                    font-size: 0.85rem;
                    color: #8b9bb4;
                    margin-bottom: 4px;
                }
                .dash-header__greeting {
                    font-size: 1.75rem;
                    font-weight: 600;
                    color: #fff;
                    margin: 0;
                }
                .dash-header__right {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .dash-header__question {
                    font-size: 0.9rem;
                    color: #8b9bb4;
                }
                .dash-header__cta {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: #252a36;
                    border: 1px solid #3d4452;
                    padding: 10px 16px;
                    border-radius: 24px;
                    color: #fff;
                    font-size: 0.9rem;
                    font-weight: 500;
                    text-decoration: none;
                    transition: all 0.2s;
                }
                .dash-header__cta:hover {
                    background: #FF3366;
                    border-color: #FF3366;
                }
                .cta-icon {
                    background: #FF3366;
                    padding: 4px 8px;
                    border-radius: 16px;
                    font-size: 0.8rem;
                }

                /* Agent Tiles Row */
                .agents-row {
                    display: flex;
                    gap: 16px;
                    margin-bottom: 40px;
                    overflow-x: auto;
                    padding-bottom: 8px;
                }
                .agent-tile {
                    flex: 0 0 auto;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 12px;
                    padding: 20px 24px;
                    background: #1a1d24;
                    border: 1px solid #2d3342;
                    border-radius: 16px;
                    text-decoration: none;
                    transition: all 0.2s;
                    min-width: 120px;
                }
                .agent-tile:hover {
                    background: #252a36;
                    border-color: #3d4452;
                    transform: translateY(-2px);
                }
                .agent-tile--vesper:hover { border-color: #FF3366; }
                .agent-tile--mei:hover { border-color: #3b82f6; }
                .agent-tile--hanna:hover { border-color: #f59e0b; }
                .agent-tile--it:hover { border-color: #10b981; }
                .agent-tile--sally:hover { border-color: #a855f7; }
                .agent-tile--oracle:hover { border-color: #06b6d4; }
                
                .agent-tile__icon {
                    width: 56px;
                    height: 56px;
                    border-radius: 12px;
                    overflow: hidden;
                    background: #252a36;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .agent-tile__portrait {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                .agent-tile__fallback {
                    font-size: 1.5rem;
                }
                .agent-tile__name {
                    color: #d1d5db;
                    font-size: 0.9rem;
                    font-weight: 500;
                }

                /* Two Column Layout */
                .dash-columns {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 32px;
                    margin-bottom: 32px;
                }
                @media (max-width: 900px) {
                    .dash-columns { grid-template-columns: 1fr; }
                }
                .column-title {
                    font-size: 1rem;
                    font-weight: 600;
                    color: #fff;
                    margin: 0 0 16px 0;
                }

                /* Gadget List (Left Column) */
                .gadget-list {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .gadget-item {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 14px 16px;
                    background: #1a1d24;
                    border: 1px solid #2d3342;
                    border-radius: 12px;
                    text-decoration: none;
                    transition: all 0.2s;
                }
                .gadget-item:hover {
                    background: #252a36;
                    border-color: #FF3366;
                }
                .gadget-item__icon {
                    font-size: 1.5rem;
                    width: 48px;
                    height: 48px;
                    background: #252a36;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .gadget-item__title {
                    color: #fff;
                    font-size: 0.95rem;
                    font-weight: 500;
                    margin: 0 0 4px 0;
                }
                .gadget-item__desc {
                    color: #8b9bb4;
                    font-size: 0.8rem;
                    margin: 0;
                }
                .explore-link {
                    display: inline-block;
                    margin-top: 16px;
                    color: #8b9bb4;
                    font-size: 0.9rem;
                    text-decoration: none;
                    transition: color 0.2s;
                }
                .explore-link:hover {
                    color: #FF3366;
                }

                /* Status Grid (Right Column) */
                .status-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 12px;
                }
                .status-card {
                    background: #1a1d24;
                    border: 1px solid #2d3342;
                    border-radius: 12px;
                    padding: 16px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    text-decoration: none;
                    transition: all 0.2s;
                }
                .status-card:hover {
                    background: #252a36;
                }
                .status-card__icon {
                    font-size: 1.5rem;
                }
                .status-card__content {
                    flex: 1;
                }
                .status-card__title {
                    color: #fff;
                    font-size: 0.9rem;
                    font-weight: 500;
                    margin: 0 0 2px 0;
                }
                .status-card__subtitle {
                    color: #6b7280;
                    font-size: 0.75rem;
                    margin: 0;
                }
                .status-card__indicator {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #10b981;
                }
                .status-card--offline .status-card__indicator {
                    background: #ef4444;
                }

                /* Quick Links */
                .quick-links {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .quick-link {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px 16px;
                    background: #1a1d24;
                    border: 1px solid #2d3342;
                    border-radius: 10px;
                    color: #d1d5db;
                    font-size: 0.9rem;
                    text-decoration: none;
                    transition: all 0.2s;
                }
                .quick-link:hover {
                    background: #252a36;
                    color: #fff;
                }
                .quick-link__icon {
                    font-size: 1.1rem;
                }

                /* Section */
                .dash-section {
                    margin-top: 16px;
                }
            `}</style>
        </div>
    )
}

function StatusCard({ icon, title, status: initialStatus, subtitle, href, checkUrl }) {
    const Component = href ? 'a' : 'div';
    const [status, setStatus] = useState(initialStatus || 'online');

    useEffect(() => {
        if (!checkUrl) return;

        const checkStatus = async () => {
            try {
                // If it's the Cortex (Python), we expect a status JSON
                const res = await fetch(checkUrl);
                if (res.ok) setStatus('online');
                else setStatus('offline');
            } catch (e) {
                setStatus('offline');
            }
        };

        checkStatus();
        const interval = setInterval(checkStatus, 10000);
        return () => clearInterval(interval);
    }, [checkUrl]);

    return (
        <Component
            className={`status-card ${status !== 'online' ? 'status-card--offline' : ''}`}
            href={href}
            target={href ? '_blank' : undefined}
            rel={href ? 'noreferrer' : undefined}
        >
            <div className="status-card__icon">{icon}</div>
            <div className="status-card__content">
                <h3 className="status-card__title">{title}</h3>
                {subtitle && <p className="status-card__subtitle">{subtitle}</p>}
            </div>
            <div className={`status-card__indicator ${status}`} />
        </Component>
    )
}

function getAgentEmoji(agentId) {
    const emojis = {
        vesper: '📞',
        mei: '📋',
        hanna: '🎨',
        it: '💻',
        sally: '📈',
        oracle: '🔮'
    };
    return emojis[agentId] || '🤖';
}

export default DashboardPage
