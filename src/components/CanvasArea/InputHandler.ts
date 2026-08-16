import type { RefObject } from 'react'

import type { Layer, Element } from '../../types/schema'
import { type HandleName } from './CanvasTypes'
import { Renderer } from './Render/Renderer'
import { getBuffer } from './BufferRegistry'
import { SelectTool } from './Tools/SelectTool'
import { RectangleTool } from './Tools/RectangleTool'
import { EllipseTool } from './Tools/EllipseTool'
import { RectangleSelectTool } from './Tools/RectangleSelectTool'

interface InputRefs {
    zoomRef: RefObject<number>
    panRef: RefObject<{ x: number; y: number }>
    layersRef: RefObject<Layer[]>
    selectedElementIdRef: RefObject<string | null>
    activeToolRef: RefObject<string>
    activeLayerIdRef: RefObject<string | null>
    rendererRef: RefObject<Renderer | null>
    hoveredHandleRef: RefObject<HandleName | null>  // shared with renderer so it reads the live value
}

interface InputActions {
    setZoom: (z: number) => void
    setPan: (p: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void
    updateElement: (layerId: string, elementId: string, patch: Partial<Element>) => void
    setSelectedElement: (id: string | null) => void
    addElement: (layerId: string, element: Element) => void
}

export class InputHandler {
    private canvas: HTMLCanvasElement
    private refs: InputRefs
    private actions: InputActions

    private isPanning = false
    private isDrawing = false
    private lastMousePos = { x: 0, y: 0 }
    private lastBrushPos = { x: 0, y: 0 }

    private selectTool: SelectTool
    private rectangleTool: RectangleTool
    private ellipseTool: EllipseTool
    private rectangleSelectTool: RectangleSelectTool

    constructor(
        canvas: HTMLCanvasElement,
        refs: InputRefs,
        actions: InputActions
    ) {
        this.canvas = canvas
        this.refs = refs
        this.actions = actions
        this.selectTool = new SelectTool(canvas, refs, actions)
        this.rectangleTool = new RectangleTool(refs, actions)
        this.ellipseTool = new EllipseTool(refs, actions)
        this.rectangleSelectTool = new RectangleSelectTool(canvas, refs, actions)
    }

    handleWheel = (e: WheelEvent) => {
        e.preventDefault()
        const factor = e.deltaY < 0 ? 1.1 : 0.9
        const currentZoom = this.refs.zoomRef.current
        const currentPan = this.refs.panRef.current
        const newZoom = Math.max(0.05, Math.min(50, currentZoom * factor))
        const mouseX = e.offsetX
        const mouseY = e.offsetY
        const worldX = (mouseX - currentPan.x) / currentZoom
        const worldY = (mouseY - currentPan.y) / currentZoom
        this.actions.setZoom(newZoom)
        this.actions.setPan({ x: mouseX - worldX * newZoom, y: mouseY - worldY * newZoom })
    }

    handleMouseDown = (e: MouseEvent) => {
        if (e.button === 1) this.HandleMouseDownStartPan(e)  // middle mouse button  
        if (e.button === 0 && this.refs.activeToolRef.current === 'select') this.selectTool.onMouseDown(e)
        if (e.button === 0 && this.refs.activeToolRef.current === 'brush') this.startBrush(e)
        if (e.button === 0 && this.refs.activeToolRef.current === 'rectangleSelect') this.rectangleSelectTool.onMouseDown(e)
    }

    handleMouseMove = (e: MouseEvent) => {
        if (this.isPanning) this.applyPan(e)
        if (this.refs.activeToolRef.current === 'select') this.selectTool.onMouseMove(e)
        if (this.refs.activeToolRef.current === 'rectangleSelect') this.rectangleSelectTool.onMouseMove(e)
        if (this.isDrawing) this.applyBrush(e)

    }

    handleMouseUp = (e: MouseEvent) => {
        if (e.button === 1) this.isPanning = false
        if (e.button === 0) {
            this.selectTool.onMouseUp()
            if (this.refs.activeToolRef.current === 'rectangleSelect') {
                this.rectangleSelectTool.onMouseUp()
            }
            this.isDrawing = false
        }
    }

    handleMouseClick = (e: MouseEvent) => {
        const tool = this.refs.activeToolRef.current
        if (tool === 'select') { this.selectTool.onClick(e); return }
        if (tool === 'rectangle') { this.rectangleTool.onClick(e); return }
        if (tool === 'ellipse') { this.ellipseTool.onClick(e); return }
    }

    private HandleMouseDownStartPan(e: MouseEvent) {
        e.preventDefault()
        this.isPanning = true
        this.lastMousePos = { x: e.clientX, y: e.clientY }
    }

    private applyPan(e: MouseEvent) {
        const dx = e.clientX - this.lastMousePos.x
        const dy = e.clientY - this.lastMousePos.y
        this.lastMousePos = { x: e.clientX, y: e.clientY }
        this.actions.setPan(p => ({ x: p.x + dx, y: p.y + dy }))
    }

    private startBrush(e: MouseEvent) {
        this.isDrawing = true
        const worldX = (e.offsetX - this.refs.panRef.current.x) / this.refs.zoomRef.current
        const worldY = (e.offsetY - this.refs.panRef.current.y) / this.refs.zoomRef.current
        this.lastBrushPos = { x: worldX, y: worldY }
    }

    private applyBrush(e: MouseEvent) {
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
        bufCtx.moveTo(this.lastBrushPos.x, this.lastBrushPos.y)
        bufCtx.lineTo(worldX, worldY)
        bufCtx.stroke()

        this.lastBrushPos = { x: worldX, y: worldY }

        // Brush writes directly into the buffer (bypassing the store), so
        // requestFrame here is the only way to trigger a redraw.
        this.refs.rendererRef.current?.requestFrame()
    }
}