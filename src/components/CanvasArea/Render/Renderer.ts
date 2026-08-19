import { type RefObject } from 'react'

import type { Layer, Size, Element } from '../../../types/schema'
import type { HandleName, CanvasContext } from '../CanvasTypes'
import { OverlayRenderer } from './OverlayRenderer'
import { SelectionRenderer } from './SelectionRenderer'

import { CompositeManager } from './CompositeManager'

import { RectangleSelectTool } from './Tools/RectangleSelectTool'
import type { ElementTool } from '../Tools/ElementTool'
import type { InteractionTool } from '../Tools/InteractionTool'

import { getBuffer } from '../BufferRegistry'

declare global {
    interface Window {
        __renderer: Renderer
    }
}

interface RendererRefs {
    panRef: RefObject<{ x: number; y: number }>
    zoomRef: RefObject<number>
    artboardSizeRef: RefObject<Size | null>
    layersRef: RefObject<Layer[]>
    selectedElementIdRef: RefObject<string | null>
    hoveredHandleRef: RefObject<HandleName | null>
    activeLayerIdRef: RefObject<string | null>
}

export class Renderer {
    private canvas: HTMLCanvasElement
    private refs: RendererRefs
    private ctx: CanvasRenderingContext2D
    private rafId: number | null = null

    private composite = new CompositeManager()

    private overlayRenderer: OverlayRenderer
    private selectionRenderer = new SelectionRenderer()

    private elementTool: ElementTool
    private interactionTool: InteractionTool

    private rectangleSelectTool: RectangleSelectTool

    constructor(
        canvas: HTMLCanvasElement,
        overlayCanvas: HTMLCanvasElement,
        refs: RendererRefs,
        elementTool: ElementTool,
        interactionTool: InteractionTool
    ) {
        this.canvas = canvas
        this.refs = refs
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas 2D context (HTML canvas) not available')
        this.ctx = ctx

        this.overlayRenderer = new OverlayRenderer(overlayCanvas)

        this.elementTool = elementTool
        this.interactionTool = interactionTool

        this.rectangleSelectTool = new RectangleSelectTool(this.selectionRenderer)

        window.__renderer = this
    }

    resizeOverlay(width: number, height: number) {
        this.overlayRenderer.resize(width, height)
    }

    private drawSelections(
        ctx: CanvasRenderingContext2D,
        layers: Layer[],
        zoom: number,
        selectionRenderer: SelectionRenderer
    ) {
        this.interactionTool.draw(ctx, layers, zoom, selectionRenderer)
        this.rectangleSelectTool.draw(ctx, zoom)
    }

    private drawElement(
        ctx: CanvasContext,
        element: Element
    ) {
        this.elementTool.draw(ctx, element)
    }

    private drawLayer = (
        ctx: CanvasContext,
        layer: Layer
    ) => {
        const buffer = getBuffer(layer.id)

        if (buffer) {
            ctx.drawImage(buffer, 0, 0)
        }

        for (const element of layer.elements) {
            this.drawElement(ctx, element)
        }
    }

    private drawCanvas(
        ctx: CanvasRenderingContext2D,
        layers: Layer[],
        activeLayerId: string | null,
        artboardSize: Size,
        zoom: number,
        selectionRenderer: SelectionRenderer
    ) {
        const below = this.composite.getBelow()
        const above = this.composite.getAbove()
        const activeLayer = layers.find(l => l.id === activeLayerId)

        // Only rebuild composite when something in the background actually changed.
        if (this.composite.needsRebuild(layers, activeLayerId, artboardSize)) {
            this.composite.rebuild(layers, activeLayerId, artboardSize, this.drawLayer)
        }

        // 1. layers below active
        if (below) ctx.drawImage(below, 0, 0)

        // 2. Active layer — always fresh so in-progress edits are visible immediately
        if (activeLayer?.visible) this.drawLayer(ctx, activeLayer)

        // 3. layers above active
        if (above) ctx.drawImage(above, 0, 0)

        this.drawSelections(ctx, layers, zoom, selectionRenderer)
    }

    drawFrame() {
        this.overlayRenderer.recordFrame()

        const { panRef, zoomRef, artboardSizeRef, layersRef, activeLayerIdRef } = this.refs
        const artboardSize = artboardSizeRef.current
        if (!artboardSize) return

        const layers = layersRef.current
        const activeLayerId = activeLayerIdRef.current
        const zoom = zoomRef.current
        const ctx = this.ctx

        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
        ctx.resetTransform()

        ctx.save()
        ctx.translate(panRef.current.x, panRef.current.y)
        ctx.scale(zoom, zoom)

        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)'
        ctx.shadowBlur = 20 / zoom

        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, artboardSize.width, artboardSize.height)

        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0

        this.drawCanvas(ctx, layers, activeLayerId, artboardSize, zoom, this.selectionRenderer)

        ctx.restore()
    }

    requestFrame() {
        if (this.rafId !== null) return  // already scheduled
        this.rafId = requestAnimationFrame(() => {
            this.rafId = null
            this.drawFrame()
        })
    }

    bakeElement(
        layerId: string,
        element: Element
    ): void {
        const buffer = getBuffer(layerId)

        if (!buffer) return

        const ctx = buffer.getContext('2d')

        if (!ctx) return

        this.drawElement(ctx, element)
    }

    setRectSelection(selection: {
        x: number,
        y: number,
        width: number,
        height: number
    } | null) {
        this.rectangleSelectTool.setSelection(selection)
    }
}