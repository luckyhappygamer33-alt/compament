import { create } from "zustand";
import type { Layer, Element, Editor, Tool } from "../types/schema";
import {
  createBuffer,
  deleteBuffer,
  mergeBuffer,
} from "../components/CanvasArea/BufferRegistry";
// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

// Built-in browser function — generates a unique string ID every call
const uid = () => crypto.randomUUID();

// A fresh layer with no elements
const makeLayer = (name: string): Layer => ({
  id: uid(),
  name,
  visible: true,
  locked: false,
  elements: [],
});

const EMPTY_SELECTION: string[] = [];

export const selectActiveSelection = (state: EditorStore): string[] => {
  const editor = selectActiveEditor(state);
  if (!editor) return EMPTY_SELECTION;

  return editor.selectionsByLayerId[editor.activeLayerId] ?? EMPTY_SELECTION;
};

export const selectActiveEditor = (state: EditorStore): Editor | null => {
  const id = state.activeEditorId;

  if (!id) return null;

  return state.editors[id] ?? null;
};

// ----------------------------------------------------------------
// Store shape — state + actions defined together in one interface
// ----------------------------------------------------------------

interface EditorStore {
  // ---- STATE ----

  editors: Record<string, Editor>;
  activeEditorId: string | null;

  // ---- ACTIONS ----

  //Project
  initProject: (width: number, height: number) => void;
  createEditor: (name: string, width: number, height: number) => string;
  setActiveEditor: (id: string) => void;
  setActiveTool: (tool: Tool) => void;
  //Layers
  addLayer: () => void;
  moveLayer: (id: string, direction: "up" | "down") => void;
  deleteLayer: (id: string) => void;
  mergeLayer: (id: string) => void;
  setActiveLayer: (id: string) => void;
  renameLayer: (id: string, name: string) => void;
  toggleLayerVisibility: (id: string) => void;
  toggleLayerLock: (id: string) => void;

  //Elements
  addElement: (layerId: string, element: Element) => void;
  updateElement: (
    layerId: string,
    elementId: string,
    changes: Partial<Element>,
  ) => void;
  updateSelectedElements: (updater: (element: Element) => Element) => void;
  deleteElement: (layerId: string, elementId: string) => void;
  deleteSelectedElements: () => void;
  setSelectedElements: (ids: string[]) => void;
}

// ----------------------------------------------------------------
// The store
// ----------------------------------------------------------------

export const useEditorStore = create<EditorStore>()((set, get) => ({
  // ---- INITIAL STATE ----
  // Everything starts empty — nothing exists until initProject is called

  editors: {},
  activeEditorId: null,

  // ---- ACTIONS ----

  // Called when the user picks dimensions and creates a new project.
  // Sets artboard size and spawns the mandatory first layer.

  initProject: (width, height) => {
    const editorId = get().createEditor("Untitled", width, height);

    //here is set internally cause createEditor has its own set and it has to complete before this second set()
    set((state) => ({
      editors: { [editorId]: state.editors[editorId] },
      activeEditorId: editorId,
    }));
  },

  createEditor: (name, width, height) => {
    const firstLayer = makeLayer("Layer 1");

    const editor: Editor = {
      id: uid(),
      name,
      artboardSize: { width, height },
      layers: [firstLayer],
      activeLayerId: firstLayer.id,
      selectionsByLayerId: {
        [firstLayer.id]: [],
      },
      rootElementId: null,
      activeTool: "select",
    };

    createBuffer(firstLayer.id, width, height);

    set((state) => ({
      editors: {
        ...state.editors,
        [editor.id]: editor,
      },
    }));

    return editor.id;
  },

  setActiveEditor: (id) =>
    set((state) => {
      if (!state.editors[id] || state.activeEditorId === id) return state;

      return {
        activeEditorId: id,
      };
    }),

  // Add a new layer above the current stack.
  // Automatically becomes the active layer.
  addLayer: () =>
    set((state) => {
      const editor = selectActiveEditor(state);
      if (!editor) return state;

      const newLayer = makeLayer(`Layer ${editor.layers.length + 1}`);

      const layers = [newLayer, ...editor.layers];

      const selectionsByLayerId = {
        ...editor.selectionsByLayerId,
        [newLayer.id]: [],
      };

      createBuffer(
        newLayer.id,
        editor.artboardSize.width,
        editor.artboardSize.height,
      );

      return {
        editors: {
          ...state.editors,
          [editor.id]: {
            ...editor,
            layers,
            activeLayerId: newLayer.id,
            selectionsByLayerId,
          },
        },
      };
    }),

  moveLayer: (id, direction) =>
    set((state) => {
      const editor = selectActiveEditor(state);
      if (!editor) return state;

      const index = editor.layers.findIndex((layer) => layer.id === id);
      if (index === -1) return state;

      const swapIndex = direction === "up" ? index - 1 : index + 1;

      if (swapIndex < 0 || swapIndex >= editor.layers.length) return state;

      const layers = [...editor.layers];
      const temp = layers[index];
      layers[index] = layers[swapIndex];
      layers[swapIndex] = temp;

      return {
        editors: {
          ...state.editors,
          [editor.id]: {
            ...editor,
            layers,
          },
        },
      };
    }),

  // Delete a layer by ID.
  // INVARIANT: if only root layer exists, do nothing — the root layer cannot be deleted.
  // After deletion, the first remaining layer becomes active.
  deleteLayer: (id) =>
    set((state) => {
      const editor = selectActiveEditor(state);
      if (!editor) return state;

      const target = editor.layers.find((layer) => layer.id === id);
      if (!target || editor.layers.length <= 1) return state;

      const layers = editor.layers.filter((layer) => layer.id !== id);

      const activeLayerId =
        editor.activeLayerId === id ? layers[0].id : editor.activeLayerId;

      const selectionsByLayerId = { ...editor.selectionsByLayerId };
      delete selectionsByLayerId[id];

      deleteBuffer(id);

      return {
        editors: {
          ...state.editors,
          [editor.id]: {
            ...editor,
            layers,
            activeLayerId,
            selectionsByLayerId,
          },
        },
      };
    }),

  mergeLayer: (id) =>
    set((state) => {
      const editor = selectActiveEditor(state);
      if (!editor) return state;

      const layerIndex = editor.layers.findIndex((layer) => layer.id === id);

      if (layerIndex < 0 || layerIndex >= editor.layers.length - 1) {
        return state;
      }

      const source = editor.layers[layerIndex];
      const destination = editor.layers[layerIndex + 1];

      // Merge raster buffers
      mergeBuffer(source.id, destination.id);

      // Merge vector elements
      const mergedDestination: Layer = {
        ...destination,
        elements: [...destination.elements, ...source.elements],
      };

      const layers = [...editor.layers];
      layers.splice(layerIndex, 2, mergedDestination);

      // Merge selections
      const mergedIds = [
        ...new Set([
          ...(editor.selectionsByLayerId[destination.id] ?? []),
          ...(editor.selectionsByLayerId[source.id] ?? []),
        ]),
      ];

      const selectionsByLayerId = { ...editor.selectionsByLayerId };

      delete selectionsByLayerId[source.id];
      selectionsByLayerId[destination.id] = mergedIds;

      // Update active layer
      const activeLayerId =
        editor.activeLayerId === source.id
          ? destination.id
          : editor.activeLayerId;

      // Remove obsolete raster buffer
      deleteBuffer(source.id);

      return {
        editors: {
          ...state.editors,
          [editor.id]: {
            ...editor,
            layers,
            activeLayerId,
            selectionsByLayerId,
          },
        },
      };
    }),

  // Select a layer — drives what the property panel shows
  setActiveLayer: (id) =>
    set((state) => {
      const editor = selectActiveEditor(state);

      if (!editor || id === editor.activeLayerId) return state;
      if (!editor.layers.some((layer) => layer.id === id)) return state;

      return {
        editors: {
          ...state.editors,
          [editor.id]: {
            ...editor,
            activeLayerId: id,
          },
        },
      };
    }),

  // Rename a layer in place
  renameLayer: (id, name) =>
    set((state) => {
      const editor = selectActiveEditor(state);
      if (!editor) return state;

      const target = editor.layers.find((layer) => layer.id === id);
      if (!target || target.name === name) return state;

      const layers = editor.layers.map((layer) =>
        layer.id === id ? { ...layer, name } : layer,
      );

      return {
        editors: {
          ...state.editors,
          [editor.id]: {
            ...editor,
            layers,
          },
        },
      };
    }),

  // Toggle a layer's visibility (eye icon)
  toggleLayerVisibility: (id) => {
    set((state) => {
      const editor = selectActiveEditor(state);
      if (!editor) return state;

      const target = editor.layers.find((layer) => layer.id === id);
      if (!target) return state;

      const layers = editor.layers.map((layer) =>
        layer.id === id ? { ...layer, visible: !layer.visible } : layer,
      );

      const selectionsByLayerId = target.visible
        ? { ...editor.selectionsByLayerId, [id]: [] }
        : editor.selectionsByLayerId;

      return {
        editors: {
          ...state.editors,
          [editor.id]: {
            ...editor,
            layers,
            selectionsByLayerId,
          },
        },
      };
    });
  },

  // Toggle a layer's locked state (lock icon)
  toggleLayerLock: (id) => {
    set((state) => {
      const editor = selectActiveEditor(state);
      if (!editor) return state;

      const target = editor.layers.find((layer) => layer.id === id);
      if (!target) return state;

      const layers = editor.layers.map((layer) =>
        layer.id === id ? { ...layer, locked: !layer.locked } : layer,
      );
      const selectionsByLayerId = !target.locked
        ? { ...editor.selectionsByLayerId, [id]: [] }
        : editor.selectionsByLayerId;

      return {
        editors: {
          ...state.editors,
          [editor.id]: {
            ...editor,
            layers,
            selectionsByLayerId,
          },
        },
      };
    });
  },

  setActiveTool: (tool) =>
    set((state) => {
      const editor = selectActiveEditor(state);

      if (!editor || editor.activeTool === tool) return state;

      return {
        editors: {
          ...state.editors,
          [editor.id]: {
            ...editor,
            activeTool: tool,
          },
        },
      };
    }),

  // Add an element to a specific layer
  addElement: (layerId, element) =>
    set((state) => {
      const editor = selectActiveEditor(state);
      if (!editor) return state;

      const target = editor.layers.find((layer) => layer.id === layerId);
      if (!target) return state;

      const layers = editor.layers.map((layers) =>
        layers.id === layerId
          ? { ...layers, elements: [...layers.elements, element] }
          : layers,
      );

      return {
        editors: {
          ...state.editors,
          [editor.id]: {
            ...editor,
            layers,
          },
        },
      };
    }),

  // Update specific properties of an element (spread — only what changed)
  updateElement: (layerId, elementId, changes) =>
    set((state) => {
      const editor = selectActiveEditor(state);
      if (!editor) return state;

      const targetLayer = editor.layers.find((layer) => layer.id === layerId);

      if (
        !targetLayer ||
        !targetLayer.elements.some((element) => element.id === elementId)
      )
        return state;

      const layers = editor.layers.map((layer) =>
        layer.id === layerId
          ? {
              ...layer,
              elements: layer.elements.map((element) =>
                element.id === elementId
                  ? ({ ...element, ...changes } as Element)
                  : element,
              ),
            }
          : layer,
      );

      return {
        editors: {
          ...state.editors,
          [editor.id]: {
            ...editor,
            layers,
          },
        },
      };
    }),

  updateSelectedElements: (updater) =>
    set((state) => {
      const editor = selectActiveEditor(state);
      if (!editor) return state;

      const activeLayer = editor.layers.find(
        (layer) => layer.id === editor.activeLayerId,
      );

      const selectedIds = selectActiveSelection(state);

      if (
        !activeLayer ||
        activeLayer.locked ||
        !activeLayer.visible ||
        selectedIds?.length === 0
      ) {
        return state;
      }

      const selectedSet = new Set(selectedIds);

      const layers = editor.layers.map((layer) =>
        layer.id === activeLayer.id
          ? {
              ...layer,
              elements: layer.elements.map((element) =>
                selectedSet.has(element.id) ? updater(element) : element,
              ),
            }
          : layer,
      );

      return {
        editors: {
          ...state.editors,
          [editor.id]: {
            ...editor,
            layers,
          },
        },
      };
    }),

  // Remove an element from a layer
  deleteElement: (layerId, elementId) =>
    set((state) => {
      const editor = selectActiveEditor(state);
      if (!editor) return state;

      const targetLayer = editor.layers.find((layer) => layer.id === layerId);
      if (!targetLayer || !targetLayer.elements.some((e) => e.id === elementId))
        return state;

      const layers = editor.layers.map((layer) =>
        layer.id === layerId
          ? {
              ...layer,
              elements: layer.elements.filter(
                (element) => element.id !== elementId,
              ),
            }
          : layer,
      );

      const selectionsByLayerId = {
        ...editor.selectionsByLayerId,
        [layerId]: (editor.selectionsByLayerId[layerId] ?? []).filter(
          (id) => id !== elementId,
        ),
      };

      return {
        editors: {
          ...state.editors,
          [editor.id]: {
            ...editor,
            layers,
            selectionsByLayerId,
          },
        },
      };
    }),

  deleteSelectedElements: () =>
    set((state) => {
      const editor = selectActiveEditor(state);
      if (!editor) return state;

      const layerId = editor.activeLayerId;
      const selectedIds = selectActiveSelection(state);

      if (selectedIds.length === 0) return state;

      const selectedSet = new Set(selectedIds);

      const layers = editor.layers.map((layer) =>
        layer.id === layerId
          ? {
              ...layer,
              elements: layer.elements.filter(
                (element) => !selectedSet.has(element.id),
              ),
            }
          : layer,
      );

      const selectionsByLayerId = {
        ...editor.selectionsByLayerId,
        [layerId]: [],
      };

      return {
        editors: {
          ...state.editors,
          [editor.id]: {
            ...editor,
            layers,
            selectionsByLayerId,
          },
        },
      };
    }),

  // Track which element is selected on the canvas
  setSelectedElements: (ids) =>
    set((state) => {
      const editor = selectActiveEditor(state);
      if (!editor) return state;

      const activeLayer = editor.layers.find(
        (layer) => layer.id === editor.activeLayerId,
      );

      if (!activeLayer || !activeLayer.visible || activeLayer.locked)
        return state;

      const validIds = new Set(
        activeLayer.elements.map((element) => element.id),
      );

      const selection = [...new Set(ids.filter((id) => validIds.has(id)))];

      const selectionsByLayerId = {
        ...editor.selectionsByLayerId,
        [activeLayer.id]: selection,
      };

      return {
        editors: {
          ...state.editors,
          [editor.id]: {
            ...editor,
            selectionsByLayerId,
          },
        },
      };
    }),
}));

// ----------------------------------------------------------------
export { uid };
