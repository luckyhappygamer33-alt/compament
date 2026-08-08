import { useEditorStore } from '../store/editorStore'
import './LayersPanel.css'

export default function LayersPanel() {
    const layers = useEditorStore(state => state.layers)
    const activeLayerId = useEditorStore(state => state.activeLayerId)
    const addLayer = useEditorStore(state => state.addLayer)
    const moveLayer = useEditorStore(state => state.moveLayer)
    const deleteLayer = useEditorStore(state => state.deleteLayer)
    const setActiveLayer = useEditorStore(state => state.setActiveLayer)
    const mergerLayer = useEditorStore(state => state.mergeLayer)

    return (
        <div className="layers-panel">
            <div className="panel-header">
                <span>Layers</span>
                <button className="add-layer-btn" title="Add layer" onClick={addLayer}>+</button>
            </div>
            <div className="layers-list">
                {layers.map(layer => (
                    <div
                        key={layer.id}
                        className={`layer-row ${layer.id === activeLayerId ? 'active' : ''}`}
                        onClick={() => setActiveLayer(layer.id)}
                    >
                        <span className="layer-icon">▪</span>
                        <span className="layer-name">{layer.name}</span>
                        {layer.isRoot ? (
                            <span className="root-badge">root</span>
                        ) : (
                            <>
                                <button onClick={e => { moveLayer(layer.id, 'up'); e.stopPropagation() }}>↑</button>
                                <button onClick={e => { moveLayer(layer.id, 'down'); e.stopPropagation() }}>↓</button>
                                <button onClick={e => { mergerLayer(layer.id); e.stopPropagation() }}>V</button>
                                <button onClick={e => { deleteLayer(layer.id); e.stopPropagation() }}>X</button>
                            </>
                        )}
                    </div>
                ))}
                {/* layer rows will go here */}
            </div>
        </div >
    )
}