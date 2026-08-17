import type { RefObject } from 'react'
import type { Renderer } from '../../Render/Renderer'
import { getBuffer } from '../../BufferRegistry'

interface BrushToolRefs {
    zoomRef: RefObject<number>
    panRef: RefObject<{ x: number, y: number }>
    activeLayerIdRef: RefObject<string | null>
    rendererRef: RefObject<Renderer | null>
}

export class BrushTool {
    private canvas: HTMLCanvasElement
    private refs: BrushToolRefs

    private isDrawing = false
    private lastBrushPos = { x: 0, y: 0 }

    constructor(
        canvas: HTMLCanvasElement,
        refs: BrushToolRefs
    ) {
        this.canvas = canvas
        this.refs = refs
    }

    onMouseDown(e: MouseEvent) {
        const rect = this.canvas.getBoundingClientRect()
        const worldX = (e.clientX - rect.left - this.refs.panRef.current.x) / this.refs.zoomRef.current
        const worldY = (e.clientY - rect.top - this.refs.panRef.current.y) / this.refs.zoomRef.current

        this.isDrawing = true
        this.lastBrushPos = {
            x: worldX,
            y: worldY
        }
    }

    onMouseMove(e: MouseEvent) {
        if (!this.isDrawing) return

        const layerId = this.refs.activeLayerIdRef.current
        if (!layerId) return

        const buffer = getBuffer(layerId)
        if (!buffer) return

        const bufCtx = buffer.getContext('2d')
        if (!bufCtx) return

        const rect = this.canvas.getBoundingClientRect()

        const worldX = (e.clientX - rect.left - this.refs.panRef.current.x) / this.refs.zoomRef.current
        const worldY = (e.clientY - rect.top - this.refs.panRef.current.y) / this.refs.zoomRef.current

        bufCtx.strokeStyle = '#000000'
        bufCtx.lineWidth = 8
        bufCtx.lineCap = 'round'
        bufCtx.lineJoin = 'round'

        bufCtx.beginPath()
        bufCtx.moveTo(
            this.lastBrushPos.x,
            this.lastBrushPos.y
        )

        bufCtx.lineTo(worldX, worldY)
        bufCtx.stroke()

        this.lastBrushPos = {
            x: worldX,
            y: worldY
        }

        this.refs.rendererRef.current?.requestFrame()
    }

    onMouseUp() {
        this.isDrawing = false
    }
}