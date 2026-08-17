import type { RefObject } from 'react'

import type { Layer, Element } from '../../types/schema'
import { type HandleName } from './CanvasTypes'
import { Renderer } from './Render/Renderer'
import { SelectTool } from './Tools/SelectTool'
import { RectangleTool } from './Tools/RectangleTool'
import { EllipseTool } from './Tools/EllipseTool'
import { RectangleSelectTool } from './Tools/RectangleSelectTool'
import { BrushTool } from './Tools/BrushTool'

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
    private lastMousePos = { x: 0, y: 0 }

    private selectTool: SelectTool
    private rectangleTool: RectangleTool
    private ellipseTool: EllipseTool
    private rectangleSelectTool: RectangleSelectTool
    private brushTool: BrushTool

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
        this.brushTool = new BrushTool(canvas, refs)
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
        if (e.button === 0 && this.refs.activeToolRef.current === 'brush') this.brushTool.onMouseDown(e)
        if (e.button === 0 && this.refs.activeToolRef.current === 'rectangleSelect') this.rectangleSelectTool.onMouseDown(e)
    }

    handleMouseMove = (e: MouseEvent) => {
        if (this.isPanning) this.applyPan(e)
        if (this.refs.activeToolRef.current === 'select') this.selectTool.onMouseMove(e)
        if (this.refs.activeToolRef.current === 'rectangleSelect') this.rectangleSelectTool.onMouseMove(e)
        if (this.refs.activeToolRef.current === 'brush') this.brushTool.onMouseMove(e)

    }

    handleMouseUp = (e: MouseEvent) => {
        if (e.button === 1) this.isPanning = false
        if (e.button === 0) {
            this.selectTool.onMouseUp()
            if (this.refs.activeToolRef.current === 'rectangleSelect') {
                this.rectangleSelectTool.onMouseUp()
            }
            if (this.refs.activeToolRef.current === 'brush') {
                this.brushTool.onMouseUp()
            }
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
}