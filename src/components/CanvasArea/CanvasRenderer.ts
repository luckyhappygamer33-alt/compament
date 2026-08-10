import type { RefObject } from 'react'

import type { Layer, Size, BaseElement } from '../../types/schema'
import type { HandleName, Handle } from './CanvasTypes'
import { degToRad, getHandlePositions, getRotateHandlePosition } from './CanvasHelpers'

interface RendererRefs {
    panRef: RefObject<{ x: number; y: number }>
    zoomRef: RefObject<number>
    artboardSizeRef: RefObject<Size | null>
    layersRef: RefObject<Layer[]>
    selectedElementIdRef: RefObject<string | null>
    hoveredHandleRef: RefObject<HandleName | null>
}

export class CanvasRenderer {
    private canvas: HTMLCanvasElement
    private refs: RendererRefs
    private ctx: CanvasRenderingContext2D

    constructor(
        canvas: HTMLCanvasElement,
        refs: RendererRefs
    ) {
        this.canvas = canvas
        this.refs = refs
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas 2D context not available')
        this.ctx = ctx
    }

    private drawElements(
        ctx: CanvasRenderingContext2D,
        layers: Layer[],
    ) {
        for (const layer of [...layers].reverse()) {
            if (!layer.visible) continue
            for (const element of layer.elements) {
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
                    ctx.beginPath()
                    ctx.roundRect(element.position.x, element.position.y, element.size.width, element.size.height, element.cornerRadius)
                    ctx.fill()
                } else if (element.type === 'ellipse') {
                    ctx.beginPath()
                    ctx.ellipse(element.position.x + element.size.width / 2, element.position.y + element.size.height / 2, element.size.width / 2, element.size.height / 2, 0, 0, Math.PI * 2)
                    ctx.fill()
                }

                ctx.restore()
                ctx.globalAlpha = 1
            }
        }
    }

    private drawOutline(
        ctx: CanvasRenderingContext2D,
        element: BaseElement,
        padding: number,
        zoom: number
    ) {
        ctx.strokeStyle = '#7bb4f1'
        ctx.lineWidth = 2 / zoom
        ctx.strokeRect(
            element.position.x - padding,
            element.position.y - padding,
            element.size.width + padding * 2,
            element.size.height + padding * 2
        )
    }

    private drawHandles(
        ctx: CanvasRenderingContext2D,
        element: BaseElement,
        padding: number,
        zoom: number,
        hoveredHandle: HandleName | null
    ) {
        const handles = getHandlePositions(element, padding)
        const handleSize = 8 / zoom

        for (const handle of handles) {
            const isHovered = hoveredHandle === handle.name
            const hs = isHovered ? handleSize * 1.3 : handleSize
            ctx.fillStyle = isHovered ? '#4a90d9' : '#ffffff'
            ctx.strokeStyle = '#4a90d9'
            ctx.lineWidth = 1.5 / zoom
            ctx.beginPath()
            ctx.rect(handle.x - hs / 2, handle.y - hs / 2, hs, hs)
            ctx.fill()
            ctx.stroke()
        }

        return handles  // return so drawSelectionBox can pass to drawRotateHandle
    }

    drawRotateHandle(
        ctx: CanvasRenderingContext2D,
        element: BaseElement,
        padding: number,
        zoom: number,
        hoveredHandle: HandleName | null,
        nHandle: Handle
    ) {
        const rotHandle = getRotateHandlePosition(element, padding, zoom)
        const isRotHovered = hoveredHandle === 'rotate'
        const rotRadius = isRotHovered ? 6 / zoom : 5 / zoom

        // line from n handle to rotate circle
        ctx.strokeStyle = '#4a90d9'
        ctx.lineWidth = 1.5 / zoom
        ctx.beginPath()
        ctx.moveTo(nHandle.x, nHandle.y)
        ctx.lineTo(rotHandle.x, rotHandle.y)
        ctx.stroke()

        // circle
        ctx.beginPath()
        ctx.arc(rotHandle.x, rotHandle.y, rotRadius, 0, Math.PI * 2)
        ctx.fillStyle = isRotHovered ? '#4a90d9' : '#ffffff'
        ctx.fill()
        ctx.strokeStyle = '#4a90d9'
        ctx.lineWidth = 1.5 / zoom
        ctx.stroke()
    }


    private drawSelectionBox(
        ctx: CanvasRenderingContext2D,
        selectedElementId: string | null,
        layers: Layer[],
        zoom: number,
        hoveredHandle: HandleName | null
    ) {
        if (!selectedElementId) return

        for (const layer of layers) {
            const element = layer.elements.find(e => e.id === selectedElementId)
            if (!element) continue

            const PADDING = 10
            const cx = element.position.x + element.size.width / 2
            const cy = element.position.y + element.size.height / 2

            ctx.save()
            ctx.translate(cx, cy)
            ctx.rotate(degToRad(element.rotation))
            ctx.translate(-cx, -cy)

            this.drawOutline(ctx, element, PADDING, zoom)
            const handles = this.drawHandles(ctx, element, PADDING, zoom, hoveredHandle)
            const nHandle = handles.find(h => h.name === 'n')!
            this.drawRotateHandle(ctx, element, PADDING, zoom, hoveredHandle, nHandle)

            ctx.restore()
            break
        }
    }

    drawFrame() {
        const { panRef, zoomRef, artboardSizeRef, layersRef,
            selectedElementIdRef, hoveredHandleRef } = this.refs
        const artboardSize = artboardSizeRef.current
        if (!artboardSize) return

        const ctx = this.ctx

        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
        ctx.resetTransform()

        ctx.save()
        ctx.translate(panRef.current.x, panRef.current.y)
        ctx.scale(zoomRef.current, zoomRef.current)

        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)'
        ctx.shadowBlur = 20 / zoomRef.current

        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, artboardSize.width, artboardSize.height)

        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0

        this.drawElements(ctx, layersRef.current)
        this.drawSelectionBox(ctx, selectedElementIdRef.current, layersRef.current, zoomRef.current, hoveredHandleRef.current)

        ctx.restore()
    }
}