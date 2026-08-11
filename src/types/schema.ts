// ============================================================
// PRIMITIVES — building blocks used throughout
// ============================================================

type ID = string

export interface Color {
    r: number   // 0-255
    g: number   // 0-255
    b: number   // 0-255
    a: number   // 0-1
}

interface Vector2 {
    x: number
    y: number
}

export interface Size {
    width: number
    height: number
}

// ============================================================
// STYLE — properties that can be applied to any element
// ============================================================

interface GradientStop {
    position: number  // 0-1 along the gradient
    color: Color
}

interface LinearGradient {
    angle: number  // degrees
    stops: GradientStop[]
}

type Fill =
    | { type: 'solid'; color: Color }
    | { type: 'gradient'; gradient: LinearGradient }

interface Stroke {
    color: Color
    width: number
    style: 'solid' | 'dashed' | 'dotted'
}

interface Shadow {
    color: Color
    blur: number
    offsetX: number
    offsetY: number
}

// Shared visual properties every element can have
interface ElementStyle {
    fill?: Fill
    stroke?: Stroke
    shadow?: Shadow
    opacity: number  // 0-1
}


// ============================================================
// ELEMENTS — the actual designed objects inside layers
// ============================================================

// Every element shares these base properties
export interface BaseElement {
    id: ID
    position: Vector2
    size: Size
    rotation: number  // degrees
    style: ElementStyle
}

interface RectangleElement extends BaseElement {
    type: 'rectangle'
    cornerRadius: number
}

interface EllipseElement extends BaseElement {
    type: 'ellipse'
}

interface TextElement extends BaseElement {
    type: 'text'
    content: string
    fontFamily: string
    fontSize: number
    fontWeight: number
    color: Color
    alignment: 'left' | 'center' | 'right'
}

interface ImageElement extends BaseElement {
    type: 'image'
    src: string  // data URL or local file reference
}

// A placed instance of a component on a canvas
// Points to a component (and optionally a specific variant)
interface ComponentInstanceElement extends BaseElement {
    type: 'componentInstance'
    componentId: ID
    variantId?: ID  // if absent, uses the base component
}

export type Element =
    | RectangleElement
    | EllipseElement
    | TextElement
    | ImageElement
    | ComponentInstanceElement


// ============================================================
// LAYER — the structural slot that holds elements
// ============================================================

export interface Layer {
    id: ID
    name: string
    visible: boolean
    locked: boolean
    isRoot: boolean
    elements: Element[]  // all elements in this layer
}

// ============================================================
// EDITOR — the core workspace
// ============================================================

// Every editor is structurally identical.
// "Main" / export root is just a flag, not a structural difference.
interface Editor {
    id: ID
    artboardSize: Size       // defines canvas dimensions at top level
    layers: Layer[]          // always length >= 1, enforced at data level
    isExportRoot: boolean    // user-designated export target
}


// ============================================================
// COMPONENT — a named reusable editor in the library
// ============================================================

interface Component {
    id: ID
    name: string
    editor: Editor    // the component is an editor — same structure, nothing new
    variants: Variant[]
}


// ============================================================
// VARIANT SYSTEM — derives from a parent component or variant
// ============================================================

// --- Layer-level overrides ---
// Tracks structural changes the variant made to the layer stack

interface AddedLayerOverride {
    type: 'added'
    layer: Layer     // the new layer, local to this variant
    index: number    // where it sits in the stack
}

interface RemovedLayerOverride {
    type: 'removed'
    layerId: ID      // ID of the parent layer that was removed in this variant
}

// Reordering in variant: we store the explicit order of layer IDs
// If absent, order follows parent. If present, this order is used.
type LayerOrder = ID[]  // ordered list of layer IDs (parent + added)


// --- Within-layer overrides ---
// Tracks changes made inside a linked layer, keyed by position
// Position-based: if parent moves an object, the old position override becomes orphaned
// (correct behavior — parent change carries through to new position)

interface AddWithinLayerOverride {
    type: 'add'
    position: Vector2
    element: Element   // the new element to insert
}

interface RemoveWithinLayerOverride {
    type: 'remove'
    position: Vector2  // position of the element to remove
}

interface ModifyWithinLayerOverride {
    type: 'modify'
    position: Vector2
    properties: Partial<Element>  // only the changed properties
}

type WithinLayerOverride =
    | AddWithinLayerOverride
    | RemoveWithinLayerOverride
    | ModifyWithinLayerOverride


// --- Variant ---

interface Variant {
    id: ID
    name: string
    parentId: ID  // ID of parent Component or parent Variant — enables variant of variant

    // Layer-level overrides
    layerOverrides: (AddedLayerOverride | RemovedLayerOverride)[]
    layerOrder?: LayerOrder   // absent = follow parent order

    // Within-layer overrides
    // Key = layer ID (only linked layers from parent have entries here)
    withinLayerOverrides: Record<ID, WithinLayerOverride[]>
}


// ============================================================
// PROJECT — the top-level container for everything
// ============================================================

interface Project {
    id: ID
    name: string
    createdAt: string   // ISO date string
    updatedAt: string

    // The root editor (top-level canvas the user works on)
    rootEditor: Editor

    // All components in this project's library
    components: Component[]

    // Custom fonts imported by the user
    customFonts: CustomFont[]
}

interface CustomFont {
    id: ID
    name: string
    src: string    // data URL of the font file
    format: 'ttf' | 'otf' | 'woff' | 'woff2'
}


// ============================================================
// EXPORT CONFIG — metadata for export, not part of core model
// ============================================================

type ExportFormat = 'png' | 'jpg' | 'svg'
type ExportScale = 1 | 2 | 3

interface ExportConfig {
    editorId: ID        // which editor to export
    format: ExportFormat
    scale: ExportScale  // only applies to png/jpg, ignored for svg
}


// ============================================================
// EDITOR NAVIGATION STATE — runtime only, not persisted
// ============================================================

// This is UI state — tracks where the user currently is
// in the editor hierarchy. Not part of the saved project.
interface EditorNavigationState {
    stack: EditorNavigationEntry[]  // history of editors opened
}

interface EditorNavigationEntry {
    editorId: ID
    label: string  // display name for the breadcrumb, e.g. "Button", "Icon"
}