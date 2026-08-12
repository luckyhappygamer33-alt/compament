import { create } from 'zustand'
import type { Layer, Element, Size } from '../types/schema'
import { createBuffer, deleteBuffer, mergeBuffer } from '../components/CanvasArea/BufferRegistry'

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

type Tool = 'select' | 'rectangle' | 'ellipse' | 'brush' | 'rectselect'

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

    activeTool: Tool

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

    setActiveTool: (tool: Tool) => void

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
    activeTool: 'select',

    // ---- ACTIONS ----

    // Called when the user picks dimensions and creates a new project.
    // Sets artboard size and spawns the mandatory first layer.
    initProject: (width, height) => {
        const rootLayer = makeRootLayer()
        const firstLayer = makeLayer('Layer 1')

        createBuffer(rootLayer.id, width, height)
        createBuffer(firstLayer.id, width, height)

        set({
            artboardSize: { width, height },
            layers: [firstLayer, rootLayer],
            activeLayerId: firstLayer.id,
            selectedElementId: null,
            activeTool: 'select'
        })
    },

    // Add a new layer above the current stack.
    // Automatically becomes the active layer.
    addLayer: () => {
        const { artboardSize } = get()
        if (!artboardSize) return
        const newLayer = makeLayer(`Layer ${get().layers.length + 1}`)
        createBuffer(newLayer.id, artboardSize.width, artboardSize.height)
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

        deleteBuffer(id)

        const remaining = layers.filter(l => l.id !== id)
        set({
            layers: remaining,
            activeLayerId: remaining[0].id,
        })
    },

    mergeLayer: (id) => {
        const { layers, activeLayerId } = get()  // one call, gets everything you need
        const target = layers.find(l => l.id === id)
        if (!target || target.isRoot) return

        const layerIndex = layers.findIndex(l => l.id === id)
        if (layerIndex === -1 || layerIndex === layers.length - 1) return

        const newLayers = [...layers]
        const destinationLayer = newLayers[layerIndex + 1]
        if (destinationLayer.isRoot) return

        const newActiveId = id === activeLayerId ? destinationLayer.id : activeLayerId

        // merge pixel buffers — stamp source pixels onto destination
        mergeBuffer(id, destinationLayer.id)

        destinationLayer.elements = [...destinationLayer.elements, ...newLayers[layerIndex].elements]
        newLayers[layerIndex + 1] = destinationLayer

        newLayers.splice(layerIndex, 1)

        deleteBuffer(id)

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
    toggleLayerVisibility: (id) => {
        set(state => {
            const layer = state.layers.find(l => l.id === id)
            const gettingInvisible = layer && layer.visible
            const layerContainsSelected = layer?.elements.some(e => e.id === state.selectedElementId)
            return {
                layers: state.layers.map(l =>
                    l.id === id ? { ...l, visible: !l.visible } : l
                ),
                // deselect if the layer being hidden contains the selected element
                selectedElementId: gettingInvisible && layerContainsSelected
                    ? null
                    : state.selectedElementId
            }
        })
    },

    // Toggle a layer's locked state (lock icon)
    toggleLayerLock: (id) => {
        set(state => {
            const layer = state.layers.find(l => l.id === id)
            const gettingLocked = layer && !layer.locked
            const layerContainsSelected = layer?.elements.some(e => e.id === state.selectedElementId)
            return {
                layers: state.layers.map(l =>
                    l.id === id ? { ...l, locked: !l.locked } : l
                ),
                // deselect if the layer being locked contains the selected element
                selectedElementId: gettingLocked && layerContainsSelected
                    ? null
                    : state.selectedElementId
            }
        })
    },

    setActiveTool: (tool) => set({ activeTool: tool }),

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
                            e.id === elementId ? { ...e, ...changes } as Element : e
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