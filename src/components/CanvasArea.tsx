import './CanvasArea.css'
import Breadcrumb from './Breadcrumb'

export default function CanvasArea() {
    return (
        <div className="canvas-area">
            <div className="canvas-breadcrumb-bar">
                <Breadcrumb />
            </div>
            <div className="canvas-viewport">
                {/* canvas element will go here in the next step */}
                <div className="canvas-placeholder">
                    Canvas coming very soon!
                </div>
            </div>
        </div>
    )
}