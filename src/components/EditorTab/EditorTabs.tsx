import { selectActiveEditor, useEditorStore } from "../../store/editorStore";
import "./EditorTabs.css";

export function EditorTabs() {
  const editors = useEditorStore((state) => state.editors);
  const activeEditorId = useEditorStore((state) => state.activeEditorId);
  const activeEditor = useEditorStore(selectActiveEditor);

  const createEditor = useEditorStore((state) => state.createEditor);
  const setActiveEditor = useEditorStore((state) => state.setActiveEditor);

  if (!activeEditor) return null;

  const handleCreateEditor = () => {
    const { width, height } = activeEditor.artboardSize;

    const id = createEditor(
      `Editor ${Object.keys(editors).length + 1}`,
      width,
      height,
    );

    setActiveEditor(id);
  };

  return (
    <div className="editor-tabs">
      {Object.values(editors).map((editor) => (
        <button
          key={editor.id}
          type="button"
          aria-pressed={editor.id === activeEditorId}
          onClick={() => setActiveEditor(editor.id)}
        >
          {editor.name}
        </button>
      ))}

      <button type="button" onClick={handleCreateEditor}>
        + New Editor
      </button>
    </div>
  );
}
