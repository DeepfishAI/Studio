import { useState, useEffect, useCallback } from 'react'
import MonacoEditorPanel from '../components/MonacoEditorPanel'
import CodePreview from '../components/CodePreview'
import FileTree from '../components/FileTree'
import AssetUploader from '../components/AssetUploader'
import WorkspaceChat from '../components/WorkspaceChat'
import { getWorkspaceFiles, getFileContent, saveFileContent } from '../services/api'

// Initial empty project structure
const defaultProject = {
    files: {},
    assets: {}
}

function WorkspacePage() {
    const [project, setProject] = useState(defaultProject)
    const [fileList, setFileList] = useState([])
    const [activeFile, setActiveFile] = useState(null)
    const [openTabs, setOpenTabs] = useState([])
    const [viewMode, setViewMode] = useState('code') // 'code' or 'preview'
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [saving, setSaving] = useState(false)

    // Load file list from backend on mount
    useEffect(() => {
        async function loadFiles() {
            try {
                setLoading(true)
                const response = await getWorkspaceFiles()
                setFileList(response.files || [])
                setError(null)
            } catch (err) {
                console.error('Failed to load workspace files:', err)
                setError('Failed to load workspace files')
            } finally {
                setLoading(false)
            }
        }
        loadFiles()
    }, [])

    // Get current file content
    const currentContent = project.files[activeFile] || ''

    // Load file content when a file is selected
    const loadFileContent = useCallback(async (filename) => {
        if (project.files[filename] !== undefined) {
            // Already loaded
            return
        }
        try {
            const response = await getFileContent(filename)
            setProject(prev => ({
                ...prev,
                files: {
                    ...prev.files,
                    [filename]: response.content || ''
                }
            }))
        } catch (err) {
            console.error(`Failed to load file ${filename}:`, err)
        }
    }, [project.files])

    // Update file content (local state)
    const handleFileChange = (content) => {
        setProject(prev => ({
            ...prev,
            files: {
                ...prev.files,
                [activeFile]: content
            }
        }))
    }

    // Save file to backend
    const handleSaveFile = async () => {
        if (!activeFile) return
        try {
            setSaving(true)
            await saveFileContent(activeFile, currentContent)
        } catch (err) {
            console.error('Failed to save file:', err)
        } finally {
            setSaving(false)
        }
    }

    // Open a file
    const handleOpenFile = async (filename) => {
        setActiveFile(filename)
        if (!openTabs.includes(filename)) {
            setOpenTabs([...openTabs, filename])
        }
        await loadFileContent(filename)
    }

    // Close a tab
    const handleCloseTab = (filename) => {
        const newTabs = openTabs.filter(t => t !== filename)
        setOpenTabs(newTabs)
        if (activeFile === filename && newTabs.length > 0) {
            setActiveFile(newTabs[0])
        } else if (newTabs.length === 0) {
            setActiveFile(null)
        }
    }

    // Create new file (local only for now)
    const handleCreateFile = (filename) => {
        if (!project.files[filename]) {
            setProject(prev => ({
                ...prev,
                files: {
                    ...prev.files,
                    [filename]: ''
                }
            }))
            setFileList(prev => [...prev, filename])
            handleOpenFile(filename)
        }
    }

    // Delete file (local only for now)
    const handleDeleteFile = (filename) => {
        const newFiles = { ...project.files }
        delete newFiles[filename]
        setProject(prev => ({
            ...prev,
            files: newFiles
        }))
        setFileList(prev => prev.filter(f => f !== filename))
        handleCloseTab(filename)
    }

    // Add asset
    const handleAddAsset = (name, data) => {
        setProject(prev => ({
            ...prev,
            assets: {
                ...prev.assets,
                [name]: data
            }
        }))
    }

    // Apply code from chat
    const handleApplyCode = (filename, content) => {
        setProject(prev => ({
            ...prev,
            files: {
                ...prev.files,
                [filename]: content
            }
        }))
        if (!fileList.includes(filename)) {
            setFileList(prev => [...prev, filename])
        }
        handleOpenFile(filename)
        setViewMode('code')
    }

    if (loading) {
        return (
            <div className="workspace-page workspace-page--loading">
                <div className="workspace-loading">
                    <span className="workspace-loading__icon">🐟</span>
                    <p>Loading workspace...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="workspace-page workspace-page--error">
                <div className="workspace-error">
                    <span className="workspace-error__icon">⚠️</span>
                    <p>{error}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="workspace-page">
            {/* Left: Chat Panel */}
            <div className="workspace-panel workspace-panel--chat">
                <div className="workspace-panel__header">
                    <h3>💬 Agent Chat</h3>
                </div>
                <WorkspaceChat
                    onApplyCode={handleApplyCode}
                    currentFile={activeFile}
                    currentContent={currentContent}
                />
            </div>

            {/* Center: Code Editor OR Preview */}
            <div className="workspace-panel workspace-panel--editor">
                {/* View Toggle */}
                <div className="workspace-view-toggle">
                    <button
                        className={`workspace-view-toggle__btn ${viewMode === 'code' ? 'workspace-view-toggle__btn--active' : ''}`}
                        onClick={() => setViewMode('code')}
                    >
                        📝 Code
                    </button>
                    <button
                        className={`workspace-view-toggle__btn ${viewMode === 'preview' ? 'workspace-view-toggle__btn--active' : ''}`}
                        onClick={() => setViewMode('preview')}
                    >
                        ▶️ Preview
                    </button>
                    {activeFile && (
                        <button
                            className="workspace-view-toggle__btn workspace-view-toggle__btn--save"
                            onClick={handleSaveFile}
                            disabled={saving}
                        >
                            {saving ? '💾 Saving...' : '💾 Save'}
                        </button>
                    )}
                </div>

                {viewMode === 'code' ? (
                    <>
                        <div className="workspace-tabs">
                            {openTabs.map(tab => (
                                <div
                                    key={tab}
                                    className={`workspace-tab ${tab === activeFile ? 'workspace-tab--active' : ''}`}
                                    onClick={() => setActiveFile(tab)}
                                >
                                    <span className="workspace-tab__name">{tab}</span>
                                    <button
                                        className="workspace-tab__close"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleCloseTab(tab)
                                        }}
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                        {activeFile ? (
                            <MonacoEditorPanel
                                filename={activeFile}
                                content={currentContent}
                                onChange={handleFileChange}
                            />
                        ) : (
                            <div className="workspace-empty">
                                <p>Select a file to edit</p>
                            </div>
                        )}
                    </>
                ) : (
                    <CodePreview
                        files={project.files}
                        assets={project.assets}
                    />
                )}
            </div>

            {/* Right: Files & Assets */}
            <div className="workspace-panel workspace-panel--files">
                <div className="workspace-panel__header">
                    <h3>📁 Files ({fileList.length})</h3>
                </div>
                <FileTree
                    files={fileList}
                    activeFile={activeFile}
                    onSelectFile={handleOpenFile}
                    onCreateFile={handleCreateFile}
                    onDeleteFile={handleDeleteFile}
                />

                <div className="workspace-panel__header" style={{ marginTop: 'var(--space-lg)' }}>
                    <h3>📤 Assets</h3>
                </div>
                <AssetUploader
                    assets={project.assets}
                    onAddAsset={handleAddAsset}
                />
            </div>
        </div>
    )
}

export default WorkspacePage
