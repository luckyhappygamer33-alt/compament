import { create } from 'zustand'
import type { Layer, Element, RootObject, Size } from '../types/schema'

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

// Built-in browser function — generates a unique string ID every call
const uid = () => crypto.randomUUID()

// A fresh layer with no elements
const makeLayer = (name: string): Layer => ({
    id: uid(),
    name,
    visible: true,
    locked: false,
    isRoot: false,
    elements: [],
})

const makeRootLayer = (): Layer => ({
    id: uid(),
    name: 'Root',
    visible: true,
    locked: false,
    isRoot: true,
    elements: [],
})

// ----------------------------------------------------------------
// Store shape — state + actions defined together in one interface
// ----------------------------------------------------------------

interface EditorStore {
    // ---- STATE ----

    // null until the user creates a project
    artboardSize: Size | null

    // The layer stack — always length >= 1 after project init
    layers: Layer[]

    // ID of the currently selected layer in the layer panel
    activeLayerId: string | null

    // ID of the currently selected element on the canvas (null = nothing selected)
    selectedElementId: string | null

    // ---- ACTIONS ----

    // Project
    initProject: (width: number, height: number) => void

    // Layers
    addLayer: () => void
    moveLayer: (id: string, direction: 'up' | 'down') => void
    deleteLayer: (id: string) => void
    mergeLayer: (id: string) => void
    setActiveLayer: (id: string) => void
    renameLayer: (id: string, name: string) => void
    toggleLayerVisibility: (id: string) => void
    toggleLayerLock: (id: string) => void

    // Elements
    addElement: (layerId: string, element: Element) => void
    updateElement: (layerId: string, elementId: string, changes: Partial<Element>) => void
    deleteElement: (layerId: string, elementId: string) => void
    setSelectedElement: (id: string | null) => void
}

// ----------------------------------------------------------------
// The store
// ----------------------------------------------------------------

export const useEditorStore = create<EditorStore>()((set, get) => ({

    // ---- INITIAL STATE ----
    // Everything starts empty — nothing exists until initProject is called

    artboardSize: null,
    layers: [],
    activeLayerId: null,
    selectedElementId: null,

    // ---- ACTIONS ----

    // Called when the user picks dimensions and creates a new project.
    // Sets artboard size and spawns the mandatory first layer.
    initProject: (width, height) => {
        const rootLayer = makeRootLayer()
        const firstLayer = makeLayer('Layer 1')
        set({
            artboardSize: { width, height },
            layers: [firstLayer, rootLayer],
            activeLayerId: firstLayer.id,
            selectedElementId: null,
        })
    },

    // Add a new layer above the current stack.
    // Automatically becomes the active layer.
    addLayer: () => {
        const newLayer = makeLayer(`Layer ${get().layers.length + 1}`)
        set(state => ({
            layers: [newLayer, ...state.layers],
            activeLayerId: newLayer.id,
        }))
    },

    moveLayer: (id, direction) => {
        const layers = get().layers
        const target = layers.find(l => l.id === id)
        if (!target || target.isRoot) return

        const index = layers.findIndex(l => l.id === id)
        if (direction === 'up' && index === 0) return
        if (direction === 'down' && index === layers.length - 1) return
        const rootIndex = layers.findIndex(l => l.isRoot)
        if (direction === 'down' && index === rootIndex - 1) return  // already just above root

        const newLayers = [...layers]
        const swapIndex = direction === 'up' ? index - 1 : index + 1
            ;[newLayers[index], newLayers[swapIndex]] = [newLayers[swapIndex], newLayers[index]]

        set({ layers: newLayers })
    },

    // Delete a layer by ID.
    // INVARIANT: if only root layer exists, do nothing — the root layer cannot be deleted.
    // After deletion, the first remaining layer becomes active.
    deleteLayer: (id) => {
        const { layers } = get()
        const target = layers.find(l => l.id === id)

        if (!target || target.isRoot) return   // only rule: can't delete root

        const remaining = layers.filter(l => l.id !== id)
        set({
            layers: remaining,
            activeLayerId: remaining[0].id,
        })
    },

    mergeLayer: (id) => {
        const { layers, activeLayerId } = get()  // one call, everything you need
        const target = layers.find(l => l.id === id)
        if (!target || target.isRoot) return

        const layerIndex = layers.findIndex(l => l.id === id)
        if (layerIndex === -1 || layerIndex === layers.length - 1) return

        const newLayers = [...layers]
        const destinationLayer = newLayers[layerIndex + 1]
        if (destinationLayer.isRoot) return

        const newActiveId = id === activeLayerId ? destinationLayer.id : activeLayerId

        // TODO: merge elements from source layer into destinationLayer here

        newLayers.splice(layerIndex, 1)

        set({ layers: newLayers, activeLayerId: newActiveId })
    },

    // Select a layer — drives what the property panel shows
    setActiveLayer: (id) => set({ activeLayerId: id }),

    // Rename a layer in place
    renameLayer: (id, name) =>
        set(state => ({
            layers: state.layers.map(l => (l.id === id ? { ...l, name } : l)),
        })),

    // Toggle a layer's visibility (eye icon)
    toggleLayerVisibility: (id) =>
        set(state => ({
            layers: state.layers.map(l =>
                l.id === id ? { ...l, visible: !l.visible } : l
            ),
        })),

    // Toggle a layer's locked state (lock icon)
    toggleLayerLock: (id) =>
        set(state => ({
            layers: state.layers.map(l =>
                l.id === id ? { ...l, locked: !l.locked } : l
            ),
        })),

    // Add an element to a specific layer
    addElement: (layerId, element) =>
        set(state => ({
            layers: state.layers.map(l =>
                l.id === layerId
                    ? { ...l, elements: [...l.elements, element] }
                    : l
            ),
        })),

    // Update specific properties of an element (spread — only what changed)
    updateElement: (layerId, elementId, changes) =>
        set(state => ({
            layers: state.layers.map(l =>
                l.id === layerId
                    ? {
                        ...l,
                        elements: l.elements.map(e =>
                            e.id === elementId ? { ...e, ...changes } : e
                        ),
                    }
                    : l
            ),
        })),

    // Remove an element from a layer
    deleteElement: (layerId, elementId) =>
        set(state => ({
            layers: state.layers.map(l =>
                l.id === layerId
                    ? { ...l, elements: l.elements.filter(e => e.id !== elementId) }
                    : l
            ),
        })),

    // Track which element is selected on the canvas
    setSelectedElement: (id) => set({ selectedElementId: id }),
}))

// ----------------------------------------------------------------
// Export the uid helper so other files can use it when creating elements
// ----------------------------------------------------------------
export { uid }