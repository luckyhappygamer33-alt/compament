import type { RefObject } from 'react'

import type { Layer, Element } from '../../../types/schema'
import type { HandleName } from '../CanvasTypes'

import type { Renderer } from '../Render/Renderer'
import { SelectionRenderer } from '../Render/SelectionRenderer'

import {
    toLocalSpace,
    getHandlePositions,
    getRotateHandlePosition,
    hitTest,
    rotatePoint,
    computeResize,
    normalizeDegrees
} from '../CanvasHelpers'

import type { InteractionTool } from "./InteractionTool";

interface SelectToolRefs {
    zoomRef: RefObject<number>
    panRef: RefObject<{ x: number; y: number }>
    activeLayerIdRef: RefObject<string | null>
    layersRef: RefObject<Layer[]>
    selectedElementIdRef: RefObject<string | null>
    hoveredHandleRef: RefObject<HandleName | null>
    rendererRef: RefObject<Renderer | null>
}

interface SelectToolActions {
    updateElement: (
        layerId: string,
        elementId: string,
        patch: Partial<Element>
    ) => void

    setSelectedElement: (id: string | null) => void
}

const HANDLE_SIZE = 10

export class SelectTool implements InteractionTool {
    readonly type = 'select'

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
    private resizeStartBounds = {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
    }

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

    onMouseDown(e: MouseEvent): void {
        this.didDrag = false

        const worldX = (e.offsetX - this.refs.panRef.current.x) / this.refs.zoomRef.current
        const worldY = (e.offsetY - this.refs.panRef.current.y) / this.refs.zoomRef.current

        const selected = this.refs.selectedElementIdRef.current
        const layers = this.refs.layersRef.current

        if (!selected) return

        const hitSize = HANDLE_SIZE / this.refs.zoomRef.current

        for (const layer of layers) {
            if (layer.locked) continue

            const element = layer.elements.find(el => el.id === selected)

            if (!element) continue

            const local = toLocalSpace(worldX, worldY, element)

            //rotate handle
            const rotateHandle = getRotateHandlePosition(element, 10, this.refs.zoomRef.current)

            const rotateHandleHitSize = HANDLE_SIZE / this.refs.zoomRef.current
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

            //transform handles
            for (
                const handle of getHandlePositions(element, 10)
            ) {
                if (
                    local.x >= handle.x - hitSize / 2 &&
                    local.x <= handle.x + hitSize / 2 &&
                    local.y >= handle.y - hitSize / 2 &&
                    local.y <= handle.y + hitSize / 2
                ) {
                    this.isResizing = true
                    this.activeHandle = handle.name

                    this.resizeStartMouse = {
                        x: worldX,
                        y: worldY
                    }

                    this.resizeStartBounds = {
                        x: element.position.x,
                        y: element.position.y,
                        width: element.size.width,
                        height: element.size.height
                    }

                    return
                }

            }

            if (hitTest(element, worldX, worldY)) {
                this.isDragging = true

                this.dragStartMouse = {
                    x: worldX,
                    y: worldY
                }

                this.dragStartPos = { ...element.position }
            }

            return

        }
    }

    private detectHandleHover(e: MouseEvent) {
        const selected = this.refs.selectedElementIdRef.current

        if (!selected || this.isDragging) return

        const worldX = (e.offsetX - this.refs.panRef.current.x) / this.refs.zoomRef.current
        const worldY = (e.offsetY - this.refs.panRef.current.y) / this.refs.zoomRef.current
        const handleHitSize = HANDLE_SIZE / this.refs.zoomRef.current

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
                    found = handle.name
                    break
                }
            }

            const rotateHandle = getRotateHandlePosition(element, 10, this.refs.zoomRef.current)
            const rotateHandleHitSize = HANDLE_SIZE / this.refs.zoomRef.current

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

        if (found === this.hoveredHandle) return

        this.hoveredHandle = found
        this.refs.hoveredHandleRef.current = found

        this.canvas.style.cursor = found ? 'grab' : 'default'
        this.refs.rendererRef.current?.requestFrame()
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

    onClick(e: MouseEvent) {
        if (this.didDrag) {
            this.didDrag = false
            return
        }

        this.handleSelectClick(e)
    }

    private handleSelectClick(e: MouseEvent) {
        const worldX = (e.offsetX - this.refs.panRef.current.x) / this.refs.zoomRef.current

        const worldY = (e.offsetY - this.refs.panRef.current.y) / this.refs.zoomRef.current

        const hits: string[] = []

        for (const layer of this.refs.layersRef.current) {
            if (!layer.visible || layer.locked) continue
            if (layer.id !== this.refs.activeLayerIdRef.current) continue

            for (let i = layer.elements.length - 1; i >= 0; i--) {
                if (hitTest(layer.elements[i], worldX, worldY)
                ) {
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

        const currentIndex = hits.indexOf(this.refs.selectedElementIdRef.current ?? '')
        this.actions.setSelectedElement(hits[(currentIndex + 1) % hits.length])
    }

    private getWorldPosition(e: MouseEvent) {
        const rect = this.canvas.getBoundingClientRect()

        return {
            x: (e.clientX - rect.left - this.refs.panRef.current.x) / this.refs.zoomRef.current,
            y: (e.clientY - rect.top - this.refs.panRef.current.y) / this.refs.zoomRef.current
        }
    }

    private applyDrag(e: MouseEvent) {
        this.didDrag = true

        const { x: worldX, y: worldY } = this.getWorldPosition(e)

        const dx = worldX - this.dragStartMouse.x

        const dy = worldY - this.dragStartMouse.y

        const selected = this.refs.selectedElementIdRef.current

        if (!selected) return

        for (const layer of this.refs.layersRef.current) {
            const element = layer.elements.find(
                el => el.id === selected
            )

            if (!element) continue

            this.actions.updateElement(
                layer.id,
                selected,
                {
                    position: {
                        x: this.dragStartPos.x + dx,
                        y: this.dragStartPos.y + dy
                    }
                }
            )

            return
        }
    }

    private applyResize(e: MouseEvent) {
        this.didDrag = true

        if (!this.activeHandle) return

        const { x: worldX, y: worldY } = this.getWorldPosition(e)

        const dx = worldX - this.resizeStartMouse.x
        const dy = worldY - this.resizeStartMouse.y
        const selected = this.refs.selectedElementIdRef.current

        if (!selected) return

        for (const layer of this.refs.layersRef.current) {
            const element = layer.elements.find(el => el.id === selected)

            if (!element) continue

            const local = rotatePoint(dx, dy, element.rotation)
            const result = computeResize(this.activeHandle, this.resizeStartBounds, local, element.rotation, e.altKey)

            this.actions.updateElement(
                layer.id,
                selected,
                {
                    position: {
                        x: result.x,
                        y: result.y
                    },
                    size: {
                        width: result.width,
                        height: result.height
                    }
                }
            )

            return
        }
    }

    private applyRotate(e: MouseEvent) {
        this.didDrag = true

        const { x: worldX, y: worldY } = this.getWorldPosition(e)

        const selected = this.refs.selectedElementIdRef.current

        if (!selected) return

        for (const layer of this.refs.layersRef.current) {
            const element = layer.elements.find(el => el.id === selected)

            if (!element) continue

            const centerX = element.position.x + element.size.width / 2
            const centerY = element.position.y + element.size.height / 2
            const currentAngle = Math.atan2(worldY - centerY, worldX - centerX) * 180 / Math.PI
            const delta = currentAngle - this.rotateStartAngle

            this.actions.updateElement(
                layer.id,
                selected,
                {
                    rotation: normalizeDegrees(this.rotateStartElementAngle + delta)
                }
            )

            return
        }
    }

    draw(
        ctx: CanvasRenderingContext2D,
        layers: Layer[],
        zoom: number,
        selectionRenderer: SelectionRenderer
    ) {
        const selectedElementId = this.refs.selectedElementIdRef.current
        const hoveredHandle = this.refs.hoveredHandleRef.current

        if (!selectedElementId) return

        for (const layer of layers) {
            const element = layer.elements.find(el => el.id === selectedElementId)
            if (!element) continue

            selectionRenderer.drawSelection(
                ctx,
                {
                    x: element.position.x,
                    y: element.position.y,
                    width: element.size.width,
                    height: element.size.height
                },
                zoom,
                {
                    style: 'solid',
                    color: '#7bb4f1',
                    lineWidth: 2,
                    padding: 10,
                    rotation: element.rotation,
                    handles: true,
                    rotateHandle: true,
                    hoveredHandle
                }
            )

            return
        }
    }
}