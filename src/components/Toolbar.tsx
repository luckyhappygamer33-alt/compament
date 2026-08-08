import './Toolbar.css'

export default function Toolbar() {
  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <span className="toolbar-logo">Compament</span>
        <div className="toolbar-divider" />
        <div className="toolbar-tools">
          {/* tools will go here — select, rectangle, ellipse, text, image */}
          <button className="tool-btn" title="Select">S</button>
          <button className="tool-btn" title="Rectangle">R</button>
          <button className="tool-btn" title="Ellipse">E</button>
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