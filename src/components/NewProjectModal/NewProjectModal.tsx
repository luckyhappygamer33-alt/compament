import { useState } from 'react'
import { useEditorStore } from '../../store/editorStore'
import './NewProjectModal.css'

const PRESETS = [
    { label: 'Post', width: 1080, height: 1080 },
    { label: 'Banner', width: 1200, height: 628 },
    { label: 'Thumbnail', width: 1280, height: 720 },
    { label: 'Story', width: 1080, height: 1920 },
    { label: 'Icon', width: 512, height: 512 },
]

export default function NewProjectModal() {
    const initProject = useEditorStore(state => state.initProject)

    const [width, setWidth] = useState('1080')
    const [height, setHeight] = useState('1080')

    const handlePreset = (w: number, h: number) => {
        setWidth(String(w))
        setHeight(String(h))
    }

    const handleConfirm = () => {
        const w = parseInt(width)
        const h = parseInt(height)
        if (w <= 0 || h <= 0) return
        initProject(w, h)
    }

    return (
        <div className="modal-overlay">
            <div className="modal">
                <h2 className="modal-title">New Project</h2>
                <p className="modal-subtitle">Choose a canvas size to get started</p>

                <div className="presets">
                    {PRESETS.map(preset => (
                        <button
                            key={preset.label}
                            className="preset-btn"
                            onClick={() => handlePreset(preset.width, preset.height)}
                        >
                            <span className="preset-label">{preset.label}</span>
                            <span className="preset-dims">{preset.width} × {preset.height}</span>
                        </button>
                    ))}
                </div>

                <div className="custom-inputs">
                    <label className="input-group">
                        <span className="input-label">Width</span>
                        <input
                            type="number"
                            className="dim-input"
                            value={width}
                            min={1}
                            onChange={e => setWidth(e.target.value)}
                        />
                        <span className="input-unit">px</span>
                    </label>
                    <span className="input-cross">×</span>
                    <label className="input-group">
                        <span className="input-label">Height</span>
                        <input
                            type="number"
                            className="dim-input"
                            value={height}
                            min={1}
                            onChange={e => setHeight(e.target.value)}
                        />
                        <span className="input-unit">px</span>
                    </label>
                </div>

                <button className="confirm-btn" onClick={handleConfirm}>
                    Create Project
                </button>
            </div>
        </div>
    )
}