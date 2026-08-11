import type { RefObject } from 'react'

import type { Layer, Element } from '../../types/schema'
import { uid } from '../../store/editorStore'
import { type HandleName, HANDLE_CURSORS } from './CanvasTypes'
import { toLocalSpace, getHandlePositions, getRotateHandlePosition, hitTest, rotatePoint, computeResize, normalizeDegrees } from './CanvasHelpers'
import { CanvasRenderer } from './CanvasRenderer'
import { getBuffer } from './BufferRegistry'

interface InputRefs {
    zoomRef: RefObject<number>
    panRef: RefObject<{ x: number; y: number }>
    layersRef: RefObject<Layer[]>
    selectedElementIdRef: RefObject<string | null>
    activeToolRef: RefObject<string>
    activeLayerIdRef: RefObject<string | null>
    rendererRef: RefObject<CanvasRenderer | null>
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
    private isDragging = false
    private isResizing = false
    private isRotating = false
    private isDrawing = false
    private didDrag = false
    private hoveredHandle: HandleName | null = null
    private activeHandle: HandleName | null = null
    private lastMousePos = { x: 0, y: 0 }
    private dragStartMouse = { x: 0, y: 0 }
    private dragStartPos = { x: 0, y: 0 }
    private resizeStartMouse = { x: 0, y: 0 }
    private resizeStartBounds = { x: 0, y: 0, width: 0, height: 0 }
    private lastBrushPos = { x: 0, y: 0 }
    private rotateStartAngle = 0
    private rotateStartElementAngle = 0

    constructor(
        canvas: HTMLCanvasElement,
        refs: InputRefs,
        actions: InputActions
    ) {
        this.canvas = canvas
        this.refs = refs
        this.actions = actions
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
        if (e.button === 0 && this.refs.activeToolRef.current === 'select') this.HandleMouseDownStartSelecting(e)
        if (e.button === 0 && this.refs.activeToolRef.current === 'brush') this.startBrush(e)
    }


    handleMouseMove = (e: MouseEvent) => {

        this.detectHandleHover(e, this.canvas)
        if (this.isPanning) this.applyPan(e)
        if (this.isDragging) this.applyDrag(e, this.canvas)
        if (this.isResizing) this.applyResize(e, this.canvas)
        if (this.isRotating) this.applyRotate(e, this.canvas)
        if (this.isDrawing) this.applyBrush(e)
    }


    handleMouseUp = (e: MouseEvent) => {
        if (e.button === 1) this.isPanning = false
        if (e.button === 0) {
            this.isDragging = false
            this.isResizing = false
            this.isRotating = false
            this.isDrawing = false
            this.activeHandle = null
        }
    }

    private handleSelectClick(e: MouseEvent) {
        const worldX = (e.offsetX - this.refs.panRef.current.x) / this.refs.zoomRef.current
        const worldY = (e.offsetY - this.refs.panRef.current.y) / this.refs.zoomRef.current

        // collect all hits across all visible unlocked layers
        const hits: string[] = []
        for (const layer of this.refs.layersRef.current) {
            if (!layer.visible || layer.locked) continue
            for (let i = layer.elements.length - 1; i >= 0; i--) {
                if (hitTest(layer.elements[i], worldX, worldY)) {
                    hits.push(layer.elements[i].id)
                }
            }
        }

        if (hits.length === 0) {
            this.actions.setSelectedElement(null)
            return
        }

        if (hits.length === 1) {
            this.actions.setSelectedElement(hits[0])
            return
        }

        // multiple hits — cycle from current selection
        const currentIndex = hits.indexOf(this.refs.selectedElementIdRef.current ?? '')
        const nextIndex = (currentIndex + 1) % hits.length
        this.actions.setSelectedElement(hits[nextIndex])
        return
    }

    private spawnElement(e: MouseEvent, tool: string) {
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
        if (this.didDrag) { //to prevent instant selection other object when moving over another one
            this.didDrag = false
            return
        }

        const tool = this.refs.activeToolRef.current
        if (tool === 'select') {
            this.handleSelectClick(e)
        }

        if (tool === 'rectangle' || tool === 'ellipse')
            this.spawnElement(e, tool)
    }


    private HandleMouseDownStartPan(e: MouseEvent) {
        e.preventDefault()
        this.isPanning = true
        this.lastMousePos = { x: e.clientX, y: e.clientY }
    }

    private HandleMouseDownStartSelecting(e: MouseEvent) {
        this.didDrag = false
        const worldX = (e.offsetX - this.refs.panRef.current.x) / this.refs.zoomRef.current
        const worldY = (e.offsetY - this.refs.panRef.current.y) / this.refs.zoomRef.current

        const selected = this.refs.selectedElementIdRef.current
        if (!selected) return

        if (selected) {
            const hitSize = 10 / this.refs.zoomRef.current
            for (const layer of this.refs.layersRef.current) {
                if (layer.locked) continue
                const element = layer.elements.find(el => el.id === selected)
                if (element) {
                    const local = toLocalSpace(worldX, worldY, element)
                    // check rotate handle first
                    const rotHandle = getRotateHandlePosition(element, 10, this.refs.zoomRef.current)
                    const rotHitSize = 12 / this.refs.zoomRef.current
                    if (
                        local.x >= rotHandle.x - rotHitSize / 2 &&
                        local.x <= rotHandle.x + rotHitSize / 2 &&
                        local.y >= rotHandle.y - rotHitSize / 2 &&
                        local.y <= rotHandle.y + rotHitSize / 2
                    ) {
                        this.isRotating = true
                        const cx = element.position.x + element.size.width / 2
                        const cy = element.position.y + element.size.height / 2
                        this.rotateStartAngle =
                            Math.atan2(
                                worldY - cy,
                                worldX - cx
                            ) * 180 / Math.PI
                        this.rotateStartElementAngle = element.rotation
                        return
                    }
                    const handles = getHandlePositions(element, 10)
                    for (const handle of handles) {
                        if (
                            local.x >= handle.x - hitSize / 2 &&
                            local.x <= handle.x + hitSize / 2 &&
                            local.y >= handle.y - hitSize / 2 &&
                            local.y <= handle.y + hitSize / 2
                        ) {
                            this.isResizing = true
                            this.activeHandle = handle.name
                            this.resizeStartMouse = { x: worldX, y: worldY }
                            this.resizeStartBounds = {
                                x: element.position.x,
                                y: element.position.y,
                                width: element.size.width,
                                height: element.size.height,
                            }
                            return
                        }
                    }
                }
            }
        }

        // find the element
        for (const layer of this.refs.layersRef.current) {
            if (layer.locked) continue
            const element = layer.elements.find(e => e.id === selected)
            if (element && hitTest(element, worldX, worldY)) {
                this.isDragging = true
                this.dragStartMouse = { x: worldX, y: worldY }
                this.dragStartPos = { ...element.position }
                break
            }
        }
    }

    private applyPan(e: MouseEvent) {
        const dx = e.clientX - this.lastMousePos.x
        const dy = e.clientY - this.lastMousePos.y
        this.lastMousePos = { x: e.clientX, y: e.clientY }
        this.actions.setPan(p => ({ x: p.x + dx, y: p.y + dy }))
    }

    private applyDrag(e: MouseEvent, canvas: HTMLCanvasElement) {
        this.didDrag = true
        const rect = canvas.getBoundingClientRect()
        const worldX = (e.clientX - rect.left - this.refs.panRef.current.x) / this.refs.zoomRef.current
        const worldY = (e.clientY - rect.top - this.refs.panRef.current.y) / this.refs.zoomRef.current
        const dx = worldX - this.dragStartMouse.x
        const dy = worldY - this.dragStartMouse.y
        const selected = this.refs.selectedElementIdRef.current
        if (!selected) return

        for (const layer of this.refs.layersRef.current) {
            const element = layer.elements.find(el => el.id === selected)
            if (element) {
                this.actions.updateElement(layer.id, selected, {
                    position: { x: this.dragStartPos.x + dx, y: this.dragStartPos.y + dy }
                })
                break
            }
        }
    }

    private applyResize(e: MouseEvent, canvas: HTMLCanvasElement) {
        this.didDrag = true
        const rect = canvas.getBoundingClientRect()
        const worldX = (e.clientX - rect.left - this.refs.panRef.current.x) / this.refs.zoomRef.current
        const worldY = (e.clientY - rect.top - this.refs.panRef.current.y) / this.refs.zoomRef.current
        const dx = worldX - this.resizeStartMouse.x
        const dy = worldY - this.resizeStartMouse.y
        const selected = this.refs.selectedElementIdRef.current
        if (!selected) return

        for (const layer of this.refs.layersRef.current) {
            const element = layer.elements.find(el => el.id === selected)
            if (element) {
                const local = rotatePoint(dx, dy, element.rotation)
                const result = computeResize(this.activeHandle!, this.resizeStartBounds, local, element.rotation, e.altKey)
                this.actions.updateElement(layer.id, selected, {
                    position: { x: result.x, y: result.y },
                    size: { width: result.width, height: result.height }
                })
                break
            }
        }
    }

    private applyRotate(e: MouseEvent, canvas: HTMLCanvasElement) {
        this.didDrag = true
        const rect = canvas.getBoundingClientRect()
        const worldX = (e.clientX - rect.left - this.refs.panRef.current.x) / this.refs.zoomRef.current
        const worldY = (e.clientY - rect.top - this.refs.panRef.current.y) / this.refs.zoomRef.current
        const selected = this.refs.selectedElementIdRef.current
        if (!selected) return

        for (const layer of this.refs.layersRef.current) {
            const element = layer.elements.find(el => el.id === selected)
            if (element) {
                const cx = element.position.x + element.size.width / 2
                const cy = element.position.y + element.size.height / 2
                const delta = (Math.atan2(worldY - cy, worldX - cx) * 180 / Math.PI) - this.rotateStartAngle
                this.actions.updateElement(layer.id, selected, {
                    rotation: normalizeDegrees(this.rotateStartElementAngle + delta)
                })
                break
            }
        }
    }


    private detectHandleHover(e: MouseEvent, canvas: HTMLCanvasElement) {
        const selected = this.refs.selectedElementIdRef.current
        if (!selected || this.refs.activeToolRef.current !== 'select' || this.isDragging) return

        const worldX = (e.offsetX - this.refs.panRef.current.x) / this.refs.zoomRef.current
        const worldY = (e.offsetY - this.refs.panRef.current.y) / this.refs.zoomRef.current
        const hitSize = 10 / this.refs.zoomRef.current
        let found: HandleName | null = null

        for (const layer of this.refs.layersRef.current) {
            const element = layer.elements.find(el => el.id === selected)
            if (!element) continue

            const local = toLocalSpace(worldX, worldY, element)
            const handles = getHandlePositions(element, 10)

            for (const handle of handles) {
                if (
                    local.x >= handle.x - hitSize / 2 &&
                    local.x <= handle.x + hitSize / 2 &&
                    local.y >= handle.y - hitSize / 2 &&
                    local.y <= handle.y + hitSize / 2
                ) { found = handle.name; break }
            }

            const rotHandle = getRotateHandlePosition(element, 10, this.refs.zoomRef.current)
            const rotHitSize = 12 / this.refs.zoomRef.current
            if (
                local.x >= rotHandle.x - rotHitSize / 2 &&
                local.x <= rotHandle.x + rotHitSize / 2 &&
                local.y >= rotHandle.y - rotHitSize / 2 &&
                local.y <= rotHandle.y + rotHitSize / 2
            ) found = 'rotate'

            break
        }

        if (found !== this.hoveredHandle) {
            this.hoveredHandle = found
            canvas.style.cursor = found ? HANDLE_CURSORS[found] : 'default'
            this.refs.rendererRef.current?.requestFrame()
        }
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

        // trigger redraw — buffer changed, renderer needs to composite again
        this.refs.rendererRef.current?.requestFrame()
    }
}