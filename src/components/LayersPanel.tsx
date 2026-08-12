import {
    ChevronUp,
    ChevronDown,
    GitMerge,
    Eye,
    EyeOff,
    Lock,
    LockOpen,
    Trash2,
    Plus,
    LayerArrowDown,
} from 'lucide-react'
import { useEditorStore } from '../store/editorStore'
import './LayersPanel.css'

export default function LayersPanel() {
    const layers = useEditorStore(state => state.layers)
    const activeLayerId = useEditorStore(state => state.activeLayerId)
    const addLayer = useEditorStore(state => state.addLayer)
    const moveLayer = useEditorStore(state => state.moveLayer)
    const deleteLayer = useEditorStore(state => state.deleteLayer)
    const setActiveLayer = useEditorStore(state => state.setActiveLayer)
    const mergeLayer = useEditorStore(state => state.mergeLayer)
    const toggleLayerVisibility = useEditorStore(state => state.toggleLayerVisibility)
    const toggleLayerLock = useEditorStore(state => state.toggleLayerLock)

    return (
        <div className="layers-panel">
            <div className="panel-header">
                <span>Layers</span>
                <button className="add-layer-btn" title="Add layer" onClick={addLayer}>
                    <Plus size={14} strokeWidth={2} />
                </button>
            </div>
            {layers.map(layer => (
                <div
                    key={layer.id}
                    className={[
                        'layer-row',
                        layer.id === activeLayerId ? 'active' : '',
                        layer.isRoot ? 'root-row' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => setActiveLayer(layer.id)}
                >
                    <div className="layer-preview" />

                    <div className="layer-info">
                        <span className="layer-name">{layer.name}</span>

                        {layer.isRoot ? (
                            <span className="root-badge">root</span>
                        ) : (
                            <div className="layer-btn-group">
                                <button title="Move up"
                                    onClick={e => { moveLayer(layer.id, 'up'); e.stopPropagation() }}>
                                    <ChevronUp size={13} strokeWidth={2} />
                                </button>
                                <button title="Move down"
                                    onClick={e => { moveLayer(layer.id, 'down'); e.stopPropagation() }}>
                                    <ChevronDown size={13} strokeWidth={2} />
                                </button>
                                <button title="Merge down"
                                    onClick={e => { mergeLayer(layer.id); e.stopPropagation() }}>
                                    <LayerArrowDown size={13} strokeWidth={2} />
                                </button>
                                <button title={layer.visible ? 'Hide layer' : 'Show layer'}
                                    onClick={e => { toggleLayerVisibility(layer.id); e.stopPropagation() }}>
                                    {layer.visible
                                        ? <Eye size={13} strokeWidth={2} />
                                        : <EyeOff size={13} strokeWidth={2} />}
                                </button>
                                <button title={layer.locked ? 'Unlock layer' : 'Lock layer'}
                                    onClick={e => { toggleLayerLock(layer.id); e.stopPropagation() }}>
                                    {layer.locked
                                        ? <Lock size={13} strokeWidth={2} />
                                        : <LockOpen size={13} strokeWidth={2} />}
                                </button>
                                <button className="btn-delete" title="Delete layer"
                                    onClick={e => { deleteLayer(layer.id); e.stopPropagation() }}>
                                    <Trash2 size={13} strokeWidth={2} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}