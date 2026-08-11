import './App.css'
import { useEditorStore } from './store/editorStore'
import Toolbar from './components/Toolbar'
import PropertiesPanel from './components/PropertiesPanel'
import CanvasArea from './components/CanvasArea/CanvasArea'
import LayersPanel from './components/LayersPanel'
import NewProjectModal from './components/NewProjectModal'

export default function App() {
    // artboardSize is null until initProject is called
    // that's our signal to show the modal
    const artboardSize = useEditorStore(state => state.artboardSize)
    const hasProject = artboardSize !== null

    return (
        <div className="app">
            {/* Modal sits on top of everything until a project is created */}
            {!hasProject && <NewProjectModal />}

            <Toolbar />
            <div className="app-body">
                <PropertiesPanel />
                <CanvasArea />
                <div className="right-sidebar">
                    <LayersPanel />
                </div>
            </div>
        </div>
    )
}