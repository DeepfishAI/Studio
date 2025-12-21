import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { agents } from '../data/agents'
import BusFeed from '../components/BusFeed'

function DashboardPage() {
    const { user } = useAuth()

    return (
        <div className="dashboard-page">
            {/* Header */}
            <div className="dashboard__header">
                <h1 className="dashboard__greeting">
                    Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}! 👋
                </h1>
                <p className="dashboard__subtitle">
                    Your AI team is ready to help. What would you like to work on today?
                </p>
            </div>

            {/* Quick Actions */}
            <div className="dashboard__section">
                <div className="dashboard__section-header">
                    <h2 className="dashboard__section-title">Quick Actions</h2>
                </div>
                <div className="quick-actions">
                    <Link to="/app/chat/mei" className="quick-action-card">
                        <div className="quick-action-card__icon">💬</div>
                        <h3 className="quick-action-card__title">New Project</h3>
                        <p className="quick-action-card__desc">
                            Start a conversation with Mei
                        </p>
                    </Link>
                    <Link to="/app/agents" className="quick-action-card">
                        <div className="quick-action-card__icon">👥</div>
                        <h3 className="quick-action-card__title">Meet the Team</h3>
                        <p className="quick-action-card__desc">
                            Explore agent profiles
                        </p>
                    </Link>
                    <Link to="/app/chat/hanna" className="quick-action-card">
                        <div className="quick-action-card__icon">🎨</div>
                        <h3 className="quick-action-card__title">Design Something</h3>
                        <p className="quick-action-card__desc">
                            Work with Hanna
                        </p>
                    </Link>
                    <Link to="/app/chat/it" className="quick-action-card">
                        <div className="quick-action-card__icon">💻</div>
                        <h3 className="quick-action-card__title">Build Code</h3>
                        <p className="quick-action-card__desc">
                            Get IT's expertise
                        </p>
                    </Link>
                </div>
            </div>

            {/* Team Status */}
            <div className="dashboard__section">
                <div className="dashboard__section-header">
                    <h2 className="dashboard__section-title">Your Team</h2>
                    <Link to="/app/agents" className="btn btn--ghost btn--sm">
                        View All →
                    </Link>
                </div>
                <div className="agents-grid">
                    {agents.slice(0, 4).map(agent => (
                        <div key={agent.id} className={`agent-card agent-card--${agent.id}`}>
                            <div className="agent-card__header">
                                <img
                                    src={agent.portrait}
                                    alt={agent.name}
                                    className="agent-card__avatar"
                                />
                                <div className="agent-card__info">
                                    <h3 className="agent-card__name">{agent.name}</h3>
                                    <p className="agent-card__title">{agent.title}</p>
                                </div>
                            </div>
                            <p className="agent-card__desc">
                                {agent.description?.substring(0, 100)}...
                            </p>
                            <div className="agent-card__actions">
                                <Link to={`/app/chat/${agent.id}`} className="btn btn--primary btn--sm">
                                    💬 Chat
                                </Link>
                                <Link to={`/app/agents/${agent.id}`} className="btn btn--secondary btn--sm">
                                    Profile
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Live Operations Feed */}
            <BusFeed />

            {/* Project History & Deliverables */}
            <div className="dashboard__section" style={{ marginTop: '40px' }}>
                <div className="dashboard__section-header">
                    <h2 className="dashboard__section-title">Project History & Deliverables</h2>
                </div>
                <ProjectHistoryList />
            </div>
        </div>
    )
}

function ProjectHistoryList() {
    const [projects, setProjects] = React.useState([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        fetch('/api/projects') // Assuming proxy setup or full URL needed
            .then(res => res.json())
            .then(data => {
                if (data.success) setProjects(data.projects);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load history", err);
                setLoading(false);
            });
    }, []);

    if (loading) return <div>Loading history...</div>;
    if (projects.length === 0) return <div className="text-gray-500">No projects recorded yet.</div>;

    return (
        <div className="history-list">
            {projects.map(p => (
                <div key={p.id} className={`history-item history-item--${p.status}`}>
                    <div className="history-item__header">
                        <span className={`tag tag--${p.status}`}>{p.status.toUpperCase()}</span>
                        <span className="history-item__date">{new Date(p.created).toLocaleString()}</span>
                    </div>
                    <div className="history-item__body">
                        <strong>{p.request}</strong>
                        {p.deliverable && (
                            <div className="history-item__deliverable">
                                <span className="icon">📦</span>
                                <span className="content">{p.deliverable.substring(0, 100)}...</span>
                            </div>
                        )}
                    </div>
                    <div className="history-item__footer">
                        Assigned: {p.agent || 'Unassigned'}
                    </div>
                </div>
            ))}
            <style>{`
                .history-list { display: grid; gap: 15px; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
                .history-item { background: #1a1d24; border: 1px solid #2d3342; padding: 15px; border-radius: 8px; }
                .history-item--completed { border-color: #10b981; }
                .history-item__header { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 0.8rem; color: #8b9bb4; }
                .history-item__body { margin-bottom: 10px; }
                .history-item__deliverable { margin-top: 8px; background: #252a36; padding: 8px; border-radius: 4px; font-size: 0.9rem; font-family: monospace; }
                .history-item__footer { font-size: 0.8rem; color: #6b7280; }
                .tag--completed { color: #10b981; }
                .tag--active { color: #3b82f6; }
            `}</style>
        </div>
    );
}

export default DashboardPage
