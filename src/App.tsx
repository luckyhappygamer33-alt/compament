import "./App.css";
import { useEditorStore, selectActiveEditor } from "./store/editorStore";
import Toolbar from "./components/Toolbar/Toolbar";
import PropertiesPanel from "./components/PropertiesPanel/PropertiesPanel";
import CanvasArea, {
  type CanvasAreaHandler,
} from "./components/CanvasArea/CanvasArea";
import LayersPanel from "./components/LayersPanel/LayersPanel";
import NewProjectModal from "./components/NewProjectModal/NewProjectModal";
import { useRef } from "react";
import { EditorTabs } from "./components/EditorTab/EditorTabs";

export default function App() {
  // artboardSize is null until initProject is called
  // that's our signal to show the modal
  const activeEditor = useEditorStore(selectActiveEditor);
  // const activeEditorId = useEditorStore((state) => state.activeEditorId);
  // const editors = useEditorStore((state) => state.editors);

  // const createEditor = useEditorStore((state) => state.createEditor);
  // const setActiveEditor = useEditorStore((state) => state.setActiveEditor);

  const hasProject = activeEditor !== null;

  const canvasAreaRef = useRef<CanvasAreaHandler>(null);

  return (
    <div className="app">
      {/* Modal sits on top of everything until a project is created */}
      {!hasProject && <NewProjectModal />}

      <Toolbar />
      <EditorTabs />
      <div className="app-body">
        <PropertiesPanel onBake={() => canvasAreaRef.current?.handleBake()} />
        <CanvasArea ref={canvasAreaRef} />
        <LayersPanel />
      </div>
    </div>
  );
}
