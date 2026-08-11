import './Toolbar.css'
import { useEditorStore } from '../store/editorStore'

export default function Toolbar() {
  const activeTool = useEditorStore(state => state.activeTool)
  const setActiveTool = useEditorStore(state => state.setActiveTool)

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <span className="toolbar-logo">Compament</span>
        <div className="toolbar-divider" />
        <div className="toolbar-tools">
          {/* tools will go here — select, rectangle, ellipse, text, image */}
          <button className={`tool-btn ${activeTool === 'select' ? 'active' : ''}`} onClick={() => setActiveTool('select')}>S</button>
          <button className={`tool-btn ${activeTool === 'rectangle' ? 'active' : ''}`} onClick={() => setActiveTool('rectangle')}>R</button>
          <button className={`tool-btn ${activeTool === 'ellipse' ? 'active' : ''}`} onClick={() => setActiveTool('ellipse')}>E</button>
          <button className={`tool-btn ${activeTool === 'brush' ? 'active' : ''}`} onClick={() => setActiveTool('brush')}>B</button>
          <button className="tool-btn" title="Text">T</button>
          <button className="tool-btn" title="Image">I</button>
        </div>
      </div>
      <div className="toolbar-right">
        <button className="export-btn">Export</button>
      </div>
    </div>
  )
}