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

type Fill = {
    type: 'solid';
    color: Color
}

// Shared visual properties every element can have
interface ElementStyle {
    fill?: Fill
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

interface ImageElement extends BaseElement {
    type: 'image'
    src: string  // data URL or local file reference
}

export type Element =
    | RectangleElement
    | EllipseElement
    | ImageElement


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