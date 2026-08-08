import './PropertiesPanel.css'

export default function PropertiesPanel() {
    return (
        <div className="properties-panel">
            <div className="panel-header">Properties</div>
            <div className="panel-body">
                {/* property controls will go here */}
                <span className="panel-empty">No element selected</span>
            </div>
        </div>
    )
}