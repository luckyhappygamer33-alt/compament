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

const EMPTY_SELECTION: string[] = []

export const selectActiveSelection = (state: EditorStore): string[] => {
    const layerId = state.activeLayerId

    return layerId ? (state.selectionsByLayerId[layerId] ?? EMPTY_SELECTION) : EMPTY_SELECTION
}

type Tool = 'select' | 'rectangle' | 'ellipse' | 'brush' | 'rectangleSelect'

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

    selectionsByLayerId: Record<string, string[]>

    activeTool: Tool

    // ---- ACTIONS ----

    //Project
    initProject: (width: number, height: number) => void

    //Layers
    addLayer: () => void
    moveLayer: (id: string, direction: 'up' | 'down') => void
    deleteLayer: (id: string) => void
    mergeLayer: (id: string) => void
    setActiveLayer: (id: string) => void
    renameLayer: (id: string, name: string) => void
    toggleLayerVisibility: (id: string) => void
    toggleLayerLock: (id: string) => void

    //Tools
    setActiveTool: (tool: Tool) => void

    //Elements
    addElement: (layerId: string, element: Element) => void
    updateElement: (layerId: string, elementId: string, changes: Partial<Element>) => void
    updateSelectedElements: (updater: (element: Element) => Element) => void
    deleteElement: (layerId: string, elementId: string) => void
    deleteSelectedElements: () => void
    setSelectedElements: (ids: string[]) => void
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
    selectionsByLayerId: {},
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
            selectionsByLayerId: {},
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
            selectionsByLayerId: {
                ...state.selectionsByLayerId,
                [newLayer.id]: [],
            }
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
        const state = get()
        const target = state.layers.find(l => l.id === id)

        if (!target || target.isRoot) return   // only rule: can't delete root

        const layers = state.layers.filter(l => l.id !== id)

        const activeLayerId = state.activeLayerId === id
            ? (layers.find(l => !l.isRoot)?.id ?? layers[0]?.id ?? null)
            : state.activeLayerId

        const selectionsByLayerId = { ...state.selectionsByLayerId }
        delete selectionsByLayerId[id]

        deleteBuffer(id)

        set({
            layers,
            activeLayerId,
            selectionsByLayerId,
        })
    },

    mergeLayer: (id) => {
        const state = get()  // one call, gets everything you need
        const { layers, activeLayerId } = state

        const layerIndex = layers.findIndex(l => l.id === id)
        if (layerIndex < 0 || layerIndex >= layers.length - 1) return

        const source = layers[layerIndex]
        const destination = layers[layerIndex + 1]

        if (destination.isRoot || source.isRoot) return

        // merge pixel buffers — stamp source pixels onto destination
        mergeBuffer(id, destination.id)

        const mergedDestination: Layer = {
            ...destination,
            elements: [...destination.elements, ...source.elements],
        }

        const nextLayers = [...layers]
        nextLayers.splice(layerIndex, 2, mergedDestination)

        const mergedIds = [...new Set([
            ...(state.selectionsByLayerId[destination.id] ?? []),
            ...(state.selectionsByLayerId[id] ?? []),
        ])]

        const selectionsByLayerId = { ...state.selectionsByLayerId }

        delete selectionsByLayerId[id]
        selectionsByLayerId[destination.id] = mergedIds

        const nextActiveId = activeLayerId === id ? destination.id : activeLayerId

        deleteBuffer(id)

        set({
            layers: nextLayers,
            activeLayerId: nextActiveId,
            selectionsByLayerId,
        })

    },

    // Select a layer — drives what the property panel shows
    setActiveLayer: (id) => set(state => {
        if (id === state.activeLayerId || !state.layers.some(l => l.id === id)) return state

        return {
            activeLayerId: id,
        }
    }),

    // Rename a layer in place
    renameLayer: (id, name) =>
        set(state => ({
            layers: state.layers.map(l => (l.id === id ? { ...l, name } : l)),
        })),

    // Toggle a layer's visibility (eye icon)
    toggleLayerVisibility: (id) => {
        set(state => {
            const target = state.layers.find(l => l.id === id)
            if (!target) return state

            const layers = state.layers.map(l => l.id === id ? { ...l, visible: !l.visible } : l)

            const selectionsByLayerId = target.visible ? { ...state.selectionsByLayerId, [id]: [] }
                : state.selectionsByLayerId

            return {
                layers,
                selectionsByLayerId
            }
        })
    },

    // Toggle a layer's locked state (lock icon)
    toggleLayerLock: (id) => {
        set(state => {
            const target = state.layers.find(l => l.id === id)
            if (!target) return state

            const layers = state.layers.map(
                l => l.id === id ? { ...l, locked: !l.locked } : l
            )
            const selectionsByLayerId = !target.locked
                ? { ...state.selectionsByLayerId, [id]: [] }
                : state.selectionsByLayerId

            return {
                layers,
                selectionsByLayerId,
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

    updateSelectedElements: updater =>
        set(state => {
            const activeLayer = state.layers.find(
                l => l.id === state.activeLayerId
            )

            const selectedIds = selectActiveSelection(state)

            if (!activeLayer
                || activeLayer.locked
                || !activeLayer.visible
                || selectedIds?.length === 0) {
                return state
            }

            const selectedSet = new Set(selectedIds)

            return {
                layers: state.layers.map(layer =>
                    layer.id === activeLayer.id
                        ? {
                            ...layer,
                            elements: layer.elements.map(element =>
                                selectedSet.has(element.id) ? updater(element) : element
                            )
                        }
                        : layer
                )
            }
        }),

    // Remove an element from a layer
    deleteElement: (layerId, elementId) => set(state => {
        const layers = state.layers.map(layer =>
            layer.id === layerId
                ? {
                    ...layer,
                    elements: layer.elements.filter(
                        element => element.id !== elementId
                    ),
                }
                : layer
        )

        const ids = (state.selectionsByLayerId[layerId] ?? [])
            .filter(id => id !== elementId)

        const selectionsByLayerId = {
            ...state.selectionsByLayerId,
            [layerId]: ids,
        }

        return {
            layers,
            selectionsByLayerId,
        }
    }),

    deleteSelectedElements: () => set(state => {
        const layerId = state.activeLayerId
        const selectedIds = selectActiveSelection(state)

        if (
            !layerId || selectedIds.length === 0
        ) return state

        const selectedSet = new Set(selectedIds)

        return {
            layers: state.layers.map(layer =>
                layer.id === layerId
                    ? {
                        ...layer,
                        elements: layer.elements.filter(
                            element => !selectedSet.has(element.id)
                        ),
                    }
                    : layer
            ),
            selectionsByLayerId: {
                ...state.selectionsByLayerId,
                [layerId]: [],
            },
        }
    }),

    // Track which element is selected on the canvas
    setSelectedElements: ids => set(state => {
        const activeLayer = state.layers.find(
            l => l.id === state.activeLayerId
        )

        if (
            !activeLayer ||
            !activeLayer.visible ||
            activeLayer.locked
        ) return state

        const validIds = new Set(
            activeLayer.elements.map(element => element.id)
        )

        const selection = [
            ...new Set(ids.filter(id => validIds.has(id))),
        ]

        return {
            selectionsByLayerId: {
                ...state.selectionsByLayerId,
                [activeLayer.id]: selection,
            },
        }
    }),

}))

// ----------------------------------------------------------------
export { uid }