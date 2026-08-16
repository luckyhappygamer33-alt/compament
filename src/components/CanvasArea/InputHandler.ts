import type { RefObject } from 'react'

import type { Layer, Element, BaseElement } from '../../types/schema'
import { uid } from '../../store/editorStore'
import { type HandleName } from './CanvasTypes'
import { degToRad } from './CanvasHelpers'
import { Renderer } from './Render/Renderer'
import { getBuffer } from './BufferRegistry'
import { SelectTool } from './Tools/SelectTool'
import { RectangleTool } from './Tools/RectangleTool'

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
    private isRectSelecting = false
    private rectSelectStart = { x: 0, y: 0 }
    private rectSelectCurrent = { x: 0, y: 0 }

    private selectTool: SelectTool
    private rectangleTool: RectangleTool

    constructor(
        canvas: HTMLCanvasElement,
        refs: InputRefs,
        actions: InputActions
    ) {
        this.canvas = canvas
        this.refs = refs
        this.actions = actions

        const { zoomRef, panRef, activeLayerIdRef, layersRef, selectedElementIdRef, hoveredHandleRef, rendererRef } = refs
        const { updateElement, setSelectedElement } = actions

        this.selectTool = new SelectTool(canvas, {
            zoomRef, panRef, activeLayerIdRef, layersRef, selectedElementIdRef,
            hoveredHandleRef, rendererRef
        }, {
            updateElement, setSelectedElement
        })

        // this.selectTool = new SelectTool(canvas, refs, actions)

        this.rectangleTool = new RectangleTool(refs, actions)
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
        if (e.button === 0 && this.refs.activeToolRef.current === 'rectselect') this.startRectSelect(e)
    }

    handleMouseMove = (e: MouseEvent) => {
        if (this.isPanning) this.applyPan(e)
        if (this.refs.activeToolRef.current === 'select') this.selectTool.onMouseMove(e)
        if (this.isDrawing) this.applyBrush(e)
        if (this.isRectSelecting) this.updateRectSelect(e)
    }

    handleMouseUp = (e: MouseEvent) => {
        if (e.button === 1) this.isPanning = false
        if (e.button === 0) {
            this.selectTool.onMouseUp()
            if (this.isRectSelecting) this.finishRectSelect()
            this.isDrawing = false
        }
    }

    private spawnEllipseEllement(e: MouseEvent, tool: string) {
        const layerId = this.refs.activeLayerIdRef.current
        if (!layerId) return

        // convert screen coordinates to world coordinates
        const worldX = (e.offsetX - this.refs.panRef.current.x) / this.refs.zoomRef.current
        const worldY = (e.offsetY - this.refs.panRef.current.y) / this.refs.zoomRef.current

        const size = 100
        const base = {
            id: uid(),
            position: { x: worldX - size / 2, y: worldY - size / 2 },
            size: { width: size, height: size },
            rotation: 0,
            style: {
                opacity: 1,
                fill: { type: 'solid' as const, color: { r: 74, g: 144, b: 217, a: 1 } }
            }
        }

        const element = tool === 'rectangle'
            ? { ...base, type: 'rectangle' as const, cornerRadius: 0 }
            : { ...base, type: 'ellipse' as const }

        this.actions.addElement(layerId, element)
    }

    handleMouseClick = (e: MouseEvent) => {
        const tool = this.refs.activeToolRef.current
        if (tool === 'select') { this.selectTool.onClick(e); return }
        if (tool === 'rectangle') { this.rectangleTool.onClick(e); return }
        if (tool === 'ellipse') { this.spawnEllipseEllement(e, tool) }
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

    private startRectSelect(e: MouseEvent) {
        const worldX = (e.offsetX - this.refs.panRef.current.x) / this.refs.zoomRef.current
        const worldY = (e.offsetY - this.refs.panRef.current.y) / this.refs.zoomRef.current
        this.isRectSelecting = true
        this.rectSelectStart = { x: worldX, y: worldY }
        this.rectSelectCurrent = { x: worldX, y: worldY }
    }

    private updateRectSelect(e: MouseEvent) {
        const rect = this.canvas.getBoundingClientRect()
        const worldX = (e.clientX - rect.left - this.refs.panRef.current.x) / this.refs.zoomRef.current
        const worldY = (e.clientY - rect.top - this.refs.panRef.current.y) / this.refs.zoomRef.current

        this.rectSelectCurrent = { x: worldX, y: worldY }

        const x = Math.min(this.rectSelectStart.x, this.rectSelectCurrent.x)
        const y = Math.min(this.rectSelectStart.y, this.rectSelectCurrent.y)
        const width = Math.abs(this.rectSelectCurrent.x - this.rectSelectStart.x)
        const height = Math.abs(this.rectSelectCurrent.y - this.rectSelectStart.y)

        this.refs.rendererRef.current?.setRectSelection(
            width > 1 && height > 1 ? { x, y, width, height } : null
        )
        this.refs.rendererRef.current?.requestFrame()
    }

    private finishRectSelect() {
        this.isRectSelecting = false

        const x = Math.min(this.rectSelectStart.x, this.rectSelectCurrent.x)
        const y = Math.min(this.rectSelectStart.y, this.rectSelectCurrent.y)
        const width = Math.abs(this.rectSelectCurrent.x - this.rectSelectStart.x)
        const height = Math.abs(this.rectSelectCurrent.y - this.rectSelectStart.y)

        this.refs.rendererRef.current?.setRectSelection(null)

        if (width < 1 || height < 1) return

        const selectionRect = { x, y, width, height }
        const layerId = this.refs.activeLayerIdRef.current
        if (!layerId) return

        const activeLayer = this.refs.layersRef.current.find(l => l.id === layerId)
        if (!activeLayer) return

        // reject if selection overlaps any floating element
        const hasOverlap = activeLayer.elements.some(el =>
            this.rectOverlapsElement(selectionRect, el)
        )
        if (hasOverlap) {
            this.refs.rendererRef.current?.requestFrame()
            return
        }

        this.extractPixels(layerId, selectionRect)
    }

    private rectOverlapsElement(
        rect: { x: number, y: number, width: number, height: number },
        element: BaseElement
    ): boolean {
        // compute AABB of the rotated element in world space
        const cx = element.position.x + element.size.width / 2
        const cy = element.position.y + element.size.height / 2
        const hw = element.size.width / 2
        const hh = element.size.height / 2
        const cos = Math.abs(Math.cos(degToRad(element.rotation)))
        const sin = Math.abs(Math.sin(degToRad(element.rotation)))
        const aabbW = hw * cos + hh * sin
        const aabbH = hw * sin + hh * cos

        // AABB vs selection rect intersection
        return !(
            rect.x + rect.width < cx - aabbW ||
            rect.x > cx + aabbW ||
            rect.y + rect.height < cy - aabbH ||
            rect.y > cy + aabbH
        )
    }

    private extractPixels(
        layerId: string,
        rect: { x: number, y: number, width: number, height: number }
    ) {
        const buffer = getBuffer(layerId)
        if (!buffer) return
        const bufCtx = buffer.getContext('2d')
        if (!bufCtx) return

        // read pixels from buffer
        const imageData = bufCtx.getImageData(
            Math.floor(rect.x), Math.floor(rect.y),
            Math.ceil(rect.width), Math.ceil(rect.height)
        )

        // clear that region from the buffer
        bufCtx.clearRect(rect.x, rect.y, rect.width, rect.height)

        // convert to data URL via a temporary canvas
        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = Math.ceil(rect.width)
        tempCanvas.height = Math.ceil(rect.height)
        const tempCtx = tempCanvas.getContext('2d')!
        tempCtx.putImageData(imageData, 0, 0)
        const src = tempCanvas.toDataURL('image/png')

        // create floating image element at exact extraction position
        const element = {
            id: uid(),
            type: 'image' as const,
            src,
            position: { x: rect.x, y: rect.y },
            size: { width: rect.width, height: rect.height },
            rotation: 0,
            style: { opacity: 1 }
        }

        this.actions.addElement(layerId, element)
        this.refs.rendererRef.current?.requestFrame()
    }
}