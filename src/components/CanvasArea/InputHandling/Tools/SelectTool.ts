import type { RefObject } from 'react'
import type { Layer, Element } from '../../../../types/schema'
import type { HandleName } from '../../CanvasTypes'
import type { Renderer } from '../../Render/Renderer'
import { HANDLE_CURSORS } from '../../CanvasTypes'
import {
    toLocalSpace, getHandlePositions, getRotateHandlePosition, hitTest,
    rotatePoint, computeResize, normalizeDegrees
} from '../../CanvasHelpers'

interface SelectToolRefs {
    zoomRef: RefObject<number>
    panRef: RefObject<{ x: number, y: number }>
    activeLayerIdRef: RefObject<string | null>
    layersRef: RefObject<Layer[]>
    selectedElementIdRef: RefObject<string | null>
    hoveredHandleRef: RefObject<HandleName | null>
    rendererRef: RefObject<Renderer | null>
}

interface SelectToolActions {
    updateElement: (layerId: string, elementId: string, patch: Partial<Element>) => void
    setSelectedElement: (id: string | null) => void
}

export class SelectTool {
    private canvas: HTMLCanvasElement
    private refs: SelectToolRefs
    private actions: SelectToolActions

    private isDragging = false
    private isResizing = false
    private isRotating = false
    private didDrag = false
    private activeHandle: HandleName | null = null
    private hoveredHandle: HandleName | null = null

    private dragStartMouse = { x: 0, y: 0 }
    private dragStartPos = { x: 0, y: 0 }
    private resizeStartMouse = { x: 0, y: 0 }
    private resizeStartBounds = { x: 0, y: 0, width: 0, height: 0 }
    private rotateStartAngle = 0
    private rotateStartElementAngle = 0

    constructor(
        canvas: HTMLCanvasElement,
        refs: SelectToolRefs,
        actions: SelectToolActions
    ) {
        this.canvas = canvas
        this.refs = refs
        this.actions = actions
    }

    onMouseDown(e: MouseEvent) {
        this.didDrag = false
        const worldX = (e.offsetX - this.refs.panRef.current.x) / this.refs.zoomRef.current
        const worldY = (e.offsetY - this.refs.panRef.current.y) / this.refs.zoomRef.current

        const selected = this.refs.selectedElementIdRef.current
        if (!selected) return

        const hitSize = 10 / this.refs.zoomRef.current

        for (const layer of this.refs.layersRef.current) {
            if (layer.locked) continue
            const element = layer.elements.find(el => el.id === selected)
            if (!element) continue

            const local = toLocalSpace(worldX, worldY, element)

            //check rotate handle
            const rotateHandle = getRotateHandlePosition(element, 10, this.refs.zoomRef.current)
            const rotateHandleHitSize = 12 / this.refs.zoomRef.current

            if (
                local.x >= rotateHandle.x - rotateHandleHitSize / 2 &&
                local.x <= rotateHandle.x + rotateHandleHitSize / 2 &&
                local.y >= rotateHandle.y - rotateHandleHitSize / 2 &&
                local.y <= rotateHandle.y + rotateHandleHitSize / 2
            ) {
                this.isRotating = true
                const centerX = element.position.x + element.size.width / 2
                const centerY = element.position.y + element.size.height / 2
                this.rotateStartAngle = Math.atan2(worldY - centerY, worldX - centerX) * 180 / Math.PI
                this.rotateStartElementAngle = element.rotation
                return
            }

            //check transform handles
            for (const handle of getHandlePositions(element, 10)) {
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
                        height: element.size.height
                    }
                    return
                }
            }

            //check drag
            if (hitTest(element, worldX, worldY)) {
                this.isDragging = true
                this.dragStartMouse = { x: worldX, y: worldY }
                this.dragStartPos = { ...element.position }
            }

            return
        }
    }

    onMouseMove(e: MouseEvent) {
        this.detectHandleHover(e)
        if (this.isDragging) this.applyDrag(e)
        if (this.isResizing) this.applyResize(e)
        if (this.isRotating) this.applyRotate(e)
    }


    onMouseUp() {
        this.isDragging = false
        this.isResizing = false
        this.isRotating = false
        this.activeHandle = null
    }

    onClick(e: MouseEvent): boolean {
        if (this.didDrag) {
            this.didDrag = false
            return true // consumed — suppress further click handling
        }
        this.handleSelectClick(e)
        return true
    }

    private handleSelectClick(e: MouseEvent) {
        const worldX = (e.offsetX - this.refs.panRef.current.x) / this.refs.zoomRef.current
        const worldY = (e.offsetY - this.refs.panRef.current.y) / this.refs.zoomRef.current

        const hits: string[] = []
        for (const layer of this.refs.layersRef.current) {
            if (!layer.visible || layer.locked) continue
            if (layer.id !== this.refs.activeLayerIdRef.current) continue
            for (let i = layer.elements.length - 1; i >= 0; i--) {
                if (hitTest(layer.elements[i], worldX, worldY)) {
                    hits.push(layer.elements[i].id)
                }
            }
        }

        if (hits.length === 0) { this.actions.setSelectedElement(null); return }
        if (hits.length === 1) { this.actions.setSelectedElement(hits[0]); return }

        const currentIndex = hits.indexOf(this.refs.selectedElementIdRef.current ?? '')
        this.actions.setSelectedElement(hits[(currentIndex + 1) % hits.length])
    }

    private applyDrag(e: MouseEvent) {
        this.didDrag = true
        const rect = this.canvas.getBoundingClientRect()
        const worldX = (e.clientX - rect.left - this.refs.panRef.current.x) / this.refs.zoomRef.current
        const worldY = (e.clientY - rect.top - this.refs.panRef.current.y) / this.refs.zoomRef.current
        const dx = worldX - this.dragStartMouse.x
        const dy = worldY - this.dragStartMouse.y
        const selected = this.refs.selectedElementIdRef.current
        if (!selected) return

        for (const layer of this.refs.layersRef.current) {
            const element = layer.elements.find(el => el.id === selected)
            if (!element) continue

            this.actions.updateElement(layer.id, selected, {
                position: {
                    x: this.dragStartPos.x + dx, y: this.dragStartPos.y + dy

                }
            })
            break
        }

    }

    private applyResize(e: MouseEvent) {
        this.didDrag = true
        const rect = this.canvas.getBoundingClientRect()
        const worldX = (e.clientX - rect.left - this.refs.panRef.current.x) / this.refs.zoomRef.current
        const worldY = (e.clientY - rect.top - this.refs.panRef.current.y) / this.refs.zoomRef.current
        const dx = worldX - this.resizeStartMouse.x
        const dy = worldY - this.resizeStartMouse.y
        const selected = this.refs.selectedElementIdRef.current
        if (!selected) return

        for (const layer of this.refs.layersRef.current) {
            const element = layer.elements.find(el => el.id === selected)
            if (!element) continue
            const local = rotatePoint(dx, dy, element.rotation)
            const result = computeResize(this.activeHandle!, this.resizeStartBounds, local, element.rotation, e.altKey)
            this.actions.updateElement(layer.id, selected, {
                position: { x: result.x, y: result.y },
                size: { width: result.width, height: result.height }
            })
            break
        }
    }

    private applyRotate(e: MouseEvent) {
        this.didDrag = true
        const rect = this.canvas.getBoundingClientRect()
        const worldX = (e.clientX - rect.left - this.refs.panRef.current.x) / this.refs.zoomRef.current
        const worldY = (e.clientY - rect.top - this.refs.panRef.current.y) / this.refs.zoomRef.current
        const selected = this.refs.selectedElementIdRef.current
        if (!selected) return

        for (const layer of this.refs.layersRef.current) {
            const element = layer.elements.find(el => el.id === selected)
            if (!element) continue
            const centerX = element.position.x + element.size.width / 2
            const centerY = element.position.y + element.size.height / 2
            const delta = (Math.atan2(worldY - centerY, worldX - centerX) * 180 / Math.PI) - this.rotateStartAngle
            this.actions.updateElement(layer.id, selected, {
                rotation: normalizeDegrees(this.rotateStartElementAngle + delta)
            })
            break
        }
    }

    private detectHandleHover(e: MouseEvent) {
        const selected = this.refs.selectedElementIdRef.current
        if (!selected || this.isDragging) return

        const worldX = (e.offsetX - this.refs.panRef.current.x) / this.refs.zoomRef.current
        const worldY = (e.offsetY - this.refs.panRef.current.y) / this.refs.zoomRef.current
        const handleHitSize = 10 / this.refs.zoomRef.current
        let found: HandleName | null = null

        for (const layer of this.refs.layersRef.current) {
            const element = layer.elements.find(el => el.id === selected)
            if (!element) continue

            const local = toLocalSpace(worldX, worldY, element)

            for (const handle of getHandlePositions(element, 10)) {
                if (
                    local.x >= handle.x - handleHitSize / 2 &&
                    local.x <= handle.x + handleHitSize / 2 &&
                    local.y >= handle.y - handleHitSize / 2 &&
                    local.y <= handle.y + handleHitSize / 2
                ) {
                    found = handle.name; break
                }
            }

            const rotateHandle = getRotateHandlePosition(element, 10, this.refs.zoomRef.current)
            const rotateHandleHitSize = 12 / this.refs.zoomRef.current
            if (
                local.x >= rotateHandle.x - rotateHandleHitSize / 2 &&
                local.x <= rotateHandle.x + rotateHandleHitSize / 2 &&
                local.y >= rotateHandle.y - rotateHandleHitSize / 2 &&
                local.y <= rotateHandle.y + rotateHandleHitSize / 2
            ) {
                found = 'rotate'
            }

            break
        }

        if (found !== this.hoveredHandle) {
            this.hoveredHandle = found
            this.refs.hoveredHandleRef.current = found
            this.canvas.style.cursor = found ? HANDLE_CURSORS[found] : 'default'
            this.refs.rendererRef.current?.requestFrame()
        }
    }
}