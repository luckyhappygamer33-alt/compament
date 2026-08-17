import type { RefObject } from 'react'

import type { Layer, Size, Element } from '../../../types/schema'
import type { HandleName } from '../CanvasTypes'
import { degToRad } from '../CanvasHelpers'
import { getBuffer } from '../BufferRegistry'
import { OverlayRenderer } from './OverlayRenderer'
import { SelectionRenderer } from './SelectionRenderer'

import { EllipseTool } from './Tools/EllipseTool'
import { RectangleTool } from './Tools/RectangleTool'
import { RectangleSelectTool } from './Tools/RectangleSelectTool'
import { SelectTool } from './Tools/SelectTool'

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
    private backgroundCompositeBelow: OffscreenCanvas | null = null
    private backgroundCompositeAbove: OffscreenCanvas | null = null

    // --- Precise invalidation tracking (replaces backgroundCompositeValid flag) ---
    // Zustand uses immutable updates, so unchanged layer objects keep the same reference.
    // During drag, only the active layer object changes — non-active refs stay identical.
    // This lets us skip the expensive rebuild on every drag frame.
    private lastActiveLayerId: string | null = null
    private lastArtboardSize: Size | null = null
    private lastNonActiveLayerRefsBelow: Layer[] = []
    private lastNonActiveLayerRefsAbove: Layer[] = []

    private imageCache = new Map<string, HTMLImageElement>()

    private overlayRenderer: OverlayRenderer
    private selectionRenderer = new SelectionRenderer()

    private rectangleSelectTool: RectangleSelectTool
    private selectTool: SelectTool
    private ellipseTool = new EllipseTool()
    private rectangleTool = new RectangleTool()

    constructor(
        canvas: HTMLCanvasElement,
        overlayCanvas: HTMLCanvasElement,
        refs: RendererRefs
    ) {
        this.canvas = canvas
        this.refs = refs
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas 2D context (HTML canvas) not available')
        this.ctx = ctx

        this.overlayRenderer = new OverlayRenderer(overlayCanvas)
        this.rectangleSelectTool = new RectangleSelectTool(this.selectionRenderer)
        this.selectTool = new SelectTool(refs, this.selectionRenderer)

        window.__renderer = this
    }

    resizeOverlay(width: number, height: number) {
        this.overlayRenderer.resize(width, height)
    }

    private drawElement(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, element: Element) {

        ctx.globalAlpha = element.style.opacity

        if (element.style.fill?.type === 'solid') {
            const { r, g, b, a } = element.style.fill.color
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`
        } else {
            ctx.fillStyle = 'transparent'
        }

        const cx = element.position.x + element.size.width / 2
        const cy = element.position.y + element.size.height / 2

        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(degToRad(element.rotation))
        ctx.translate(-cx, -cy)

        if (element.type === 'rectangle') {
            this.rectangleTool.draw(ctx, element)
        } else if (element.type === 'ellipse') {
            this.ellipseTool.draw(ctx, element)
        }
        else if (element.type === 'image') {
            const img = this.getOrLoadImage(element.src)
            if (img) {
                ctx.drawImage(img, element.position.x, element.position.y, element.size.width, element.size.height)
            }
        }

        ctx.restore()
        ctx.globalAlpha = 1
    }

    private drawLayerElements(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        layer: Layer,
    ) {
        const buffer = getBuffer(layer.id)
        if (buffer) ctx.drawImage(buffer, 0, 0)
        for (const element of layer.elements) {
            this.drawElement(ctx, element)
        }
    }

    private needsBackgroundRebuild(
        layers: Layer[],
        activeLayerId: string | null,
        artboardSize: Size
    ): boolean {
        if (this.lastActiveLayerId !== activeLayerId) return true

        if (
            !this.lastArtboardSize ||
            this.lastArtboardSize.width !== artboardSize.width ||
            this.lastArtboardSize.height !== artboardSize.height
        ) return true

        const activeIndex = layers.findIndex(l => l.id === activeLayerId)
        const below = layers.slice(activeIndex + 1)  // higher index = lower in stack
        const above = layers.slice(0, activeIndex)   // lower index = higher in stack

        if (below.length !== this.lastNonActiveLayerRefsBelow.length) return true
        if (above.length !== this.lastNonActiveLayerRefsAbove.length) return true
        if (below.some((l, i) => l !== this.lastNonActiveLayerRefsBelow[i])) return true
        if (above.some((l, i) => l !== this.lastNonActiveLayerRefsAbove[i])) return true

        return false
    }

    private rebuildBackgroundComposite(
        layers: Layer[],
        activeLayerId: string | null,
        artboardSize: Size
    ) {
        const needsNew = (c: OffscreenCanvas | null) =>
            !c || c.width !== artboardSize.width || c.height !== artboardSize.height

        if (needsNew(this.backgroundCompositeBelow)) this.backgroundCompositeBelow = new OffscreenCanvas(artboardSize.width, artboardSize.height)
        if (needsNew(this.backgroundCompositeAbove)) this.backgroundCompositeAbove = new OffscreenCanvas(artboardSize.width, artboardSize.height)

        const ctxBelow = this.backgroundCompositeBelow!.getContext('2d')!
        const ctxAbove = this.backgroundCompositeAbove!.getContext('2d')!
        ctxBelow.clearRect(0, 0, artboardSize.width, artboardSize.height)
        ctxAbove.clearRect(0, 0, artboardSize.width, artboardSize.height)

        const activeIndex = layers.findIndex(l => l.id === activeLayerId)

        // Iterate in reverse (bottom layer first) without allocating a reversed copy.
        for (let i = layers.length - 1; i >= 0; i--) {
            const layer = layers[i]
            if (!layer.visible || layer.id === activeLayerId) continue
            // below active = higher index than activeIndex
            const target = i > activeIndex ? ctxBelow : ctxAbove
            this.drawLayerElements(target, layer)
        }

        this.lastActiveLayerId = activeLayerId
        this.lastArtboardSize = artboardSize
        this.lastNonActiveLayerRefsBelow = layers.slice(activeIndex + 1)
        this.lastNonActiveLayerRefsAbove = layers.slice(0, activeIndex)
    }

    private drawSelections(
        ctx: CanvasRenderingContext2D,
        layers: Layer[],
        zoom: number
    ) {
        this.selectTool.draw(ctx, layers, zoom)
        this.rectangleSelectTool.draw(ctx, zoom)
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

        // Only rebuild composite when something in the background actually changed.
        if (this.needsBackgroundRebuild(layers, activeLayerId, artboardSize)) {
            this.rebuildBackgroundComposite(layers, activeLayerId, artboardSize)
        }

        // 1. layers below active
        if (this.backgroundCompositeBelow) ctx.drawImage(this.backgroundCompositeBelow, 0, 0)

        // 2. Active layer — always fresh so in-progress edits are visible immediately
        const activeLayer = layers.find(l => l.id === activeLayerId)
        if (activeLayer && activeLayer.visible) {
            this.drawLayerElements(ctx, activeLayer)
        }

        // 3. layers above active
        if (this.backgroundCompositeAbove) ctx.drawImage(this.backgroundCompositeAbove, 0, 0)

        this.drawSelections(ctx, layers, zoom)

        ctx.restore()
    }

    requestFrame() {
        if (this.rafId !== null) return  // already scheduled
        this.rafId = requestAnimationFrame(() => {
            this.rafId = null
            this.drawFrame()
        })
    }

    bakeElement(layerId: string, element: Element): void {
        const buffer = getBuffer(layerId)
        if (!buffer) return
        const bufCtx = buffer.getContext('2d')
        if (!bufCtx) return
        this.drawElement(bufCtx, element)
    }

    setRectSelection(selection: { x: number, y: number, width: number, height: number } | null) {
        this.rectangleSelectTool.setSelection(selection)
    }

    private getOrLoadImage(src: string): HTMLImageElement | null {
        if (this.imageCache.has(src)) return this.imageCache.get(src)!

        const img = new Image()
        img.onload = () => {
            this.imageCache.set(src, img)
            this.requestFrame()  // redraw once loaded
        }
        img.src = src
        return null  // not ready yet — will redraw on load
    }
}